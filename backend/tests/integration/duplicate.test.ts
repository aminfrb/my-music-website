import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { mongoAvailable, connect, disconnect, clearDb } from "../helpers/db";
import { makeUser, makeTrack, makeGenre } from "../helpers/factories";
import type { IUser, IMusic } from "../../src/models";

const hasMongo = await mongoAvailable();
const describeDb = hasMongo ? describe : describe.skip;

/** Pull the structured payload the upload screen renders. */
function duplicateOf(err: unknown) {
  return (
    err as { extensions?: { details?: { duplicate?: Record<string, unknown> } } }
  ).extensions?.details?.duplicate;
}

describeDb("duplicate detection", () => {
  let duplicateService: typeof import("../../src/services/duplicate.service").duplicateService;
  let ali: IUser;
  let sara: IUser;
  let original: IMusic;

  beforeAll(async () => {
    await connect();
    ({ duplicateService } = await import("../../src/services/duplicate.service"));
  });
  afterAll(disconnect);

  beforeEach(async () => {
    await clearDb();
    const genre = await makeGenre();
    ali = await makeUser({ displayName: "Ali" });
    sara = await makeUser({ displayName: "Sara" });
    original = await makeTrack({
      uploadedBy: ali._id,
      genre: genre._id,
      title: "Seyl",
      artistName: "Mehrad Hidden",
    });
  });

  const saraUploads = (title: string, artist: string, hash: string | null = null) =>
    duplicateService.assertNotDuplicate(sara._id, title, artist, hash);

  describe("blocks the same song from a second user", () => {
    it.each([
      ["Seyl", "Mehrad Hidden", "an exact match"],
      ["seyl", "mehrad hidden", "different casing"],
      ["  Seyl  ", "Mehrad Hidden", "stray whitespace"],
      ["Seyl (Official Audio)", "Mehrad Hidden", "a decorated title"],
      ["Seyl [320]", "Mehrad Hidden ft. Sijal", "a featured-artist credit"],
    ])("rejects %j / %j — %s", async (title, artist) => {
      await expect(saraUploads(title, artist)).rejects.toThrow();
    });

    it("names the original uploader in the message", async () => {
      const err = await saraUploads("Seyl", "Mehrad Hidden").catch((e) => e);
      expect(err.message).toContain("Ali");
      expect(err.message).toContain("Seyl");
      expect(err.extensions.code).toBe("CONFLICT");
    });

    it("carries the uploader's profile so the client can offer a follow", async () => {
      const err = await saraUploads("Seyl", "Mehrad Hidden").catch((e) => e);
      const dup = duplicateOf(err);
      expect(dup).toMatchObject({
        kind: "song",
        musicId: original._id.toString(),
        title: "Seyl",
        artistName: "Mehrad Hidden",
        uploader: {
          id: ali._id.toString(),
          displayName: "Ali",
          isVerifiedArtist: false,
        },
      });
    });
  });

  describe("allows genuinely different uploads", () => {
    it("permits the same title by a different artist", async () => {
      await expect(saraUploads("Seyl", "Sasy")).resolves.toBeUndefined();
    });

    it("permits a different song by the same artist", async () => {
      await expect(saraUploads("Deltangi", "Mehrad Hidden")).resolves.toBeUndefined();
    });
  });

  describe("byte-identical files", () => {
    it("blocks the same audio whatever metadata it is given", async () => {
      const err = await saraUploads("Something Else", "Another Artist", original.fileHash).catch(
        (e) => e,
      );
      expect(duplicateOf(err)).toMatchObject({ kind: "file" });
    });
  });

  describe("the uploader's own re-upload", () => {
    it("gets a message about their own track, not someone else's", async () => {
      const err = await duplicateService
        .assertNotDuplicate(ali._id, "Seyl", "Mehrad Hidden", null)
        .catch((e) => e);
      expect(err.extensions.messageKey).toBe("errors.duplicateTrackMine");
    });
  });

  describe("moderation lifecycle", () => {
    it("frees the name once the original is rejected", async () => {
      const { Music } = await import("../../src/models");
      await Music.updateOne({ _id: original._id }, { $set: { status: "rejected" } });
      await expect(saraUploads("Seyl", "Mehrad Hidden")).resolves.toBeUndefined();
    });

    it("still claims the name while the original is only pending review", async () => {
      const { Music } = await import("../../src/models");
      await Music.updateOne({ _id: original._id }, { $set: { status: "pending" } });
      await expect(saraUploads("Seyl", "Mehrad Hidden")).rejects.toThrow();
    });
  });

  describe("editing an existing track", () => {
    it("does not match a track against itself", async () => {
      await expect(
        duplicateService.assertNotDuplicate(
          ali._id,
          "Seyl",
          "Mehrad Hidden",
          original.fileHash,
          original._id,
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe("the earliest upload wins", () => {
    it("reports the first uploader when several rows share a key", async () => {
      // A second copy that predates nothing — the original stays the owner.
      await makeTrack({
        uploadedBy: sara._id,
        title: "Seyl",
        artistName: "Mehrad Hidden",
      });
      const third = await makeUser({ displayName: "Reza" });
      const err = await duplicateService
        .assertNotDuplicate(third._id, "Seyl", "Mehrad Hidden", null)
        .catch((e) => e);
      expect(duplicateOf(err)).toMatchObject({ uploader: { displayName: "Ali" } });
    });
  });
});
