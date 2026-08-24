import crypto from "node:crypto";
import { Readable } from "node:stream";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env";
import { errors } from "../utils/errors";
import { formatBytes, sniffAudio, sniffImage, type SniffResult } from "./validation";
import { probeAudio, type AudioProbe } from "./probe";

/**
 * How much of the object we keep in memory while streaming it. Enough for an
 * ID3 tag plus the MP4 `moov` atom and a healthy run of MPEG frames, without
 * buffering a whole 50 MB upload.
 */
const HEAD_BYTES = 512 * 1024;

export const s3 = new S3Client({
  region: env.s3.region,
  endpoint: env.s3.endpoint,
  forcePathStyle: env.s3.forcePathStyle,
  credentials: {
    accessKeyId: env.s3.accessKeyId,
    secretAccessKey: env.s3.secretAccessKey,
  },
});

/** Drain a stream into a Buffer with a hard byte ceiling (anti-DoS). */
export async function readStreamToBuffer(
  stream: Readable,
  maxBytes: number,
  kind: string,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buf = chunk as Buffer;
    total += buf.length;
    if (total > maxBytes) {
      stream.destroy();
      throw errors.badInput("errors.fileTooLarge", { kind, max: formatBytes(maxBytes) });
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.s3.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.length,
    }),
  );
}

/** Short-lived presigned GET URL (playback / cover). Honors HTTP Range → seekable. */
export function presignGetUrl(key: string, ttlSeconds = env.s3.getTtl): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: env.s3.bucket, Key: key }), {
    expiresIn: ttlSeconds,
  });
}

/** Short-lived presigned PUT URL for direct client-to-storage upload. */
export function presignPutUrl(
  key: string,
  contentType: string,
  ttlSeconds = env.s3.putTtl,
): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: env.s3.bucket, Key: key, ContentType: contentType }),
    { expiresIn: ttlSeconds },
  );
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: env.s3.bucket, Key: key })).catch(() => undefined);
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: env.s3.bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export interface InspectedObject {
  size: number;
  hash: string; // sha256 hex
  sniff: SniffResult | null;
  /** Container-level decode of the audio (null for images / unknown types). */
  probe: AudioProbe | null;
}

/**
 * Stream an already-uploaded object from storage once to compute its SHA-256
 * (for dedup) and sniff its true type from the leading bytes (upload security).
 * Used to validate signed-URL uploads — we never trust the client-declared type.
 */
export async function inspectObject(
  key: string,
  kind: "audio" | "image",
  maxBytes: number,
): Promise<InspectedObject> {
  const res = await s3.send(new GetObjectCommand({ Bucket: env.s3.bucket, Key: key }));
  const body = res.Body as Readable | undefined;
  if (!body) throw errors.badInput("errors.fileRequired");

  const hash = crypto.createHash("sha256");
  const headTarget = kind === "audio" ? HEAD_BYTES : 32;
  const headChunks: Buffer[] = [];
  let headLength = 0;
  let size = 0;

  for await (const chunk of body) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > maxBytes) {
      body.destroy();
      throw errors.badInput("errors.fileTooLarge", { kind, max: formatBytes(maxBytes) });
    }
    if (headLength < headTarget) {
      headChunks.push(buf);
      headLength += buf.length;
    }
    hash.update(buf);
  }

  const head = Buffer.concat(headChunks).subarray(0, headTarget);
  const sniff = kind === "audio" ? sniffAudio(head) : sniffImage(head);
  const probe = kind === "audio" ? probeAudio(head, size) : null;
  return { size, hash: hash.digest("hex"), sniff, probe };
}
