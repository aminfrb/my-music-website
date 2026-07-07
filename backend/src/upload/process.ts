import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { env } from "../config/env";
import { errors } from "../utils/errors";
import { readStreamToBuffer, putObject } from "./storage";
import { sniffAudio, sniffImage } from "./validation";

// graphql-upload resolves the Upload scalar to a promise of this shape.
export interface FileUpload {
  filename: string;
  mimetype: string;
  encoding: string;
  createReadStream: () => Readable;
}

export type UploadArg = Promise<FileUpload> | FileUpload;

export interface StoredObject {
  key: string;
  mime: string;
  bytes: number;
}

async function resolveUpload(arg: UploadArg): Promise<FileUpload> {
  const file = await arg;
  if (!file || typeof file.createReadStream !== "function") {
    throw errors.badInput("errors.fileRequired");
  }
  return file;
}

/**
 * Buffer an audio upload (size-guarded), verify its true type by magic number,
 * then persist it to object storage under `audio/<uuid>.<ext>`.
 */
export async function processAudioUpload(arg: UploadArg): Promise<StoredObject> {
  const file = await resolveUpload(arg);
  const buf = await readStreamToBuffer(
    file.createReadStream(),
    env.uploads.maxAudioBytes,
    "audio",
  );
  const sniff = sniffAudio(buf);
  if (!sniff) throw errors.badInput("errors.invalidAudioType");

  const key = `audio/${randomUUID()}.${sniff.ext}`;
  await putObject(key, buf, sniff.mime);
  return { key, mime: sniff.mime, bytes: buf.length };
}

/**
 * Same flow for cover art / avatars: size guard → magic-number check → store
 * under `covers/<uuid>.<ext>`.
 */
export async function processImageUpload(arg: UploadArg): Promise<StoredObject> {
  const file = await resolveUpload(arg);
  const buf = await readStreamToBuffer(
    file.createReadStream(),
    env.uploads.maxImageBytes,
    "image",
  );
  const sniff = sniffImage(buf);
  if (!sniff) throw errors.badInput("errors.invalidImageType");

  const key = `covers/${randomUUID()}.${sniff.ext}`;
  await putObject(key, buf, sniff.mime);
  return { key, mime: sniff.mime, bytes: buf.length };
}
