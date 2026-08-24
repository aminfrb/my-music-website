import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { mongoAvailable, connect, disconnect, clearDb, backdate } from "../helpers/db";
import { makeUser, makeTrack, makeGenre, playCountOf } from "../helpers/factories";
import type { IUser, IMusic } from "../../src/models";

const hasMongo = await mongoAvailable();
const describeDb = hasMongo ? describe : describe.skip;
if (!hasMongo) {
  console.warn(
    "\n  ! Skipping integration specs: no MongoDB at TEST_MONGODB_URI.\n" +
      "    Start one with `docker compose up -d mongo`.\n",
  );
}

/**
 * playCount feeds the homepage rankings and the recommendation ranker, so
 * recordPlay is the natural lever for anyone wanting to promote a track. Every
 * case here is an attack that used to work.
 */
describeDb("recordPlay — resisting inflation", () => {
  let musicService: typeof import("../../src/services/music.service").musicService;
  let MusicInteraction: typeof import("../../src/models").MusicInteraction;
  let playCooldown: import("../../src/middleware/rateLimit").Cooldown;
  let playLimiter: import("../../src/middleware/rateLimit").RateLimiter;
  let anonPlayLimiter: import("../../src/middleware/rateLimit").RateLimiter;

  let owner: IUser;
  let listener: IUser;
  let track: IMusic;

  beforeAll(async () => {
    await connect();
    ({ musicService } = await import("../../src/services/music.service"));
    ({ MusicInteraction } = await import("../../src/models"));
    ({ playCooldown, playLimiter, anonPlayLimiter } = await import(
      "../../src/middleware/rateLimit"
    ));
  });
  afterAll(disconnect);

  beforeEach(async () => {
    await clearDb();
    // These limiters are process-global; reset them so cases don't leak.
    resetLimiter(playCooldown, "seen");
    resetLimiter(playLimiter, "buckets");
    resetLimiter(anonPlayLimiter, "buckets");

    const genre = await makeGenre();
    owner = await makeUser({ displayName: "Owner" });
    listener = await makeUser({ displayName: "Listener" });
    track = await makeTrack({ uploadedBy: owner._id, genre: genre._id, duration: 200 });
  });

  const play = (viewer: IUser | null, seconds: number, ip = "1.1.1.1") =>
    musicService.recordPlay(track._id.toString(), viewer, seconds, ip);

  it("counts a genuine listen once", async () => {
    await play(listener, 200);
    expect(await playCountOf(track._id)).toBe(1);
  });

  it("counts one play however many times a signed-in caller loops the mutation", async () => {
    for (let i = 0; i < 50; i++) await play(listener, 200);
    expect(await playCountOf(track._id)).toBe(1);
    // And only one interaction row, which is what todayPopular aggregates.
    expect(await MusicInteraction.countDocuments({ music: track._id })).toBe(1);
  });

  it("counts one play for an anonymous flood from a single IP", async () => {
    for (let i = 0; i < 50; i++) await play(null, 200, "2.2.2.2");
    expect(await playCountOf(track._id)).toBe(1);
  });

  it("ignores a listen too short to be a play", async () => {
    await play(null, 0, "3.3.3.3");
    await play(null, 4, "3.3.3.3");
    expect(await playCountOf(track._id)).toBe(0);
  });

  it("ignores `seconds: 0` from a signed-in user", async () => {
    // This used to be a free increment: the old code only length-checked
    // anonymous callers.
    await play(listener, 0);
    expect(await playCountOf(track._id)).toBe(0);
  });

  it("ignores an uploader playing their own track", async () => {
    await play(owner, 200);
    expect(await playCountOf(track._id)).toBe(0);
  });

  it("clamps an inflated listen time to the real duration", async () => {
    const short = await makeTrack({ uploadedBy: owner._id, duration: 12 });
    await musicService.recordPlay(short._id.toString(), listener, 999_999, "4.4.4.4");
    const row = await MusicInteraction.findOne({ music: short._id }).lean().exec();
    // Left unclamped this both forces `complete_play` and skews the taste
    // profile's averageListenDuration.
    expect(row?.listenDuration).toBe(12);
  });

  it("still counts distinct listeners", async () => {
    for (let i = 0; i < 10; i++) await play(null, 180, `10.0.0.${i}`);
    expect(await playCountOf(track._id)).toBe(10);
  });

  it("counts a genuine replay once the cooldown has passed", async () => {
    await play(listener, 200);
    expect(await playCountOf(track._id)).toBe(1);

    // Simulate time passing for both guards.
    resetLimiter(playCooldown, "seen");
    await backdate(
      "musicinteractions",
      { user: listener._id, music: track._id },
      new Date(Date.now() - 3 * 3_600_000),
    );

    await play(listener, 200);
    expect(await playCountOf(track._id)).toBe(2);
  });

  it("keeps blocking a signed-in replay after a restart, via the interaction log", async () => {
    await play(listener, 200);
    // Losing the in-memory cooldown is what a restart looks like.
    resetLimiter(playCooldown, "seen");
    await play(listener, 200);
    expect(await playCountOf(track._id)).toBe(1);
  });

  it("does not let one track's cooldown block another", async () => {
    const other = await makeTrack({ uploadedBy: owner._id, duration: 200 });
    await play(listener, 200);
    await musicService.recordPlay(other._id.toString(), listener, 200, "1.1.1.1");
    expect(await playCountOf(track._id)).toBe(1);
    expect(await playCountOf(other._id)).toBe(1);
  });

  it("records a completion when the listen covers the track", async () => {
    await play(listener, 200);
    const row = await MusicInteraction.findOne({ music: track._id }).lean().exec();
    expect(row?.type).toBe("complete_play");
  });

  it("records a partial listen as a plain play", async () => {
    await play(listener, 30);
    const row = await MusicInteraction.findOne({ music: track._id }).lean().exec();
    expect(row?.type).toBe("play");
  });

  it("rejects an unpublished track", async () => {
    const pending = await makeTrack({ uploadedBy: owner._id, status: "pending" });
    await expect(
      musicService.recordPlay(pending._id.toString(), listener, 200, "1.1.1.1"),
    ).rejects.toThrow();
  });

  it("applies a burst limit per account", async () => {
    // Distinct tracks, so the per-track cooldown isn't what stops them.
    const tracks = [];
    for (let i = 0; i < 65; i++) {
      tracks.push(await makeTrack({ uploadedBy: owner._id, duration: 200 }));
    }
    let counted = 0;
    let limited = 0;
    for (const t of tracks) {
      try {
        await musicService.recordPlay(t._id.toString(), listener, 200, "1.1.1.1");
        counted++;
      } catch {
        limited++;
      }
    }
    expect(counted).toBe(60);
    expect(limited).toBe(5);
  });

  it("gives anonymous listeners a looser bucket, since one IP can be a whole network", async () => {
    const limitOf = (l: unknown) => (l as { limit: number }).limit;
    expect(limitOf(anonPlayLimiter)).toBeGreaterThan(limitOf(playLimiter));
  });
});

/** Clear a limiter's private map between cases. */
function resetLimiter(instance: unknown, field: string): void {
  const map = (instance as Record<string, Map<string, unknown>>)[field];
  map.clear();
}
