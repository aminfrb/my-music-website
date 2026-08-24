import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers/render";
import { makeDuplicate } from "../helpers/fixtures";
import { DuplicateNotice } from "@/components/music/DuplicateNotice";

const gqlMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/graphql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/graphql")>();
  return { ...actual, gql: gqlMock };
});

beforeEach(() => gqlMock.mockReset());

/**
 * Rejecting an upload as a duplicate is a dead end unless it tells the user who
 * got there first. This component is the difference between "error" and "here's
 * the person who posted it — follow them".
 */
describe("DuplicateNotice", () => {
  const message = '"Seyl" by Mehrad Hidden has already been uploaded by Ali.';

  it("shows the server's message", () => {
    renderWithProviders(
      <DuplicateNotice duplicate={makeDuplicate()} message={message} />,
    );
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("names the original uploader", () => {
    renderWithProviders(
      <DuplicateNotice duplicate={makeDuplicate()} message={message} />,
    );
    expect(screen.getByText("Ali")).toBeInTheDocument();
  });

  it("links to the uploader's profile and to the existing track", () => {
    renderWithProviders(
      <DuplicateNotice
        duplicate={makeDuplicate({ musicId: "m42", uploader: { id: "u9", displayName: "Ali", avatarUrl: null, isVerifiedArtist: false } })}
        message={message}
      />,
    );
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/u/u9");
    expect(hrefs).toContain("/music/m42");
  });

  it("explains a same-song collision differently from a same-file one", () => {
    const { unmount } = renderWithProviders(
      <DuplicateNotice duplicate={makeDuplicate({ kind: "song" })} message={message} />,
    );
    expect(screen.getByText(/already been posted/i)).toBeInTheDocument();
    unmount();

    renderWithProviders(
      <DuplicateNotice duplicate={makeDuplicate({ kind: "file" })} message={message} />,
    );
    expect(screen.getByText(/exact audio file/i)).toBeInTheDocument();
  });

  it("shows a verified badge for a verified artist", () => {
    const { container } = renderWithProviders(
      <DuplicateNotice
        duplicate={makeDuplicate({
          uploader: { id: "u9", displayName: "Ali", avatarUrl: null, isVerifiedArtist: true },
        })}
        message={message}
      />,
    );
    expect(container.querySelector("svg.lucide-badge-check")).toBeTruthy();
  });

  describe("following from the notice", () => {
    it("sends the follow mutation for the original uploader", async () => {
      gqlMock.mockResolvedValue({});
      const user = userEvent.setup();
      renderWithProviders(
        <DuplicateNotice duplicate={makeDuplicate()} message={message} />,
      );

      await user.click(screen.getByRole("button", { name: "Follow" }));

      await waitFor(() => expect(gqlMock).toHaveBeenCalledOnce());
      expect(gqlMock.mock.calls[0][1]).toEqual({ userId: "u9" });
    });

    it("switches to the followed state once it succeeds", async () => {
      gqlMock.mockResolvedValue({});
      const user = userEvent.setup();
      renderWithProviders(
        <DuplicateNotice duplicate={makeDuplicate()} message={message} />,
      );

      await user.click(screen.getByRole("button", { name: "Follow" }));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Following" })).toBeDisabled(),
      );
    });

    // Not covered: what the UI does when the follow *fails*. The component has
    // no onError handler, so there is no behaviour of ours to assert — the
    // button just stays on "Follow". Worth adding feedback there; the test
    // should follow that fix rather than stand in for it.
    it("invalidates the recommendation queries, since following changes the feed", async () => {
      gqlMock.mockResolvedValue({});
      const user = userEvent.setup();
      const { queryClient } = renderWithProviders(
        <DuplicateNotice duplicate={makeDuplicate()} message={message} />,
      );
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");

      await user.click(screen.getByRole("button", { name: "Follow" }));

      await waitFor(() => expect(invalidate).toHaveBeenCalled());
      const keys = invalidate.mock.calls.map((c) => JSON.stringify(c[0]));
      expect(keys.some((k) => k.includes("recommendationSections"))).toBe(true);
    });

  });

  describe("when the uploader can't be resolved", () => {
    const orphaned = makeDuplicate({ uploader: null });

    it("still offers the track, without a follow button", () => {
      renderWithProviders(<DuplicateNotice duplicate={orphaned} message={message} />);
      expect(screen.queryByRole("button", { name: "Follow" })).not.toBeInTheDocument();
      const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
      expect(hrefs).toContain("/music/m1");
    });
  });

  describe("dismissing", () => {
    it("offers a reset only when the caller supplies one", async () => {
      const onDismiss = vi.fn();
      const { unmount } = renderWithProviders(
        <DuplicateNotice duplicate={makeDuplicate()} message={message} onDismiss={onDismiss} />,
      );
      await userEvent.setup().click(screen.getByRole("button", { name: /different track/i }));
      expect(onDismiss).toHaveBeenCalledOnce();
      unmount();

      renderWithProviders(<DuplicateNotice duplicate={makeDuplicate()} message={message} />);
      expect(screen.queryByRole("button", { name: /different track/i })).not.toBeInTheDocument();
    });
  });

  describe("Persian", () => {
    it("renders its own copy in fa, keeping the server message as sent", () => {
      const faMessage = "آهنگ «سیل» از مهراد هیدن قبلاً توسط علی بارگذاری شده است.";
      renderWithProviders(
        <DuplicateNotice duplicate={makeDuplicate()} message={faMessage} />,
        { locale: "fa" },
      );
      expect(screen.getByText(faMessage)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "دنبال کردن" })).toBeInTheDocument();
    });
  });
});
