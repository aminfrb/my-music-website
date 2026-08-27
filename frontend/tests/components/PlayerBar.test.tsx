import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../helpers/render";
import { makeMusic } from "../helpers/fixtures";
import { PlayerBar } from "@/components/layout/PlayerBar";

const player = vi.hoisted(() => ({
  current: null as ReturnType<typeof makeMusic> | null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  index: 0,
  queue: [] as ReturnType<typeof makeMusic>[],
  toggle: vi.fn(),
  next: vi.fn(),
  prev: vi.fn(),
  seek: vi.fn(),
  setVolume: vi.fn(),
  close: vi.fn(),
}));

vi.mock("@/providers/PlayerProvider", () => ({
  usePlayer: () => player,
}));

const globalsCss = readFileSync(
  resolve(__dirname, "../../src/app/globals.css"),
  "utf8",
);

beforeEach(() => {
  const track = makeMusic({ id: "m1", title: "Seyl", duration: 200 });
  player.current = track;
  player.queue = [track];
  player.index = 0;
  player.isPlaying = false;
  player.currentTime = 50;
  player.duration = 200;
  player.volume = 1;
});

const seekSlider = () => screen.getAllByRole("slider")[0];
const volumeSlider = () => screen.getAllByRole("slider")[1];

describe("PlayerBar sliders", () => {
  // The native range control is direction-aware: under dir="rtl" the browser
  // renders max at the left and the thumb travels right-to-left. A fill painted
  // with a hardcoded `linear-gradient(to right, …)` therefore grows away from
  // the thumb in Persian, which is what made the bar look reversed.
  it("drives the seek fill from a custom property, not a physical gradient", () => {
    renderWithProviders(<PlayerBar />);
    const style = seekSlider().getAttribute("style") ?? "";

    expect(style).toContain("--range-fill: 25%");
    expect(style).not.toContain("to right");
    expect(style).not.toContain("to left");
  });

  it("drives the volume fill from the same custom property", () => {
    player.volume = 0.4;
    renderWithProviders(<PlayerBar />);
    const style = volumeSlider().getAttribute("style") ?? "";

    expect(style).toContain("--range-fill: 40%");
  });

  it("keeps the seek fill at 0% before the duration is known", () => {
    player.currentTime = 0;
    player.duration = 0;
    renderWithProviders(<PlayerBar />);

    expect(seekSlider().getAttribute("style") ?? "").toContain("--range-fill: 0%");
  });

  it("paints the fill from the correct edge in each direction", () => {
    // The direction lives in CSS so one rule covers both sliders and both
    // locales; an inline gradient could only ever know one of them.
    expect(globalsCss).toMatch(
      /input\[type="range"\][\s\S]*?linear-gradient\(\s*to right[\s\S]*?var\(--range-fill/,
    );
    expect(globalsCss).toMatch(
      /\[dir="rtl"\]\s*input\[type="range"\][\s\S]*?linear-gradient\(\s*to left[\s\S]*?var\(--range-fill/,
    );
  });
});

describe("PlayerBar transport in Persian", () => {
  it("mirrors the skip glyphs so they point the way the mirrored row reads", () => {
    // Flex reverses the row under rtl, putting "previous" on the right. An
    // unmirrored left-pointing glyph there reads as "forward".
    renderWithProviders(<PlayerBar />, { locale: "fa" });

    for (const name of ["قبلی", "بعدی"]) {
      const glyph = screen.getByRole("button", { name }).querySelector("svg");
      expect(glyph?.getAttribute("class")).toContain("rtl:-scale-x-100");
    }
  });

  it("mirrors the speaker so its waves still point at the level bar", () => {
    // rtl puts the speaker to the right of its slider; unmirrored, the waves
    // radiate away from the level it labels.
    renderWithProviders(<PlayerBar />, { locale: "fa" });
    const glyph = screen.getByRole("button", { name: "بی‌صدا" }).querySelector("svg");

    expect(glyph?.getAttribute("class")).toContain("rtl:-scale-x-100");
  });

  it("keeps the play triangle optically centred in both directions", () => {
    // The triangle is not mirrored (play always points right), so its nudge
    // must not be dropped in rtl the way an `ltr:`-only utility would.
    renderWithProviders(<PlayerBar />, { locale: "fa" });
    const glyph = screen.getByRole("button", { name: "پخش" }).querySelector("svg");

    expect(glyph?.getAttribute("class")).toContain("ml-0.5");
    expect(glyph?.getAttribute("class")).not.toContain("ltr:ml-0.5");
  });
});

describe("PlayerBar control names", () => {
  it("names every control in the active locale", () => {
    // The rest of the bar goes through `t()`; the sliders were the one place
    // a Persian user still met English.
    renderWithProviders(<PlayerBar />, { locale: "fa" });

    expect(
      screen.getByRole("slider", { name: "جابه‌جایی در آهنگ" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "میزان صدا" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "بی‌صدا" })).toBeInTheDocument();
  });

  it("names the volume button for the action it performs, not the thing it is", () => {
    player.volume = 0;
    renderWithProviders(<PlayerBar />);

    expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mute" })).not.toBeInTheDocument();
  });
});

describe("PlayerBar on a phone", () => {
  it("keeps skip controls out of the way until there is room for them", () => {
    // At 360px the cover, transport and close leave the title about 80px. The
    // compact bar keeps play/pause and gives the space back to the track name;
    // skipping returns at `sm`.
    renderWithProviders(<PlayerBar />);

    for (const name of ["Previous", "Next"]) {
      expect(screen.getByRole("button", { name }).className).toContain("hidden sm:grid");
    }
    expect(screen.getByRole("button", { name: "Play" }).className).not.toContain("hidden");
  });

  it("lets each track name pick its own direction", () => {
    // A Latin title inside the Persian UI (and vice versa) otherwise truncates
    // from the wrong end and reads with its punctuation flipped.
    renderWithProviders(<PlayerBar />, { locale: "fa" });

    expect(screen.getByText("Seyl")).toHaveAttribute("dir", "auto");
    expect(screen.getByText("Mehrad Hidden")).toHaveAttribute("dir", "auto");
  });
});
