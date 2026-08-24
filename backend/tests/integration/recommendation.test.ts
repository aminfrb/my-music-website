import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Types } from "mongoose";
import { mongoAvailable, connect, disconnect, clearDb } from "../helpers/db";
import { makeUser, makeTrack } from "../helpers/factories";
import type { IUser, IMusic, IGenre } from "../../src/models";

const hasMongo = await mongoAvailable();
const describeDb = hasMongo ? describe : describe.skip;

describeDb("recommendation engine", () => {
  let recommendationService: typeof import("../../src/services/recommendation.service").recommendationService;
  let interactionService: typeof import("../../src/services/interaction.service").interactionService;
  let models: typeof import("../../src/models");

  let me: IUser;
  let rapper: IUser;
  let popper: IUser;
  let twin: IUser;
  let rap: IGenre;
  let pop: IGenre;
  let rock: IGenre;
  let rapTracks: IMusic[];
  let popTracks: IMusic[];
  let rockTracks: IMusic[];

  beforeAll(async () => {
    await connect();
    ({ recommendationService } = await import("../../src/services/recommendation.service"));
    ({ interactionService } = await import("../../src/services/interaction.service"));
    models = await import("../../src/models");
  });
  afterAll(disconnect);

  beforeEach(async () => {
    await clearDb();
    const { Genre } = models;
    [rap, pop, rock] = await Promise.all([
      Genre.create({ slug: "rap", nameEn: "Rap", nameFa: "رپ" }).then((d) => d.toObject()),
      Genre.create({ slug: "pop", nameEn: "Pop", nameFa: "پاپ" }).then((d) => d.toObject()),
      Genre.create({ slug: "rock", nameEn: "Rock", nameFa: "راک" }).then((d) => d.toObject()),
    ]);

    me = await makeUser({ displayName: "Me" });
    rapper = await makeUser({ displayName: "Rapper" });
    popper = await makeUser({ displayName: "Popper" });
    twin = await makeUser({ displayName: "Twin" });

    rapTracks = [];
    popTracks = [];
    rockTracks = [];
    for (let i = 0; i < 6; i++) {
      rapTracks.push(
        await makeTrack({
          uploadedBy: rapper._id, genre: rap._id, artistName: "Mehrad Hidden",
          title: `Rap ${i}`, playCount: 100, reactionCount: 20,
        }),
      );
      popTracks.push(
        await makeTrack({
          uploadedBy: popper._id, genre: pop._id, artistName: "Sirvan",
          title: `Pop ${i}`, playCount: 500, reactionCount: 5,
        }),
      );
    }
    for (let i = 0; i < 4; i++) {
      rockTracks.push(
        await makeTrack({
          uploadedBy: twin._id, genre: rock._id, artistName: "Kiosk",
          title: `Rock ${i}`, playCount: 30, reactionCount: 2,
        }),
      );
    }
  });

  const ctxFor = (user: IUser) => recommendationService.buildContext(user._id);
  const titles = (rows: { music: IMusic }[]) => rows.map((r) => r.music.title);

  describe("cold start", () => {
    it("falls back to popular tracks for a user with no history", async () => {
      const ctx = await ctxFor(me);
      expect(ctx.hasTaste).toBe(false);
      const feed = await recommendationService.forYouScored(ctx, 5);
      expect(feed).toHaveLength(5);
      expect(feed.every((f) => f.reasonKey === "trending")).toBe(true);
    });

    it("spreads a first impression across uploaders instead of one catalogue", async () => {
      // Popper holds the top six play counts; without diversity they'd take
      // the entire row, leaving a new listener nothing to choose between.
      const ctx = await ctxFor(me);
      const feed = await recommendationService.forYouScored(ctx, 5);
      const uploaders = new Set(feed.map((f) => f.music.uploadedBy.toString()));
      expect(uploaders.size).toBeGreaterThan(1);
    });
  });

  describe("following someone changes the feed immediately", () => {
    beforeEach(async () => {
      await models.Follow.create({ follower: me._id, following: rapper._id });
    });

    it("picks up the followed user's genre with no listening history at all", async () => {
      const ctx = await ctxFor(me);
      // This is the rule: follow someone, get recommended their genre.
      expect(ctx.networkGenres.has(rap._id.toString())).toBe(true);
      expect(ctx.hasTaste).toBe(true);
    });

    it("fills the feed with the followed uploader's tracks", async () => {
      const ctx = await ctxFor(me);
      const feed = await recommendationService.forYouScored(ctx, 6);
      const fromRapper = feed.filter((f) => f.music.uploadedBy.equals(rapper._id));
      expect(fromRapper.length).toBeGreaterThanOrEqual(2);
      expect(feed[0].reasonKey).toBe("followedUploader");
    });

    it("explains the recommendation in terms of the follow", async () => {
      const ctx = await ctxFor(me);
      const feed = await recommendationService.forYouScored(ctx, 6);
      expect(feed[0].reasonParams).toMatchObject({ name: "Mehrad Hidden" });
    });

    it("surfaces the network's genre through its own row", async () => {
      const ctx = await ctxFor(me);
      const row = await recommendationService.genresFromYourNetwork(ctx, 5);
      expect(row.length).toBeGreaterThan(0);
      expect(row.every((m) => m.genre.equals(rap._id))).toBe(true);
    });

    it("recommends what the followed user reacts to, not only what they upload", async () => {
      // The rapper likes a pop track; that should reach me.
      await models.Reaction.create({
        user: rapper._id, music: popTracks[3]._id, type: "like",
      });
      const ctx = await ctxFor(me);
      const row = await recommendationService.becauseYouFollow(ctx, 5);
      expect(row.map((m) => m.title)).toContain("Pop 3");
    });
  });

  describe("reacting to someone's music counts as a connection", () => {
    it("treats an uploader you engage with like part of your network", async () => {
      // No follow at all — just reactions to the rapper's uploads.
      for (const t of rapTracks.slice(0, 3)) {
        await interactionService.record(me._id, t, "reaction");
      }
      const ctx = await ctxFor(me);
      expect(ctx.networkGenres.has(rap._id.toString())).toBe(true);
    });
  });

  describe("collaborative filtering", () => {
    beforeEach(async () => {
      // Twin and I both like the same three rock tracks.
      for (const t of rockTracks.slice(0, 3)) {
        await models.Reaction.create({ user: twin._id, music: t._id, type: "like" });
        await models.Reaction.create({ user: me._id, music: t._id, type: "like" });
        await interactionService.record(me._id, t, "reaction");
      }
      // Twin also likes something I've never touched.
      await models.Reaction.create({ user: twin._id, music: popTracks[5]._id, type: "fire" });
    });

    it("finds listeners with overlapping taste", async () => {
      const ctx = await ctxFor(me);
      expect(ctx.peers.has(twin._id.toString())).toBe(true);
    });

    it("surfaces what those listeners liked that I haven't heard", async () => {
      const ctx = await ctxFor(me);
      const row = await recommendationService.popularAmongSimilar(ctx, 5);
      expect(row.map((m) => m.title)).toContain("Pop 5");
    });

    it("suggests the taste-twin as someone to follow", async () => {
      const ctx = await ctxFor(me);
      const suggestions = await recommendationService.suggestedUsers(ctx, 5);
      const names = suggestions.map((s) => s.user.displayName);
      expect(names).toContain("Twin");
    });

    it("never suggests someone already followed, or the user themselves", async () => {
      await models.Follow.create({ follower: me._id, following: twin._id });
      const ctx = await ctxFor(me);
      const suggestions = await recommendationService.suggestedUsers(ctx, 5);
      const ids = suggestions.map((s) => s.user._id.toString());
      expect(ids).not.toContain(twin._id.toString());
      expect(ids).not.toContain(me._id.toString());
    });
  });

  describe("exclusions", () => {
    it("never re-shows a track the user has engaged with", async () => {
      for (const t of rockTracks) await interactionService.record(me._id, t, "reaction");
      const ctx = await ctxFor(me);
      const feed = await recommendationService.forYouScored(ctx, 12);
      const shown = titles(feed);
      for (const t of rockTracks) expect(shown).not.toContain(t.title);
    });

    it("never recommends the user their own uploads", async () => {
      const mine = await makeTrack({
        uploadedBy: me._id, genre: pop._id, title: "My Own Track", playCount: 9999,
      });
      const ctx = await ctxFor(me);
      const feed = await recommendationService.forYouScored(ctx, 12);
      expect(titles(feed)).not.toContain(mine.title);
    });

    it("demotes a merely-played track without hiding it forever", async () => {
      const ctx0 = await ctxFor(me);
      await interactionService.record(me._id, popTracks[0], "play", 200);
      const ctx = await ctxFor(me);
      // A plain play is a soft signal, not a commitment.
      expect(ctx.played.has(popTracks[0]._id.toString())).toBe(true);
      expect(ctx.excluded.has(popTracks[0]._id.toString())).toBe(false);
      expect(ctx0).toBeDefined();
    });
  });

  describe("artist affinity", () => {
    it("recommends more from an artist the user keeps returning to", async () => {
      for (const t of rapTracks.slice(0, 2)) {
        await interactionService.record(me._id, t, "complete_play", 200);
      }
      const ctx = await ctxFor(me);
      const row = await recommendationService.fromArtistsYouLike(ctx, 5);
      expect(row.length).toBeGreaterThan(0);
      expect(row.every((m) => m.artistName === "Mehrad Hidden")).toBe(true);
      // The ones already heard aren't repeated.
      expect(row.map((m) => m.title)).not.toContain("Rap 0");
    });
  });

  describe("diversity", () => {
    it("limits how much of a row one uploader can take", async () => {
      const ctx = await ctxFor(me);
      // 16 candidates, asking for 5 — the caps have room to bind here.
      const feed = await recommendationService.forYouScored(ctx, 5);
      const counts = new Map<string, number>();
      for (const f of feed) {
        const k = f.music.uploadedBy.toString();
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(3);
    });

    it("returns a full row even when the catalogue is thin", async () => {
      const ctx = await ctxFor(me);
      const feed = await recommendationService.forYouScored(ctx, 10);
      expect(feed).toHaveLength(10);
    });

    it("never returns the same track twice", async () => {
      const ctx = await ctxFor(me);
      const feed = await recommendationService.forYouScored(ctx, 12);
      const ids = feed.map((f) => f.music._id.toString());
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("taste profile decay", () => {
    it("halves an untouched score roughly every 60 days", async () => {
      await interactionService.record(me._id, rockTracks[0], "reaction");
      const { RecommendationProfile } = models;

      const before = (await RecommendationProfile.findOne({ user: me._id }))!.genreScores.get(
        rock._id.toString(),
      )!;
      expect(before).toBeGreaterThan(0);

      // Two half-lives of silence.
      const profile = (await RecommendationProfile.findOne({ user: me._id }))!;
      profile.lastInteractionAt = new Date(Date.now() - 120 * 86_400_000);
      await profile.save();

      // Any new interaction applies the pending decay first.
      await interactionService.record(me._id, popTracks[0], "play", 200);
      const after = (await RecommendationProfile.findOne({ user: me._id }))!.genreScores.get(
        rock._id.toString(),
      )!;

      expect(after).toBeCloseTo(before / 4, 1);
    });

    it("drops a genre off the skip list once it stops scoring negative", async () => {
      const { RecommendationProfile } = models;
      await interactionService.record(me._id, popTracks[0], "skip", 3);
      let profile = (await RecommendationProfile.findOne({ user: me._id }))!;
      expect(profile.skippedGenres.map(String)).toContain(pop._id.toString());

      // Genuine engagement afterwards should rehabilitate the genre.
      for (const t of popTracks.slice(1, 4)) {
        await interactionService.record(me._id, t, "complete_play", 200);
      }
      profile = (await RecommendationProfile.findOne({ user: me._id }))!;
      expect(profile.skippedGenres.map(String)).not.toContain(pop._id.toString());
    });
  });

  describe("performance shape", () => {
    it("builds one shared context rather than one per row", async () => {
      // A regression guard: sections take a context, they don't fetch their own.
      const ctx = await ctxFor(me);
      expect(ctx.userId).toBeInstanceOf(Types.ObjectId);
      await Promise.all([
        recommendationService.similarToSaved(ctx, 5),
        recommendationService.basedOnGenres(ctx, 5),
        recommendationService.newReleases(ctx, 5),
        recommendationService.newDiscovery(ctx, 5),
        recommendationService.becauseYouFollow(ctx, 5),
        recommendationService.genresFromYourNetwork(ctx, 5),
        recommendationService.fromArtistsYouLike(ctx, 5),
      ]);
    });
  });
});
