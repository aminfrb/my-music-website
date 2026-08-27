import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../helpers/render";
import { Sidebar } from "@/components/layout/Sidebar";

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: null, isAdmin: false }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

/** Arabic-script range — Persian copy leaking into the English UI. */
const PERSIAN = /[؀-ۿ]/;

describe("Sidebar", () => {
  it("shows no Persian copy in the English UI", () => {
    // The footer note was hardcoded Persian, so an English visitor read
    // "Spidermelody · بلندگوی صداهای تازه" under the nav.
    const { container } = renderWithProviders(<Sidebar />);
    expect(container.textContent).not.toMatch(PERSIAN);
  });

  it("shows no English copy in the Persian UI", () => {
    const { container } = renderWithProviders(<Sidebar />, { locale: "fa" });
    expect(container.textContent).toMatch(PERSIAN);
    expect(container.textContent).not.toMatch(/[A-Za-z]/);
  });

  it("names its navigation, so it is reachable as a landmark", () => {
    renderWithProviders(<Sidebar />);
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });
});
