import { vi } from "vitest";

interface GqlCall {
  query: string;
  variables: Record<string, unknown>;
}

/**
 * Stub the network rather than the `gql` module.
 *
 * Mocking `gql` itself means a failure test has to hand back a rejected
 * promise, and the runner reports that handled rejection as an unhandled
 * error. Stubbing `fetch` avoids it and is more faithful anyway: the real
 * client runs, so error shapes, `GraphQLError` construction and the
 * `extensions.details` channel are all exercised rather than assumed.
 */
export interface ApiMock {
  /** Every GraphQL operation sent, in order. */
  calls: GqlCall[];
  /** Queue a successful payload for the next operation. */
  resolve(data?: unknown): void;
  /** Queue a GraphQL error for the next operation. */
  fail(message: string, code?: string, details?: Record<string, unknown>): void;
  /** Queue a transport failure — no response at all. */
  failNetwork(message?: string): void;
  fetch: ReturnType<typeof vi.fn>;
}

type Queued =
  | { kind: "data"; body: unknown }
  | { kind: "network"; message: string };

export function mockApi(): ApiMock {
  const calls: GqlCall[] = [];
  const queue: Queued[] = [];

  const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
    const parsed = JSON.parse(init.body) as GqlCall;
    calls.push({ query: parsed.query, variables: parsed.variables ?? {} });

    const next = queue.shift() ?? { kind: "data" as const, body: { data: {} } };
    if (next.kind === "network") throw new TypeError(next.message);
    return { ok: true, json: async () => next.body };
  });

  vi.stubGlobal("fetch", fetchMock);

  return {
    calls,
    fetch: fetchMock,
    resolve(data: unknown = {}) {
      queue.push({ kind: "data", body: { data } });
    },
    fail(message: string, code = "BAD_USER_INPUT", details?: Record<string, unknown>) {
      queue.push({
        kind: "data",
        body: { errors: [{ message, extensions: { code, ...(details ? { details } : {}) } }] },
      });
    },
    failNetwork(message = "Failed to fetch") {
      queue.push({ kind: "network", message });
    },
  };
}
