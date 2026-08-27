import { mediaUrlFor } from "../../upload/storage";

/** Map a Mongoose (possibly lean) document's `_id` to the GraphQL `id`. */
export function idOf(parent: { _id?: { toString(): string }; id?: string }): string {
  return parent?._id?.toString() ?? parent?.id ?? "";
}

/** Client-facing URL for a media key (null-safe). */
export function mediaUrl(key?: string | null): string | Promise<string> | null {
  return key ? mediaUrlFor(key) : null;
}

/** Standard `id` field resolver attachable to any document-backed type. */
export const idResolver = { id: idOf };
