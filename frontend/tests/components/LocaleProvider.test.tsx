import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocaleProvider, useLocale } from "@/providers/LocaleProvider";
import { setStoredLocale, getStoredLocale } from "@/lib/graphql";

function Probe() {
  const { locale, dir, t, toggleLocale, setLocale } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="dir">{dir}</span>
      <span data-testid="copy">{t("nav_forYou")}</span>
      <button onClick={toggleLocale}>toggle</button>
      <button onClick={() => setLocale("fa")}>to-fa</button>
    </div>
  );
}

const renderProbe = () => render(<Probe />, { wrapper: LocaleProvider });

describe("LocaleProvider", () => {
  it("defaults to English, left-to-right", async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("locale")).toHaveTextContent("en"));
    expect(screen.getByTestId("dir")).toHaveTextContent("ltr");
    expect(screen.getByTestId("copy")).toHaveTextContent("For You");
  });

  it("hydrates the stored locale after mount", async () => {
    setStoredLocale("fa");
    renderProbe();
    // Hydration is deferred to avoid an SSR/client mismatch.
    await waitFor(() => expect(screen.getByTestId("locale")).toHaveTextContent("fa"));
    expect(screen.getByTestId("copy")).toHaveTextContent("برای تو");
  });

  it("flips direction to rtl for Persian", async () => {
    setStoredLocale("fa");
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("dir")).toHaveTextContent("rtl"));
  });

  it("keeps <html lang> and <html dir> in sync, so CSS and fonts follow", async () => {
    renderProbe();
    await waitFor(() => expect(document.documentElement.getAttribute("lang")).toBe("en"));
    expect(document.documentElement.getAttribute("dir")).toBe("ltr");

    await userEvent.setup().click(screen.getByRole("button", { name: "toggle" }));

    await waitFor(() => expect(document.documentElement.getAttribute("lang")).toBe("fa"));
    expect(document.documentElement.getAttribute("dir")).toBe("rtl");
  });

  it("persists the choice so a reload keeps it", async () => {
    renderProbe();
    await userEvent.setup().click(screen.getByRole("button", { name: "to-fa" }));
    await waitFor(() => expect(getStoredLocale()).toBe("fa"));
  });

  it("toggles back and forth", async () => {
    const user = userEvent.setup();
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("locale")).toHaveTextContent("en"));

    await user.click(screen.getByRole("button", { name: "toggle" }));
    await waitFor(() => expect(screen.getByTestId("locale")).toHaveTextContent("fa"));

    await user.click(screen.getByRole("button", { name: "toggle" }));
    await waitFor(() => expect(screen.getByTestId("locale")).toHaveTextContent("en"));
  });

  it("substitutes placeholders, in whichever order the translation puts them", async () => {
    function Interpolated({ locale }: { locale: "en" | "fa" }) {
      const { t, setLocale } = useLocale();
      return (
        <div>
          <span data-testid="label">{t("playTrack", { title: "Seyl" })}</span>
          <button onClick={() => setLocale(locale)}>switch</button>
        </div>
      );
    }
    const user = userEvent.setup();
    render(<Interpolated locale="fa" />, { wrapper: LocaleProvider });

    await waitFor(() => expect(screen.getByTestId("label")).toHaveTextContent("Play Seyl"));
    await user.click(screen.getByRole("button", { name: "switch" }));
    await waitFor(() => expect(screen.getByTestId("label")).toHaveTextContent("پخش Seyl"));
  });

  it("leaves an unmatched placeholder visible, so a missing value is obvious", async () => {
    function Missing() {
      const { t } = useLocale();
      return <span data-testid="label">{t("playTrack", { wrong: "x" })}</span>;
    }
    render(<Missing />, { wrapper: LocaleProvider });
    await waitFor(() => expect(screen.getByTestId("label")).toHaveTextContent("Play {title}"));
  });

  it("returns the raw template when no values are passed", async () => {
    function Raw() {
      const { t } = useLocale();
      return <span data-testid="label">{t("playTrack")}</span>;
    }
    render(<Raw />, { wrapper: LocaleProvider });
    await waitFor(() => expect(screen.getByTestId("label")).toHaveTextContent("Play {title}"));
  });

  it("falls back to the key itself rather than rendering blank", async () => {
    function Missing() {
      const { t } = useLocale();
      // Deliberately not a real key — this is what a typo produces at runtime.
      return <span data-testid="missing">{t("nope" as never)}</span>;
    }
    render(<Missing />, { wrapper: LocaleProvider });
    await waitFor(() => expect(screen.getByTestId("missing")).toHaveTextContent("nope"));
  });

  it("throws a clear error when used outside the provider", () => {
    // Keeps a missing provider from surfacing as a confusing null-deref later.
    // React logs the caught render error; that noise isn't the assertion.
    const silence = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<Probe />)).toThrow();
    } finally {
      silence.mockRestore();
    }
  });
});
