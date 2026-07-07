import { scalarResolvers } from "./scalars";
import { authResolvers } from "./auth";
import { userResolvers } from "./user";
import { musicResolvers } from "./music";
import { uploadResolvers } from "./upload";
import { playlistResolvers } from "./playlist";
import { reportResolvers } from "./report";
import { recommendationResolvers } from "./recommendation";
import { notificationResolvers } from "./notification";
import { statsResolvers } from "./stats";
import { searchResolvers } from "./search";
import { adminResolvers } from "./admin";

type ResolverMap = Record<string, Record<string, unknown>>;

/** Shallow-merge per type (Query/Mutation/object types) across modules. */
function mergeResolvers(...maps: ResolverMap[]): ResolverMap {
  const out: ResolverMap = {};
  for (const map of maps) {
    for (const [type, fields] of Object.entries(map)) {
      out[type] = { ...(out[type] ?? {}), ...fields };
    }
  }
  return out;
}

const baseResolvers: ResolverMap = {
  Query: { health: () => "ok" },
};

export const resolvers = mergeResolvers(
  baseResolvers,
  scalarResolvers as unknown as ResolverMap,
  authResolvers as ResolverMap,
  userResolvers as ResolverMap,
  musicResolvers as ResolverMap,
  uploadResolvers as ResolverMap,
  playlistResolvers as ResolverMap,
  reportResolvers as ResolverMap,
  recommendationResolvers as ResolverMap,
  notificationResolvers as ResolverMap,
  statsResolvers as ResolverMap,
  searchResolvers as ResolverMap,
  adminResolvers as ResolverMap,
);
