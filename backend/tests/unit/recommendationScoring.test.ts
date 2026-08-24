import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { scoreTrack, diversify } from "../../src/services/recommendation.service";
import { emptyContext, fakeTrack } from "../helpers/recContext";

/**
 * `scoreTrack` decides both the ranking and the "why this?" label. These tests
 * assert relative ordering and which signal wins, never absolute scores — the
 * weights are meant to be tunable without rewriting the suite.
 */
describe("scoreTrack — social signals", () => {
  it("ranks a followed uploader's track above an unknown one", () => {
    const uploader = new Types.ObjectId();
    const ctx = emptyContext({ following: new Set([uploader.toString()]) });

    const followed = scoreTrack(fakeTrack({ uploadedBy: uploader }), ctx, 100);
    const stranger = scoreTrack(fakeTrack(), ctx, 100);

    expect(followed.score).toBeGreaterThan(stranger.score);
    expect(followed.reasonKey).toBe("followedUploader");
  });

  it("names the artist in the reason, so the card can say who", () => {
    const uploader = new Types.ObjectId();
    const ctx = emptyContext({ following: new Set([uploader.toString()]) });
    const scored = scoreTrack(
      fakeTrack({ uploadedBy: uploader, artistName: "Mehrad Hidden" }),
      ctx,
      100,
    );
    expect(scored.reasonParams).toEqual({ name: "Mehrad Hidden" });
  });

  it("ranks a second-degree uploader below a followed one, above a stranger", () => {
    const followed = new Types.ObjectId();
    const networked = new Types.ObjectId();
    const ctx = emptyContext({
      following: new Set([followed.toString()]),
      network: new Set([networked.toString()]),
    });

    const a = scoreTrack(fakeTrack({ uploadedBy: followed }), ctx, 100);
    const b = scoreTrack(fakeTrack({ uploadedBy: networked }), ctx, 100);
    const c = scoreTrack(fakeTrack(), ctx, 100);

    expect(a.score).toBeGreaterThan(b.score);
    expect(b.score).toBeGreaterThan(c.score);
    expect(b.reasonKey).toBe("networkUploader");
  });

  it("surfaces what taste-peers engaged with", () => {
    const track = fakeTrack();
    const ctx = emptyContext({ peerTracks: new Map([[track._id.toString(), 1]]) });
    const scored = scoreTrack(track, ctx, 100);
    expect(scored.reasonKey).toBe("peerLoved");
  });
});

describe("scoreTrack — the follow-a-user-get-their-genre rule", () => {
  it("boosts a genre the network listens to even with no listening history", () => {
    const genre = new Types.ObjectId();
    const ctx = emptyContext({ networkGenres: new Set([genre.toString()]) });

    const inNetworkGenre = scoreTrack(fakeTrack({ genre }), ctx, 100);
    const unrelated = scoreTrack(fakeTrack(), ctx, 100);

    expect(inNetworkGenre.score).toBeGreaterThan(unrelated.score);
    expect(inNetworkGenre.reasonKey).toBe("networkGenre");
  });

  it("fades the network-genre boost once the user has their own taste for it", () => {
    const genre = new Types.ObjectId();
    const gid = genre.toString();
    const fresh = emptyContext({ networkGenres: new Set([gid]) });
    // Already a strong personal favourite: the network adds nothing new.
    const known = emptyContext({
      networkGenres: new Set([gid]),
      genres: new Map([[gid, 1]]),
    });

    const a = scoreTrack(fakeTrack({ genre }), fresh, 100);
    const b = scoreTrack(fakeTrack({ genre }), known, 100);
    expect(a.reasonKey).toBe("networkGenre");
    // The personal signal takes over as the stated reason.
    expect(b.reasonKey).toBe("favoriteGenre");
  });
});

describe("scoreTrack — content affinity", () => {
  it("uses the artist score, keyed by normalized name", () => {
    const ctx = emptyContext({ artists: new Map([["mehrad hidden", 1]]) });
    // Stored lowercase; the track is credited with different casing.
    const scored = scoreTrack(fakeTrack({ artistName: "Mehrad Hidden" }), ctx, 100);
    expect(scored.reasonKey).toBe("favoriteArtist");
  });

  it("caps how much tag matching can contribute", () => {
    const tags = new Map([
      ["a", 1], ["b", 1], ["c", 1], ["d", 1], ["e", 1], ["f", 1],
    ]);
    const three = scoreTrack(fakeTrack({ tags: ["a", "b", "c"] }), emptyContext({ tags }), 100);
    const six = scoreTrack(
      fakeTrack({ tags: ["a", "b", "c", "d", "e", "f"] }),
      emptyContext({ tags }),
      100,
    );
    // Tag spam beyond the cap earns nothing extra.
    expect(six.score).toBeCloseTo(three.score, 5);
  });
});

