import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers/render";
import { makeUser } from "../helpers/fixtures";
import { TopBar } from "@/components/layout/TopBar";

const auth = vi.hoisted(() => ({ user: null as ReturnType<typeof makeUser> | null }));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: auth.user, isAdmin: false, logout: vi.fn() }),
}));
vi.mock("@/providers/ThemeProvider", () => ({
  useTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));

beforeEach(() => {
  auth.user = null;
  document.body.style.overflow = "";
});

const openDrawer = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Open menu" }));
  return user;
};

describe("mobile drawer", () => {
  // `backdrop-filter`, `filter` and `transform` all make an element the
  // containing block for `position: fixed` descendants. The header carries
  // `backdrop-blur`, so a drawer rendered inside it sized itself to the
  // header's 64px-tall box instead of the viewport, and the nav floated over
  // the page with no panel behind it. It has to live outside the header.
  it("renders outside the header, which is a fixed-position containing block", async () => {
    renderWithProviders(<TopBar />);
    await openDrawer();

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(document.querySelector("header")?.contains(nav)).toBe(false);
    expect(nav.closest("[data-overlay]")?.parentElement).toBe(document.body);
  });

  it("closes on Escape", async () => {
    renderWithProviders(<TopBar />);
    const user = await openDrawer();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
  });

  it("closes when the backdrop is tapped", async () => {
    renderWithProviders(<TopBar />);
    const user = await openDrawer();

    await user.click(document.querySelector("[data-overlay] [aria-hidden='true']")!);

    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
  });

  it("locks the page behind it while open, and lets go afterwards", async () => {
    // Without this the page scrolls under the drawer on touch, which reads as
    // the menu sliding away from your finger.
    renderWithProviders(<TopBar />);
    const user = await openDrawer();
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");

    expect(document.body.style.overflow).toBe("");
  });

  it("moves focus into the drawer so the keyboard follows it open", async () => {
    renderWithProviders(<TopBar />);
    await openDrawer();

    const overlay = document.querySelector("[data-overlay]")!;
    expect(overlay.contains(document.activeElement)).toBe(true);
  });

  it("offers theme and language inside the drawer, where the header has no room", async () => {
    // At 320px the header cannot hold both toggles plus the account controls;
    // they move into the drawer rather than overflowing off-screen.
    renderWithProviders(<TopBar />);
    await openDrawer();

    const overlay = within(document.querySelector("[data-overlay]") as HTMLElement);
    expect(overlay.getByRole("button", { name: /Light mode|Dark mode/ })).toBeInTheDocument();
    expect(overlay.getByRole("button", { name: /Language/i })).toBeInTheDocument();
  });
});

describe("account menu", () => {
  it("closes when you tap the page below it", async () => {
    // Same containing-block trap: the dismiss layer was a `fixed inset-0`
    // catcher inside the `backdrop-blur` header, so it only ever covered the
    // header strip and tapping the page below left the menu open.
    auth.user = makeUser({ displayName: "Ali" });
    renderWithProviders(
      <>
        <TopBar />
        <main>
          <button type="button">somewhere else</button>
        </main>
      </>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Profile" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "somewhere else" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    auth.user = makeUser({ displayName: "Ali" });
    renderWithProviders(<TopBar />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Profile" }));

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
