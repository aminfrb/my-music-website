import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers/render";
import { mockApi, type ApiMock } from "../helpers/api";
import { makeUser, makeMusic, makeConnection } from "../helpers/fixtures";
import { ProfileView } from "@/components/profile/ProfileView";
import type { User } from "@/lib/types";

const auth = vi.hoisted(() => ({
  user: null as User | null,
  refreshMe: vi.fn(async () => {}),
}));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({
    user: auth.user,
    loading: false,
    isAdmin: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshMe: auth.refreshMe,
  }),
}));

// The track grid renders MusicCard, which needs the player.
vi.mock("@/providers/PlayerProvider", () => ({
  usePlayer: () => ({
    playTrack: vi.fn(),
    toggle: vi.fn(),
    isPlaying: false,
    isCurrent: () => false,
  }),
}));

let api: ApiMock;

/** The shape USER_PROFILE returns, with the viewed user's tracks attached. */
function profilePayload(overrides: Partial<User> = {}, tracks = [makeMusic()]) {
  return {
    user: {
      ...makeUser({ id: "u9", displayName: "Ali", ...overrides }),
      music: makeConnection(tracks),
    },
  };
}

beforeEach(() => {
  api = mockApi();
  auth.user = makeUser({ id: "me", displayName: "Me" });
  auth.refreshMe.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe("ProfileView — loading and failure", () => {
  it("shows a spinner while the profile is loading", () => {
    renderWithProviders(<ProfileView userId="u9" />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("offers a retry when the profile can't be fetched", async () => {
    api.fail("boom", "INTERNAL_SERVER_ERROR");
    renderWithProviders(<ProfileView userId="u9" />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument(),
    );

    api.resolve(profilePayload());
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Ali" })).toBeInTheDocument());
  });

  it("treats a missing user as an error rather than rendering a blank page", async () => {
    api.resolve({ user: null });
    renderWithProviders(<ProfileView userId="nope" />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument(),
    );
  });
});

describe("ProfileView — the profile itself", () => {
  it("shows the name, bio and stats", async () => {
    api.resolve(
      profilePayload({
        displayName: "Ali",
        bio: "Beatmaker.",
        followerCount: 1200,
        followingCount: 30,
        trackCount: 8,
        totalPlayCount: 45_000,
      }),
    );
    renderWithProviders(<ProfileView userId="u9" />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Ali" })).toBeInTheDocument());
    expect(screen.getByText("Beatmaker.")).toBeInTheDocument();
    expect(screen.getByText("1.2K")).toBeInTheDocument();
    expect(screen.getByText("45K")).toBeInTheDocument();
  });

  it("lists the user's tracks", async () => {
    api.resolve(
      profilePayload({}, [
        makeMusic({ id: "m1", title: "Seyl" }),
        makeMusic({ id: "m2", title: "Deltangi" }),
      ]),
    );
    renderWithProviders(<ProfileView userId="u9" />);

    await waitFor(() => expect(screen.getByText("Seyl")).toBeInTheDocument());
    expect(screen.getByText("Deltangi")).toBeInTheDocument();
  });

  it("says so when they haven't published anything", async () => {
    api.resolve(profilePayload({}, []));
    renderWithProviders(<ProfileView userId="u9" />);
    await waitFor(() =>
      expect(screen.getByText("No tracks published yet.")).toBeInTheDocument(),
    );
  });

  it("uses Persian digits for the stats in fa", async () => {
    api.resolve(profilePayload({ followerCount: 1200 }));
    renderWithProviders(<ProfileView userId="u9" />, { locale: "fa" });
    await waitFor(() => expect(screen.getByText("۱.۲K")).toBeInTheDocument());
  });
});

describe("ProfileView — following", () => {
  it("follows, and refreshes the profile so the counts update", async () => {
    api.resolve(profilePayload({ isFollowedByMe: false }));
    const user = userEvent.setup();
    renderWithProviders(<ProfileView userId="u9" />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument());
    api.resolve({ followUser: { id: "u9" } });
    api.resolve(profilePayload({ isFollowedByMe: true, followerCount: 13 }));

    await user.click(screen.getByRole("button", { name: "Follow" }));

    // The refetch is what turns the button into "Unfollow".
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Unfollow" })).toBeInTheDocument(),
    );
    expect(api.calls[1].query).toContain("FollowUser");
    expect(api.calls[1].variables).toEqual({ userId: "u9" });
  });

  it("unfollows someone already followed", async () => {
    api.resolve(profilePayload({ isFollowedByMe: true }));
    const user = userEvent.setup();
    renderWithProviders(<ProfileView userId="u9" />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Unfollow" })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Unfollow" }));

    await waitFor(() =>
      expect(api.calls.some((c) => c.query.includes("UnfollowUser"))).toBe(true),
    );
    const call = api.calls.find((c) => c.query.includes("UnfollowUser"));
    expect(call?.variables).toEqual({ userId: "u9" });
  });

  it("explains a failed follow instead of silently resetting", async () => {
    api.resolve(profilePayload());
    const user = userEvent.setup();
    renderWithProviders(<ProfileView userId="u9" />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument());
    api.fail("You are already following this user.", "CONFLICT");

    await user.click(screen.getByRole("button", { name: "Follow" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "You are already following this user.",
      ),
    );
    expect(screen.getByRole("button", { name: "Follow" })).toBeEnabled();
  });

  it("offers a message link only when the user accepts messages", async () => {
    api.resolve(profilePayload({ allowMessages: true }));
    const { unmount } = renderWithProviders(<ProfileView userId="u9" />);
    await waitFor(() =>
      expect(
        screen.getAllByRole("link").some((a) => a.getAttribute("href") === "/messages/u9"),
      ).toBe(true),
    );
    unmount();

    api.resolve(profilePayload({ allowMessages: false }));
    renderWithProviders(<ProfileView userId="u9" />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Ali" })).toBeInTheDocument());
    expect(
      screen.getAllByRole("link").some((a) => a.getAttribute("href") === "/messages/u9"),
    ).toBe(false);
  });

  it("shows no follow controls to a signed-out visitor", async () => {
    auth.user = null;
    api.resolve(profilePayload());
    renderWithProviders(<ProfileView userId="u9" />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Ali" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Follow" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit profile" })).not.toBeInTheDocument();
  });
});

describe("ProfileView — viewing your own profile", () => {
  beforeEach(() => {
    auth.user = makeUser({ id: "u9", displayName: "Ali" });
  });

  it("offers editing rather than following", async () => {
    api.resolve(profilePayload());
    renderWithProviders(<ProfileView userId="u9" />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Edit profile/ })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: "Follow" })).not.toBeInTheDocument();
  });

  it("saves name and bio changes", async () => {
    api.resolve(profilePayload({ displayName: "Ali", bio: "Old bio" }));
    const user = userEvent.setup();
    renderWithProviders(<ProfileView userId="u9" />);

    await user.click(await screen.findByRole("button", { name: /Edit profile/ }));
    const dialog = screen.getByRole("dialog");

    const nameInput = within(dialog).getByDisplayValue("Ali");
    await user.clear(nameInput);
    await user.type(nameInput, "Ali Reza");

    api.resolve({ updateProfile: { id: "u9" } });
    api.resolve(profilePayload({ displayName: "Ali Reza" }));
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      const update = api.calls.find((c) => c.query.includes("UpdateProfile"));
      expect(update?.variables).toEqual({ input: { displayName: "Ali Reza", bio: "Old bio" } });
    });
    // The header refreshes too, so a renamed user isn't stale in the top bar.
    await waitFor(() => expect(auth.refreshMe).toHaveBeenCalled());
  });

  it("only sends the messaging preference when it actually changed", async () => {
    api.resolve(profilePayload({ allowMessages: true }));
    const user = userEvent.setup();
    renderWithProviders(<ProfileView userId="u9" />);

    await user.click(await screen.findByRole("button", { name: /Edit profile/ }));
    const dialog = screen.getByRole("dialog");

    api.resolve({ updateProfile: { id: "u9" } });
    api.resolve(profilePayload());
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(api.calls.length).toBeGreaterThan(1));
    expect(api.calls.some((c) => c.query.includes("SetAllowMessages"))).toBe(false);
  });

  it("sends the messaging preference when it was toggled", async () => {
    api.resolve(profilePayload({ allowMessages: true }));
    const user = userEvent.setup();
    renderWithProviders(<ProfileView userId="u9" />);

    await user.click(await screen.findByRole("button", { name: /Edit profile/ }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("checkbox"));

    api.resolve({ updateProfile: { id: "u9" } });
    api.resolve({ setAllowMessages: { id: "u9" } });
    api.resolve(profilePayload());
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(api.calls.some((c) => c.query.includes("SetAllowMessages"))).toBe(true),
    );
    const call = api.calls.find((c) => c.query.includes("SetAllowMessages"));
    expect(call?.variables).toEqual({ allow: false });
  });

  it("won't let the name be saved blank", async () => {
    api.resolve(profilePayload({ displayName: "Ali" }));
    const user = userEvent.setup();
    renderWithProviders(<ProfileView userId="u9" />);

    await user.click(await screen.findByRole("button", { name: /Edit profile/ }));
    const dialog = screen.getByRole("dialog");
    await user.clear(within(dialog).getByDisplayValue("Ali"));

    expect(within(dialog).getByRole("button", { name: "Save changes" })).toBeDisabled();
  });
});
