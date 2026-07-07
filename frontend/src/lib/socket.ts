// Browser WebSocket client for realtime direct messages. No third-party
// dependency — it uses the native WebSocket. A single connection is shared
// app-wide; handlers subscribe by event type. Reconnects with backoff while a
// session is active.

import { getAccessToken } from "./graphql";

type Handler = (data: unknown) => void;

const handlers = new Map<string, Set<Handler>>();
let socket: WebSocket | null = null;
let shouldRun = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let attempts = 0;

function wsUrl(): string | null {
  const token = getAccessToken();
  if (!token) return null;
  const explicit = process.env.NEXT_PUBLIC_WS_URL;
  const base =
    explicit ??
    (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/graphql")
      .replace(/^http/, "ws")
      .replace(/\/graphql\/?$/, "/ws");
  return `${base}?token=${encodeURIComponent(token)}`;
}

function dispatch(type: string, data: unknown) {
  handlers.get(type)?.forEach((h) => {
    try {
      h(data);
    } catch {
      /* handler errors shouldn't break the socket */
    }
  });
}

function open() {
  if (typeof window === "undefined") return;
  const url = wsUrl();
  if (!url) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const ws = new WebSocket(url);
  socket = ws;

  ws.onopen = () => {
    attempts = 0;
  };
  ws.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data) as { type?: string; data?: unknown };
      if (parsed.type) dispatch(parsed.type, parsed.data);
    } catch {
      /* ignore malformed frames */
    }
  };
  ws.onclose = () => {
    socket = null;
    if (!shouldRun) return;
    // Reconnect with capped backoff.
    attempts += 1;
    const delay = Math.min(1000 * 2 ** attempts, 15_000);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(open, delay);
  };
  ws.onerror = () => {
    ws.close();
  };
}

export function connectSocket() {
  shouldRun = true;
  open();
}

export function disconnectSocket() {
  shouldRun = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
}

/** Subscribe to a server event; returns an unsubscribe function. */
export function onSocket(type: string, handler: Handler): () => void {
  let set = handlers.get(type);
  if (!set) {
    set = new Set();
    handlers.set(type, set);
  }
  set.add(handler);
  return () => {
    set?.delete(handler);
  };
}

/** Send a lightweight client event (currently just typing relays). */
export function sendSocket(payload: Record<string, unknown>) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}