describe("scoreTrack — quality over raw popularity", () => {
  it("lets a small, well-loved track beat a big, ignored one", () => {
    const ctx = emptyContext();
    const gem = scoreTrack(fakeTrack({ playCount: 200, reactionCount: 180 }), ctx, 5000);
    const bulk = scoreTrack(fakeTrack({ playCount: 5000, reactionCount: 10 }), ctx, 5000);
    expect(gem.score).toBeGreaterThan(bulk.score);
  });

  it("decays with age", () => {
    const ctx = emptyContext();
    const now = new Date();
    const old = new Date(Date.now() - 365 * 86_400_000);
    const fresh = scoreTrack(fakeTrack({ publishedAt: now, createdAt: now }), ctx, 100);
    const stale = scoreTrack(fakeTrack({ publishedAt: old, createdAt: old }), ctx, 100);
    expect(fresh.score).toBeGreaterThan(stale.score);
  });
});

describe("scoreTrack — penalties", () => {
  it("penalizes a genre the user demonstrably skips", () => {
    const genre = new Types.ObjectId();
    const ctx = emptyContext({ skippedGenres: new Set([genre.toString()]) });
    const skipped = scoreTrack(fakeTrack({ genre }), ctx, 100);
    const neutral = scoreTrack(fakeTrack(), ctx, 100);
    expect(skipped.score).toBeLessThan(neutral.score);
  });

  it("demotes an already-played track without excluding it", () => {
    const track = fakeTrack();
    const ctx = emptyContext({ played: new Set([track._id.toString()]) });
    const played = scoreTrack(track, ctx, 100);
    const unplayed = scoreTrack(fakeTrack(), ctx, 100);
    expect(played.score).toBeLessThan(unplayed.score);
  });
});

describe("scoreTrack — fallback reasons", () => {
  it("labels a recent track with nothing personal matched as fresh", () => {
    const scored = scoreTrack(fakeTrack(), emptyContext(), 100);
    expect(scored.reasonKey).toBe("fresh");
  });

  it("labels an older, played track as trending", () => {
    const old = new Date(Date.now() - 100 * 86_400_000);
    const scored = scoreTrack(
      fakeTrack({ publishedAt: old, createdAt: old, playCount: 500 }),
      emptyContext(),
      1000,
    );
    expect(scored.reasonKey).toBe("trending");
  });
});

describe("diversify", () => {
  const scored = (uploader: Types.ObjectId, genre: Types.ObjectId, score: number) => ({
    music: fakeTrack({ uploadedBy: uploader, genre }),
    score,
    reasonKey: "trending" as const,
    reasonParams: {},
  });

  it("caps one uploader when there is enough variety to fill the row", () => {
    const hog = new Types.ObjectId();
    const others = Array.from({ length: 8 }, () => new Types.ObjectId());
    const genre = new Types.ObjectId();

    const items = [
      ...Array.from({ length: 8 }, (_, i) => scored(hog, new Types.ObjectId(), 100 - i)),
      ...others.map((u, i) => scored(u, genre, 50 - i)),
    ];

    const picked = diversify(items, 6);
    const fromHog = picked.filter((p) => p.music.uploadedBy.equals(hog)).length;
    expect(picked).toHaveLength(6);
    expect(fromHog).toBeLessThanOrEqual(2);
  });

  it("relaxes the cap rather than returning a short row", () => {
    // Only one uploader exists — a strict cap would return 2 of the 6 asked for.
    const only = new Types.ObjectId();
    const items = Array.from({ length: 10 }, (_, i) =>
      scored(only, new Types.ObjectId(), 100 - i),
    );
    expect(diversify(items, 6)).toHaveLength(6);
  });

  it("always keeps the best-scoring item", () => {
    const hog = new Types.ObjectId();
    const genre = new Types.ObjectId();
    const items = Array.from({ length: 10 }, (_, i) => scored(hog, genre, 100 - i));
    const picked = diversify(items, 5);
    expect(picked[0].score).toBe(100);
  });

  it("never returns the same track twice across relaxation passes", () => {
    const hog = new Types.ObjectId();
    const genre = new Types.ObjectId();
    const items = Array.from({ length: 10 }, (_, i) => scored(hog, genre, 100 - i));
    const picked = diversify(items, 8);
    const ids = picked.map((p) => p.music._id.toString());
    expect(new Set(ids).size).toBe(ids.length);
  });
});
