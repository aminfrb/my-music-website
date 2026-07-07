import type { Context } from "../../context";
import { authService } from "../../services/auth.service";
import { authLimiter } from "../../middleware/rateLimit";

export const authResolvers = {
  Mutation: {
    register(_p: unknown, { input }: { input: unknown }, ctx: Context) {
      authLimiter.consume(`register:${ctx.ip}`);
      return authService.register(input);
    },
    login(_p: unknown, { input }: { input: unknown }, ctx: Context) {
      authLimiter.consume(`login:${ctx.ip}`);
      return authService.login(input);
    },
    refreshToken(_p: unknown, { refreshToken }: { refreshToken: string }, ctx: Context) {
      authLimiter.consume(`refresh:${ctx.ip}`);
      return authService.refresh(refreshToken);
    },
    logout(_p: unknown, { refreshToken }: { refreshToken?: string | null }) {
      return authService.logout(refreshToken);
    },
  },
};
