import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers/render";
import { makeMusic, makeUser } from "../helpers/fixtures";
import { MusicCard } from "@/components/music/MusicCard";

const player = vi.hoisted(() => ({
  playTrack: vi.fn(),
  toggle: vi.fn(),
  isPlaying: false,
  currentId: null as string | null,
}));

vi.mock("@/providers/PlayerProvider", () => ({
  usePlayer: () => ({
    playTrack: player.playTrack,
    toggle: player.toggle,
    isPlaying: player.isPlaying,
    isCurrent: (id: string) => player.currentId === id,
  }),
}));

beforeEach(() => {
  player.playTrack.mockReset();
  player.toggle.mockReset();
  player.isPlaying = false;
  player.currentId = null;
});

describe("MusicCard", () => {
  it("shows the title, artist and play count", () => {
    renderWithProviders(
      <MusicCard music={makeMusic({ title: "Seyl", artistName: "Mehrad Hidden", playCount: 1500 })} />,
    );
    expect(screen.getByText("Seyl")).toBeInTheDocument();
    expect(screen.getByText("Mehrad Hidden")).toBeInTheDocument();
    expect(screen.getByText(/1\.5K/)).toBeInTheDocument();
  });

  it("links to the track page", () => {
    renderWithProviders(<MusicCard music={makeMusic({ id: "m7" })} />);
    expect(
      screen.getAllByRole("link").some((a) => a.getAttribute("href") === "/music/m7"),
    ).toBe(true);
  });

  it("starts playback with the surrounding queue", async () => {
    const track = makeMusic({ id: "m1" });
    const queue = [track, makeMusic({ id: "m2" })];
    renderWithProviders(<MusicCard music={track} queue={queue} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Play Seyl" }));

    expect(player.playTrack).toHaveBeenCalledWith(track, queue);
  });

  it("toggles instead of restarting when it is already the current track", async () => {
    const track = makeMusic({ id: "m1" });
    player.currentId = "m1";
    player.isPlaying = true;
    renderWithProviders(<MusicCard music={track} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Pause Seyl" }));

    expect(player.toggle).toHaveBeenCalledOnce();
    expect(player.playTrack).not.toHaveBeenCalled();
  });

  it("names the control after the track, so a list of them is distinguishable", () => {
    // Cards repeat down a rail; a control named only "Play" is useless to a
    // screen reader once there is more than one on the page.
    const track = makeMusic({ id: "m1", title: "Seyl" });
    const { unmount } = renderWithProviders(<MusicCard music={track} />);
    expect(screen.getByRole("button", { name: "Play Seyl" })).toBeInTheDocument();
    unmount();

    player.currentId = "m1";
    player.isPlaying = true;
    renderWithProviders(<MusicCard music={track} />);
    expect(screen.getByRole("button", { name: "Pause Seyl" })).toBeInTheDocument();
  });

  it("gives two cards in the same rail different accessible names", () => {
    const a = makeMusic({ id: "m1", title: "Seyl" });
    const b = makeMusic({ id: "m2", title: "Deltangi" });
    renderWithProviders(
      <>
        <MusicCard music={a} />
        <MusicCard music={b} />
      </>,
    );
    expect(screen.getByRole("button", { name: "Play Seyl" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play Deltangi" })).toBeInTheDocument();
  });

  it("does not navigate when the play button is clicked", async () => {
    // The button sits inside the card's link; without preventDefault, playing a
    // track would also open its page.
    const track = makeMusic({ id: "m1", title: "Seyl" });
    renderWithProviders(<MusicCard music={track} />);
    const button = screen.getByRole("button", { name: "Play Seyl" });

    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    button.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("renders Persian copy and digits in fa", () => {
    renderWithProviders(
      <MusicCard music={makeMusic({ playCount: 1500 })} />,
      { locale: "fa" },
    );
    // The Persian entry is its own template, so word order comes from the
    // translation rather than from string concatenation in the component.
    expect(screen.getByRole("button", { name: "پخش Seyl" })).toBeInTheDocument();
    expect(screen.getByText(/۱\.۵K/)).toBeInTheDocument();
  });

  it("survives a track with no cover art", () => {
    renderWithProviders(<MusicCard music={makeMusic({ coverUrl: null })} />);
    expect(screen.getByText("Seyl")).toBeInTheDocument();
  });

  it("survives a track whose uploader is missing", () => {
    renderWithProviders(
      <MusicCard music={makeMusic({ uploader: makeUser({ displayName: "" }) })} />,
    );
    expect(screen.getByText("Seyl")).toBeInTheDocument();
  });
});
