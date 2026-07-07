import { Types } from "mongoose";
import { errors } from "./errors";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export interface PageArgs {
  first?: number | null;
  after?: string | null; // opaque cursor (an ObjectId hex string)
}

export interface Connection<T> {
  edges: { cursor: string; node: T }[];
  nodes: T[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
  totalCount: number;
}

export function clampLimit(first?: number | null): number {
  if (first == null) return DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(first) || first <= 0) throw errors.badInput();
  return Math.min(first, MAX_PAGE_SIZE);
}

/**
 * Build a `_id`-descending cursor filter. Newest-first lists paginate by passing
 * the last seen id as `after`; results then continue with strictly older ids.
 */
export function afterIdFilter(after?: string | null): Record<string, unknown> {
  if (!after) return {};
  if (!Types.ObjectId.isValid(after)) throw errors.badInput();
  return { _id: { $lt: new Types.ObjectId(after) } };
}

/**
 * Assemble a relay-style connection from an over-fetched row set
 * (`rows` should hold up to `limit + 1` items; the extra one flags more pages).
 */
export function buildConnection<T>(
  rows: T[],
  limit: number,
  totalCount: number,
  cursorOf: (row: T) => string,
): Connection<T> {
  const hasNextPage = rows.length > limit;
  const nodes = hasNextPage ? rows.slice(0, limit) : rows;
  return {
    nodes,
    edges: nodes.map((node) => ({ cursor: cursorOf(node), node })),
    pageInfo: {
      hasNextPage,
      endCursor: nodes.length ? cursorOf(nodes[nodes.length - 1]) : null,
    },
    totalCount,
  };
}

/** Cursor extractor for documents that expose `_id`. */
export function idCursor(row: { _id: Types.ObjectId }): string {
  return row._id.toString();
}
