import "./bootstrap/suppressWarnings"; // must be first — installs warning filter before AWS SDK loads
import http from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { ApolloServerPluginLandingPageDisabled } from "@apollo/server/plugin/disabled";
import { graphqlUploadExpress } from "graphql-upload-minimal";

import { env } from "./config/env";
import { logger } from "./utils/logger";
import { schema } from "./graphql/schema";
import { buildContext, type Context } from "./context";
import { resolveLocale, runWithLocale, t, getLocale } from "./i18n";
import { graphqlConsole } from "./rest/console";
import { connectDb, disconnectDb } from "./db/mongoose";

async function main() {
  await connectDb();

  const app = express();
  const httpServer = http.createServer(app);

  app.disable("x-powered-by");
  app.use(
    helmet({
      // Apollo Sandbox loads from a CDN; relax CSP in dev so it renders.
      contentSecurityPolicy: env.isProd ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Resolve the request locale once and run the whole request inside its
  // AsyncLocalStorage scope so services, resolvers, and formatError can use it.
  app.use((req, _res, next) => {
    const locale = resolveLocale(
      (req.headers["x-locale"] as string) ?? null,
      req.headers["accept-language"] ?? null,
    );
    runWithLocale(locale, () => next());
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "harmony-backend" });
  });

  // Offline, self-contained GraphQL console for GET /graphql (POST still hits Apollo).
  // Registered before the Apollo mount so it takes precedence for GET requests.
  app.get("/graphql", graphqlConsole);

  const apollo = new ApolloServer<Context>({
    schema,
    introspection: true, // keep on; the frontend tooling relies on it
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      // Disable Apollo's CDN-hosted landing page (we serve our own offline console).
      ApolloServerPluginLandingPageDisabled(),
    ],
    formatError(formatted) {
      const ext = (formatted.extensions ?? {}) as {
        code?: string;
        messageKey?: string;
        params?: Record<string, string | number>;
      };
      // Re-localize application errors against the active request locale.
      if (ext.messageKey) {
        return {
          message: t(ext.messageKey, ext.params, getLocale()),
          extensions: { code: ext.code ?? "INTERNAL_SERVER_ERROR" },
          path: formatted.path,
          locations: formatted.locations,
        };
      }
      // Mask unexpected internal errors in production.
      if (env.isProd && ext.code === "INTERNAL_SERVER_ERROR") {
        logger.error("internal graphql error", { message: formatted.message });
        return { message: t("errors.internal"), extensions: { code: ext.code } };
      }
      return formatted;
    },
  });

  await apollo.start();

  app.use(
    "/graphql",
    cors({
      origin: env.corsOrigins.length ? env.corsOrigins : true,
      credentials: true,
    }),
    // Parse multipart file uploads (graphql-upload). Caps total file size/count
    // before any handler runs; the per-kind limits are re-checked while streaming.
    graphqlUploadExpress({
      maxFileSize: env.uploads.maxAudioBytes,
      maxFiles: 2,
    }),
    express.json({ limit: "1mb" }),
    expressMiddleware(apollo, {
      context: ({ req }) => buildContext({ req }),
    }),
  );

  await new Promise<void>((resolve) =>
    httpServer.listen({ port: env.port }, resolve),
  );
  logger.info("Harmony backend ready", {
    url: `${env.publicUrl}/graphql`,
    env: env.nodeEnv,
  });
}

main().catch(async (err) => {
  logger.error("fatal startup error", { error: (err as Error).message });
  await disconnectDb();
  process.exit(1);
});

// Graceful shutdown.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    logger.info("shutting down", { signal });
    await disconnectDb();
    process.exit(0);
  });
}
