import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers/render";
import { mockApi, type ApiMock } from "../helpers/api";
import { makeUser, makeMusic, makePlaylist, makePlaylistItem } from "../helpers/fixtures";
import PlaylistPage from "@/app/playlist/[id]/page";
import type { Playlist, User } from "@/lib/types";

const auth = vi.hoisted(() => ({ user: null as User | null }));
const player = vi.hoisted(() => ({ playQueue: vi.fn(), playTrack: vi.fn(), toggle: vi.fn() }));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({
    user: auth.user,
    loading: false,
    isAdmin: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshMe: vi.fn(),
  }),
}));

vi.mock("@/providers/PlayerProvider", () => ({
  usePlayer: () => ({
    playQueue: player.playQueue,
    playTrack: player.playTrack,
    toggle: player.toggle,
    isPlaying: false,
    isCurrent: () => false,
  }),
}));

let api: ApiMock;

const render = (id = "p1") => renderWithProviders(<PlaylistPage params={{ id }} />);

/**
 * The header's "play the whole playlist" button. Track rows name their own
 * controls after the track ("Play Seyl"), so plain "Play" is unambiguous.
 */
async function headerPlayButton() {
  return screen.findByRole("button", { name: /^(Play|پخش)$/ });
}
const payload = (overrides: Partial<Playlist> = {}) => ({ playlist: makePlaylist(overrides) });

