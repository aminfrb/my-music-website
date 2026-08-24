import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { mongoAvailable, connect, disconnect, clearDb } from "../helpers/db";
import { makeUser, makeGenre, makeTrack } from "../helpers/factories";
import { makeMp3, makeWav, fakeId3Text } from "../helpers/audio";
import type { IUser, IGenre } from "../../src/models";

const hasMongo = await mongoAvailable();
const describeDb = hasMongo ? describe : describe.skip;

/**
 * The upload flow talks to object storage, so the two storage calls are stubbed:
 * `inspectObject` returns what the server would have computed by streaming the
 * uploaded bytes, and `deleteObject` records that a rejected file was cleaned
 * up. Everything else — validation, dedup, persistence — is the real code.
 */
const inspect = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("../../src/upload/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/upload/storage")>();
  return {
    ...actual,
    inspectObject: inspect,
    deleteObject: remove,
    presignPutUrl: vi.fn(async () => "https://storage.test/put"),
    presignGetUrl: vi.fn(async () => "https://storage.test/get"),
  };
});

/** Build what inspectObject would return for a given buffer. */
async function inspection(buf: Buffer, size = buf.length, hash = "hash-1") {
  const { sniffAudio } = await import("../../src/upload/validation");
  const { probeAudio } = await import("../../src/upload/probe");
  return { size, hash, sniff: sniffAudio(buf), probe: probeAudio(buf, size) };
}

