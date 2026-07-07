import type { Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { verifyAccessToken } from "../auth/jwt";
import { logger } from "../utils/logger";

/**
 * Minimal authenticated WebSocket hub for realtime direct messages.
 *
 * Browsers cannot set custom headers on a WebSocket handshake, so the JWT access
 * token is passed as a `?token=` query parameter. Each socket is mapped to its
 * user id; `emitToUser` fans a payload out to every live socket for that user
 * (multiple tabs/devices). A ping/pong heartbeat drops dead connections.
 */

interface AuthedSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

const userSockets = new Map<string, Set<AuthedSocket>>();
let wss: WebSocketServer | null = null;

export function initRealtime(httpServer: HttpServer): void {
  wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (socket: AuthedSocket, req) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const token = url.searchParams.get("token");
    const payload = token ? verifyAccessToken(token) : null;
    if (!payload) {
      socket.close(4401, "unauthorized");
      return;
    }

    const userId = payload.sub;
    socket.userId = userId;
    socket.isAlive = true;

    let set = userSockets.get(userId);
    if (!set) {
      set = new Set();
      userSockets.set(userId, set);
    }
    set.add(socket);

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("message", (raw) => {
      // The only client→server event is a lightweight typing relay.
      try {
        const msg = JSON.parse(raw.toString()) as { type?: string; toUserId?: string };
        if (msg.type === "typing" && typeof msg.toUserId === "string") {
          emitToUser(msg.toUserId, "typing", { fromUserId: userId });
        }
      } catch {
        /* ignore malformed frames */
      }
    });

    socket.on("close", () => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket);
        if (sockets.size === 0) userSockets.delete(userId);
      }
    });

    socket.send(JSON.stringify({ type: "ready", data: { userId } }));
  });

  const heartbeat = setInterval(() => {
    wss?.clients.forEach((client) => {
      const socket = client as AuthedSocket;
      if (socket.isAlive === false) {
        socket.terminate();
        return;
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, 30_000);

  wss.on("close", () => clearInterval(heartbeat));

  logger.info("realtime websocket ready", { path: "/ws" });
}

/** Push an event to all live sockets belonging to a user (no-op if offline). */
export function emitToUser(userId: string, type: string, data: unknown): void {
  const sockets = userSockets.get(userId);
  if (!sockets || sockets.size === 0) return;
  const payload = JSON.stringify({ type, data });
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) socket.send(payload);
  }
}
