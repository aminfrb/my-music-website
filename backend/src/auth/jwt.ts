import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import type { Role } from "../constants";

export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string; // token id, stored (hashed) for revocation
  type: "refresh";
}

export function signAccessToken(userId: string, role: Role): string {
  const payload: AccessTokenPayload = { sub: userId, role, type: "access" };
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessTtl,
  } as SignOptions);
}

export function signRefreshToken(userId: string, jti: string): string {
  const payload: RefreshTokenPayload = { sub: userId, jti, type: "refresh" };
  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshTtl,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
    return decoded.type === "access" ? decoded : null;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.jwt.refreshSecret) as RefreshTokenPayload;
    return decoded.type === "refresh" ? decoded : null;
  } catch {
    return null;
  }
}

/** Refresh tokens are stored only as a SHA-256 hash, never in plaintext. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function newTokenId(): string {
  return crypto.randomUUID();
}

/** Convert a TTL string like "30d" / "15m" into a future Date. */
export function ttlToDate(ttl: string, from: Date = new Date()): Date {
  const match = /^(\d+)\s*([smhd])$/.exec(ttl.trim());
  if (!match) {
    // Treat as seconds if a bare number, else default to 30 days.
    const asNum = Number.parseInt(ttl, 10);
    const seconds = Number.isNaN(asNum) ? 60 * 60 * 24 * 30 : asNum;
    return new Date(from.getTime() + seconds * 1000);
  }
  const value = Number.parseInt(match[1], 10);
  const unit = match[2];
  const factor = { s: 1, m: 60, h: 3600, d: 86400 }[unit]!;
  return new Date(from.getTime() + value * factor * 1000);
}
