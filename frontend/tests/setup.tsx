import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// React Testing Library doesn't auto-clean when `globals` is off.
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

/**
 * next/link renders a plain anchor here. The App Router's real Link needs a
 * router context that only exists inside a Next app, and every assertion we
 * make about it is about the href it produces.
 */
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