beforeEach(() => {
  api = mockApi();
  auth.user = makeUser({ id: "viewer", displayName: "Viewer" });
  player.playQueue.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe("PlaylistPage — loading and failure", () => {
  it("shows a spinner while loading", () => {
    render();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("offers a retry when the playlist can't be fetched", async () => {
    api.fail("boom", "INTERNAL_SERVER_ERROR");
    render();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument(),
    );
  });

  it("treats a missing playlist as an error, not an empty page", async () => {
    api.resolve({ playlist: null });
    render();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument(),
    );
  });

  it("requests the playlist named in the route", async () => {
    api.resolve(payload());
    render("p42");
    await waitFor(() => expect(api.calls).toHaveLength(1));
    expect(api.calls[0].variables).toEqual({ id: "p42" });
  });
});

describe("PlaylistPage — details", () => {
  it("shows the name, description, owner and counts", async () => {
    api.resolve(
      payload({
        name: "Late Night",
        description: "For the drive home.",
        owner: makeUser({ id: "owner1", displayName: "Ali" }),
        followersCount: 1200,
        trackCount: 3,
      }),
    );
    render();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Late Night" })).toBeInTheDocument(),
    );
    expect(screen.getByText("For the drive home.")).toBeInTheDocument();
    expect(screen.getByText("Ali")).toBeInTheDocument();
    expect(screen.getByText(/1\.2K/)).toBeInTheDocument();
  });

  it("links to the owner's profile", async () => {
    api.resolve(payload({ owner: makeUser({ id: "owner1", displayName: "Ali" }) }));
    render();
    await waitFor(() =>
      expect(
        screen.getAllByRole("link").some((a) => a.getAttribute("href") === "/u/owner1"),
      ).toBe(true),
    );
  });

  it("lists the tracks", async () => {
    api.resolve(
      payload({
        items: [
          makePlaylistItem({ id: "i1", music: makeMusic({ id: "m1", title: "Seyl" }) }),
          makePlaylistItem({ id: "i2", music: makeMusic({ id: "m2", title: "Deltangi" }) }),
        ],
      }),
    );
    render();
    await waitFor(() => expect(screen.getByText("Seyl")).toBeInTheDocument());
    expect(screen.getByText("Deltangi")).toBeInTheDocument();
  });

  it("says so when the playlist is empty", async () => {
    api.resolve(payload({ items: [] }));
    render();
    await waitFor(() =>
      expect(screen.getByText("This playlist is empty.")).toBeInTheDocument(),
    );
  });
});

describe("PlaylistPage — playback", () => {
  it("plays the whole playlist from the top", async () => {
    const items = [
      makePlaylistItem({ id: "i1", music: makeMusic({ id: "m1", title: "Seyl" }) }),
      makePlaylistItem({ id: "i2", music: makeMusic({ id: "m2", title: "Deltangi" }) }),
    ];
    api.resolve(payload({ items }));
    const user = userEvent.setup();
    render();

    await user.click(await headerPlayButton());

    const [queue, index] = player.playQueue.mock.calls[0];
    expect(queue.map((m: { id: string }) => m.id)).toEqual(["m1", "m2"]);
    expect(index).toBe(0);
  });

  it("names each row's control after its track, not just \"Play\"", async () => {
    // A 20-track playlist used to render 21 buttons all named "Play".
    api.resolve(
      payload({
        items: [
          makePlaylistItem({ id: "i1", music: makeMusic({ id: "m1", title: "Seyl" }) }),
          makePlaylistItem({ id: "i2", music: makeMusic({ id: "m2", title: "Deltangi" }) }),
        ],
      }),
    );
    render();

    expect(await screen.findByRole("button", { name: "Play Seyl" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play Deltangi" })).toBeInTheDocument();
    // The header keeps the bare name — it plays the list, not a track.
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("disables play on an empty playlist", async () => {
    api.resolve(payload({ items: [] }));
    render();
    await waitFor(async () => expect(await headerPlayButton()).toBeDisabled());
  });
});

describe("PlaylistPage — following", () => {
  it("follows and unfollows", async () => {
    api.resolve(payload({ isFollowedByMe: false }));
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole("button", { name: "Follow" }));

    await waitFor(() =>
      expect(api.calls.some((c) => c.query.includes("FollowPlaylist"))).toBe(true),
    );
    const call = api.calls.find((c) => c.query.includes("FollowPlaylist"));
    expect(call?.variables).toEqual({ playlistId: "p1" });
  });

  it("explains a failed follow instead of silently resetting", async () => {
    api.resolve(payload());
    const user = userEvent.setup();
    render();

    await screen.findByRole("button", { name: "Follow" });
    api.fail("You already follow this playlist.", "CONFLICT");

    await user.click(screen.getByRole("button", { name: "Follow" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "You already follow this playlist.",
      ),
    );
    expect(screen.getByRole("button", { name: "Follow" })).toBeEnabled();
  });

  it("hides the follow control from the owner — you can't follow your own list", async () => {
    auth.user = makeUser({ id: "owner1" });
    api.resolve(payload({ owner: makeUser({ id: "owner1", displayName: "Ali" }) }));
    render();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Late Night" })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: "Follow" })).not.toBeInTheDocument();
  });

  it("hides the follow control from a signed-out visitor", async () => {
    auth.user = null;
    api.resolve(payload());
    render();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Late Night" })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: "Follow" })).not.toBeInTheDocument();
  });
});

describe("PlaylistPage — removing tracks", () => {
  const ownedPayload = () =>
    payload({
      owner: makeUser({ id: "owner1", displayName: "Ali" }),
      items: [
        makePlaylistItem({ id: "i1", music: makeMusic({ id: "m1", title: "Seyl" }) }),
        makePlaylistItem({ id: "i2", music: makeMusic({ id: "m2", title: "Deltangi" }) }),
      ],
    });

  it("lets the owner remove a track", async () => {
    auth.user = makeUser({ id: "owner1" });
    api.resolve(ownedPayload());
    const user = userEvent.setup();
    render();

    const buttons = await screen.findAllByRole("button", { name: "Remove" });
    expect(buttons).toHaveLength(2);

    await user.click(buttons[1]);

    await waitFor(() =>
      expect(api.calls.some((c) => c.query.includes("RemoveFromPlaylist"))).toBe(true),
    );
    const call = api.calls.find((c) => c.query.includes("RemoveFromPlaylist"));
    // The second row's track, not the first.
    expect(call?.variables).toEqual({ playlistId: "p1", musicId: "m2" });
  });

  it("offers no remove control to a non-owner", async () => {
    api.resolve(ownedPayload());
    render();

    await waitFor(() => expect(screen.getByText("Seyl")).toBeInTheDocument());
    expect(
      screen.queryByRole("button", { name: "Remove" }),
    ).not.toBeInTheDocument();
  });
});

describe("PlaylistPage — Persian", () => {
  it("renders its copy and digits in fa", async () => {
    api.resolve(payload({ followersCount: 42 }));
    renderWithProviders(<PlaylistPage params={{ id: "p1" }} />, { locale: "fa" });

    await waitFor(async () => expect(await headerPlayButton()).toBeInTheDocument());
    expect(screen.getByText(/۴۲/)).toBeInTheDocument();
    // The counts line interpolates several nodes, so match on the container.
    expect(screen.getByText(/دنبال‌کننده/)).toBeInTheDocument();
  });
});
