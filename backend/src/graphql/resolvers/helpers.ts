import { presignGetUrl } from "../../upload/storage";

/** Map a Mongoose (possibly lean) document's `_id` to the GraphQL `id`. */
export function idOf(parent: { _id?: { toString(): string }; id?: string }): string {
  return parent?._id?.toString() ?? parent?.id ?? "";
}

/** Presign a media key for client playback/display (null-safe). */
export function mediaUrl(key?: string | null): Promise<string> | null {
  return key ? presignGetUrl(key) : null;
}

/** Standard `id` field resolver attachable to any document-backed type. */
export const idResolver = { id: idOf };