describeDb("upload flow", () => {
  let uploadService: typeof import("../../src/services/upload.service").uploadService;
  let UploadSession: typeof import("../../src/models").UploadSession;
  let Music: typeof import("../../src/models").Music;
  let uploader: IUser;
  let genre: IGenre;

  beforeAll(async () => {
    await connect();
    ({ uploadService } = await import("../../src/services/upload.service"));
    ({ UploadSession, Music } = await import("../../src/models"));
  });
  afterAll(disconnect);

  beforeEach(async () => {
    await clearDb();
    inspect.mockReset();
    remove.mockReset();
    const { uploadLimiter, presignLimiter } = await import("../../src/middleware/rateLimit");
    (uploadLimiter as unknown as { buckets: Map<string, unknown> }).buckets.clear();
    (presignLimiter as unknown as { buckets: Map<string, unknown> }).buckets.clear();

    uploader = await makeUser({ displayName: "Uploader", isTrusted: true });
    genre = await makeGenre("pop");
  });

  /** Start a session and take it through a successful audio finalize. */
  async function sessionWithAudio(buf = makeMp3(180), hash = "hash-1") {
    const session = await uploadService.createSession(uploader);
    await uploadService.requestAudioUpload(uploader, session._id.toString(), "audio/mpeg");
    inspect.mockResolvedValueOnce(await inspection(buf, buf.length, hash));
    return uploadService.finalizeAudio(uploader, session._id.toString());
  }

  describe("audio validation", () => {
    it("accepts a real MP3 and takes the duration from the file", async () => {
      const session = await sessionWithAudio(makeMp3(180));
      expect(session.audio?.finalized).toBe(true);
      // ~180s derived from the frames, not supplied by the client.
      expect(session.audio!.duration).toBeGreaterThan(175);
      expect(session.audio!.duration).toBeLessThan(185);
    });

    it("accepts a WAV", async () => {
      const { head, declaredSize } = makeWav(200);
      const session = await uploadService.createSession(uploader);
      await uploadService.requestAudioUpload(uploader, session._id.toString(), "audio/wav");
      inspect.mockResolvedValueOnce(await inspection(head, declaredSize, "wav-hash"));
      const done = await uploadService.finalizeAudio(uploader, session._id.toString());
      expect(done.audio?.mimeType).toBe("audio/wav");
      expect(done.audio!.duration).toBe(200);
    });

    it("rejects a text file that merely starts with ID3, and deletes it", async () => {
      const session = await uploadService.createSession(uploader);
      await uploadService.requestAudioUpload(uploader, session._id.toString(), "audio/mpeg");
      inspect.mockResolvedValueOnce(await inspection(fakeId3Text()));

      await expect(
        uploadService.finalizeAudio(uploader, session._id.toString()),
      ).rejects.toMatchObject({ extensions: { messageKey: "errors.audioNotPlayable" } });
      // The rejected object must not be left in storage.
      expect(remove).toHaveBeenCalledOnce();
    });

    it("rejects a clip too short to be a track", async () => {
      const session = await uploadService.createSession(uploader);
      await uploadService.requestAudioUpload(uploader, session._id.toString(), "audio/mpeg");
      inspect.mockResolvedValueOnce(await inspection(makeMp3(3)));
      await expect(
        uploadService.finalizeAudio(uploader, session._id.toString()),
      ).rejects.toMatchObject({ extensions: { messageKey: "errors.audioTooShort" } });
    });

    it("ignores a client-supplied duration once the file has given one", async () => {
      const session = await sessionWithAudio(makeMp3(180));
      const updated = await uploadService.setMetadata(uploader, session._id.toString(), {
        title: "Deltangi",
        artistName: "Sirvan Khosravi",
        genreId: genre._id.toString(),
        // In range for the schema, but nothing like the real file.
        duration: 9_000,
      });
      expect(updated.audio!.duration).toBeLessThan(185);
    });

    it("rejects a duration outside the schema bounds outright", async () => {
      const session = await sessionWithAudio(makeMp3(180));
      await expect(
        uploadService.setMetadata(uploader, session._id.toString(), {
          title: "Deltangi",
          artistName: "Sirvan Khosravi",
          genreId: genre._id.toString(),
          duration: 99_999,
        }),
      ).rejects.toThrow();
    });
  });

  describe("naming rules", () => {
    let sessionId: string;
    beforeEach(async () => {
      sessionId = (await sessionWithAudio())._id.toString();
    });

    const setMeta = (title: string, artistName: string) =>
      uploadService.setMetadata(uploader, sessionId, {
        title,
        artistName,
        genreId: genre._id.toString(),
      });

    it.each([
      ["8432", "Someone"],
      ["8432.mp3", "Someone"],
      ["AUD-20240115-WA0007", "Someone"],
      ["untitled", "Someone"],
      ["@musicchannel", "Someone"],
      ["Real Song", "unknown"],
    ])("rejects %j / %j at the details step", async (title, artist) => {
      await expect(setMeta(title, artist)).rejects.toThrow();
    });

    it.each([
      ["Deltangi", "Sirvan Khosravi"],
      ["دلتنگی", "سیروان خسروی"],
      ["Seyl (سیل)", "Mehrad Hidden"],
    ])("accepts the real name %j / %j", async (title, artist) => {
      await expect(setMeta(title, artist)).resolves.toBeDefined();
    });
  });

  describe("publishing", () => {
    it("stores the derived keys the rest of the app relies on", async () => {
      const session = await sessionWithAudio();
      await uploadService.setMetadata(uploader, session._id.toString(), {
        title: "Seyl",
        artistName: "Mehrad Hidden",
        genreId: genre._id.toString(),
      });
      const music = await uploadService.publish(uploader, session._id.toString());

      expect(music.dedupeKey).toBe("seyl|mehrad hidden");
      expect(music.artistKey).toBe("mehrad hidden");
      expect(music.normalized).toContain("seyl");

      const stored = await UploadSession.findById(session._id).lean().exec();
      expect(stored?.status).toBe("published");
    });

    it("refuses a song another user already owns", async () => {
      const other = await makeUser({ displayName: "Ali" });
      await makeTrack({ uploadedBy: other._id, title: "Seyl", artistName: "Mehrad Hidden" });

      const session = await sessionWithAudio(makeMp3(180), "different-hash");
      await expect(
        uploadService.setMetadata(uploader, session._id.toString(), {
          title: "Seyl",
          artistName: "Mehrad Hidden",
          genreId: genre._id.toString(),
        }),
      ).rejects.toMatchObject({ extensions: { messageKey: "errors.duplicateTrack" } });

      expect(await Music.countDocuments({ dedupeKey: "seyl|mehrad hidden" })).toBe(1);
    });

    it("re-checks at publish, in case the song was claimed meanwhile", async () => {
      const session = await sessionWithAudio(makeMp3(180), "mine");
      await uploadService.setMetadata(uploader, session._id.toString(), {
        title: "Seyl",
        artistName: "Mehrad Hidden",
        genreId: genre._id.toString(),
      });

      // Someone else publishes it between the details step and publish.
      const other = await makeUser({ displayName: "Ali" });
      await makeTrack({ uploadedBy: other._id, title: "Seyl", artistName: "Mehrad Hidden" });

      await expect(uploadService.publish(uploader, session._id.toString())).rejects.toMatchObject({
        extensions: { messageKey: "errors.duplicateTrack" },
      });
    });

    it("rejects an identical file uploaded by someone else", async () => {
      const other = await makeUser({ displayName: "Ali" });
      await makeTrack({ uploadedBy: other._id, title: "Something", artistName: "Else" });
      const { Music: M } = await import("../../src/models");
      const existing = await M.findOne({ title: "Something" }).lean().exec();

      const session = await uploadService.createSession(uploader);
      await uploadService.requestAudioUpload(uploader, session._id.toString(), "audio/mpeg");
      inspect.mockResolvedValueOnce(
        await inspection(makeMp3(180), makeMp3(180).length, existing!.fileHash),
      );
      await expect(
        uploadService.finalizeAudio(uploader, session._id.toString()),
      ).rejects.toMatchObject({ extensions: { code: "CONFLICT" } });
    });
  });

  describe("abuse limits", () => {
    it("caps upload sessions per hour, above the published-track daily cap", async () => {
      let created = 0;
      let blocked = 0;
      for (let i = 0; i < 25; i++) {
        try {
          await uploadService.createSession(uploader);
          created++;
        } catch {
          blocked++;
        }
      }
      expect(created).toBe(20);
      expect(blocked).toBe(5);
      expect(await UploadSession.countDocuments()).toBe(20);
    });

    it("caps presigned-URL requests, which create real storage objects", async () => {
      const session = await uploadService.createSession(uploader);
      const id = session._id.toString();
      let issued = 0;
      for (let i = 0; i < 65; i++) {
        try {
          await uploadService.requestAudioUpload(uploader, id, "audio/mpeg");
          issued++;
        } catch {
          break;
        }
      }
      expect(issued).toBe(60);
    });
  });
});
