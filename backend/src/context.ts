import type { Request } from "express";
import { User, type IUser } from "./models";
import { verifyAccessToken } from "./auth/jwt";
import { getLocale, type Locale } from "./i18n";
import { errors } from "./utils/errors";
import type { Role } from "./constants";

export interface Context {
  user: IUser | null;
  locale: Locale;
  ip: string;
  /** Returns the current user or throws UNAUTHENTICATED. */
  requireUser: () => IUser;
  /** Returns the current user if it holds one of `roles`, else throws FORBIDDEN. */
  requireRole: (...roles: Role[]) => IUser;
}

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

export async function buildContext({ req }: { req: Request }): Promise<Context> {
  const header = req.headers.authorization;
  let user: IUser | null = null;

  if (header?.startsWith("Bearer ")) {
    const payload = verifyAccessToken(header.slice(7));
    if (payload) {
      const found = await User.findById(payload.sub);
      if (found && found.status === "active") user = found;
    }
  }

  return {
    user,
    locale: getLocale(),
    ip: clientIp(req),
    requireUser() {
      if (!user) throw errors.unauthenticated();
      return user;
    },
    requireRole(...roles: Role[]) {
      if (!user) throw errors.unauthenticated();
      if (!roles.includes(user.role)) throw errors.forbidden();
      return user;
    },
  };
}
