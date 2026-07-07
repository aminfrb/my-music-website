import { z } from "zod";
import { User, RefreshToken, type IUser } from "../models";
import { env } from "../config/env";
import { hashPassword, verifyPassword } from "../auth/password";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  newTokenId,
  ttlToDate,
} from "../auth/jwt";
import { errors } from "../utils/errors";
import { isSupportedLocale } from "../i18n";

const registerSchema = z.object({
  email: z.string().email().toLowerCase(),
  displayName: z.string().min(1).max(60),
  password: z.string().min(8).max(128),
  mobileNumber: z
    .string()
    .regex(/^[+]?[0-9]{8,15}$/)
    .optional(),
  locale: z.enum(["en", "fa"]).optional(),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: IUser;
}

async function issueTokens(user: IUser): Promise<AuthResult> {
  const accessToken = signAccessToken(user._id.toString(), user.role);
  const jti = newTokenId();
  const refreshToken = signRefreshToken(user._id.toString(), jti);
  await RefreshToken.create({
    tokenHash: hashToken(refreshToken),
    user: user._id,
    expiresAt: ttlToDate(env.jwt.refreshTtl),
  });
  return { accessToken, refreshToken, user };
}

export const authService = {
  async register(input: unknown): Promise<AuthResult> {
    const data = parse(registerSchema, input);

    const existing = await User.findOne({ email: data.email }).lean().exec();
    if (existing) throw errors.conflict("errors.emailTaken");

    const user = await User.create({
      email: data.email,
      displayName: data.displayName,
      passwordHash: await hashPassword(data.password),
      mobileNumber: data.mobileNumber ?? null,
      locale: isSupportedLocale(data.locale) ? data.locale : "en",
    });
    return issueTokens(user);
  },

  async login(input: unknown): Promise<AuthResult> {
    const data = parse(loginSchema, input);
    const user = await User.findOne({ email: data.email });
    const ok = user
      ? await verifyPassword(data.password, user.passwordHash)
      : await verifyPassword(data.password, "$2a$12$invalidinvalidinvalidinvalidinvalidinv");
    if (!user || !ok) throw errors.badInput("errors.invalidCredentials");
    if (user.status === "blocked") throw errors.forbidden("errors.accountBlocked");
    return issueTokens(user);
  },

  async refresh(refreshToken: string): Promise<AuthResult> {
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) throw errors.unauthenticated("errors.invalidToken");

    const stored = await RefreshToken.findOne({ tokenHash: hashToken(refreshToken) });
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
      throw errors.unauthenticated("errors.invalidToken");
    }
    const user = await User.findById(payload.sub);
    if (!user || user.status === "blocked") throw errors.unauthenticated("errors.invalidToken");

    stored.revokedAt = new Date();
    await stored.save();
    return issueTokens(user);
  },

  async logout(refreshToken: string | null | undefined): Promise<boolean> {
    if (!refreshToken) return true;
    await RefreshToken.updateOne(
      { tokenHash: hashToken(refreshToken), revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    return true;
  },
};

/** Run a zod schema, mapping failures to a localized BAD_USER_INPUT error. */
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    throw errors.badInput("errors.validation", {
      field: first?.path.join(".") ?? "",
      detail: first?.message ?? "",
    });
  }
  return result.data;
}
