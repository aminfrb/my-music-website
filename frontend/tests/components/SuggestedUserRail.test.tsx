import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers/render";
import { makeSuggestedUser, makeUser, makeGenre } from "../helpers/fixtures";
import { SuggestedUserRail } from "@/components/profile/SuggestedUserRail";

const gqlMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/graphql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/graphql")>();
  return { ...actual, gql: gqlMock };
});

beforeEach(() => gqlMock.mockReset());

/**
 * Recommending people, not just tracks, is what makes the social signals in the
 * ranker get stronger over time — so following has to be possible from the card
 * itself, without a detour through a profile page.
 */
describe("SuggestedUserRail", () => {
  it("renders nothing when there is no one to suggest", () => {
    const { container } = renderWithProviders(<SuggestedUserRail suggestions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the section heading once there is someone", () => {
    renderWithProviders(<SuggestedUserRail suggestions={[makeSuggestedUser()]} />);
    expect(screen.getByRole("heading", { name: "People to follow" })).toBeInTheDocument();
  });

  it("shows each person's name and the reason they were suggested", () => {
    renderWithProviders(
      <SuggestedUserRail
        suggestions={[
          makeSuggestedUser({
            user: makeUser({ id: "u1", displayName: "Sara" }),
            reason: "You like their tracks",
          }),
          makeSuggestedUser({
            user: makeUser({ id: "u2", displayName: "Reza" }),
            reason: "Followed by 3 people you follow",
          }),
        ]}
      />,
    );
    expect(screen.getByText("Sara")).toBeInTheDocument();
    expect(screen.getByText("You like their tracks")).toBeInTheDocument();
    expect(screen.getByText("Reza")).toBeInTheDocument();
    expect(screen.getByText("Followed by 3 people you follow")).toBeInTheDocument();
  });

  it("links each card to that person's profile", () => {
    renderWithProviders(
      <SuggestedUserRail
        suggestions={[makeSuggestedUser({ user: makeUser({ id: "u42" }) })]}
      />,
    );
    expect(
      screen.getAllByRole("link").some((a) => a.getAttribute("href") === "/u/u42"),
    ).toBe(true);
  });

  it("shows the genres they have in common, capped at two", () => {
    renderWithProviders(
      <SuggestedUserRail
        suggestions={[
          makeSuggestedUser({
            sharedGenres: [
              makeGenre({ id: "g1", name: "Rap" }),
              makeGenre({ id: "g2", name: "Pop" }),
              makeGenre({ id: "g3", name: "Rock" }),
            ],
          }),
        ]}
      />,
    );
    expect(screen.getByText("Rap")).toBeInTheDocument();
    expect(screen.getByText("Pop")).toBeInTheDocument();
    // A card is small; a third badge would wrap and push the button off.
    expect(screen.queryByText("Rock")).not.toBeInTheDocument();
  });

  it("shows follower and track counts", () => {
    renderWithProviders(
      <SuggestedUserRail
        suggestions={[
          makeSuggestedUser({
            user: makeUser({ followerCount: 1200, trackCount: 8 }),
          }),
        ]}
      />,
    );
    expect(screen.getByText(/1\.2K followers/)).toBeInTheDocument();
    expect(screen.getByText(/8 tracks/)).toBeInTheDocument();
  });

  it("marks the verified artists", () => {
    const { container } = renderWithProviders(
      <SuggestedUserRail
        suggestions={[
          makeSuggestedUser({ user: makeUser({ id: "u1", isVerifiedArtist: true }) }),
        ]}
      />,
    );
    expect(container.querySelector("svg.lucide-badge-check")).toBeTruthy();
  });

  describe("following", () => {
    it("follows the right person when there are several cards", async () => {
      gqlMock.mockResolvedValue({});
      const user = userEvent.setup();
      renderWithProviders(
        <SuggestedUserRail
          suggestions={[
            makeSuggestedUser({ user: makeUser({ id: "u1", displayName: "Sara" }) }),
            makeSuggestedUser({ user: makeUser({ id: "u2", displayName: "Reza" }) }),
          ]}
        />,
      );

      await user.click(screen.getAllByRole("button", { name: "Follow" })[1]);

      await waitFor(() => expect(gqlMock).toHaveBeenCalledOnce());
      expect(gqlMock.mock.calls[0][1]).toEqual({ userId: "u2" });
    });

    it("refreshes the recommendation rows, since following reshapes them", async () => {
      gqlMock.mockResolvedValue({});
      const user = userEvent.setup();
      const { queryClient } = renderWithProviders(
        <SuggestedUserRail suggestions={[makeSuggestedUser()]} />,
      );
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");

      await user.click(screen.getByRole("button", { name: "Follow" }));

      await waitFor(() => expect(invalidate).toHaveBeenCalled());
      const keys = invalidate.mock.calls.map((c) => JSON.stringify(c[0]));
      expect(keys.some((k) => k.includes("recommendationSections"))).toBe(true);
      expect(keys.some((k) => k.includes("followingFeed"))).toBe(true);
    });

    it("offers to unfollow someone already followed", async () => {
      gqlMock.mockResolvedValue({});
      const user = userEvent.setup();
      renderWithProviders(
        <SuggestedUserRail
          suggestions={[
            makeSuggestedUser({ user: makeUser({ id: "u1", isFollowedByMe: true }) }),
          ]}
        />,
      );

      const button = screen.getByRole("button", { name: "Following" });
      await user.click(button);

      await waitFor(() => expect(gqlMock).toHaveBeenCalledOnce());
      expect(gqlMock.mock.calls[0][0]).toContain("UnfollowUser");
    });
  });

  describe("Persian", () => {
    it("renders its own copy in fa", () => {
      renderWithProviders(<SuggestedUserRail suggestions={[makeSuggestedUser()]} />, {
        locale: "fa",
      });
      expect(
        screen.getByRole("heading", { name: "افرادی برای دنبال کردن" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "دنبال کردن" })).toBeInTheDocument();
    });

    it("uses Persian digits for counts", () => {
      renderWithProviders(
        <SuggestedUserRail
          suggestions={[makeSuggestedUser({ user: makeUser({ followerCount: 42 }) })]}
        />,
        { locale: "fa" },
      );
      expect(screen.getByText(/۴۲/)).toBeInTheDocument();
    });
  });
});
