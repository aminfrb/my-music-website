import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers/render";
import { Modal } from "@/components/ui/Modal";

let onClose: ReturnType<typeof vi.fn>;
beforeEach(() => {
  onClose = vi.fn();
});

const open = (locale: "en" | "fa" = "en") =>
  renderWithProviders(
    <Modal open onClose={onClose} title="Edit profile">
      <p>body content</p>
    </Modal>,
    { locale },
  );

/** The dialog is portalled to <body>, so it is not under the render container. */
const backdropOf = () =>
  document.querySelector<HTMLElement>("[data-overlay] [aria-hidden='true']");

describe("Modal", () => {
  it("renders nothing while closed", () => {
    const { container } = renderWithProviders(
      <Modal open={false} onClose={onClose} title="Edit profile">
        <p>body content</p>
      </Modal>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders its children when open", () => {
    open();
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it("announces itself as a dialog named by its heading", () => {
    open();
    // Without this a screen-reader user gets no signal they entered a dialog.
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Edit profile");
  });

  it("exposes exactly one close control", () => {
    open();
    // The click-to-dismiss backdrop used to be a second button with the same
    // name, so "Close" was ambiguous to anyone navigating by control.
    expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1);
  });

  it("hides the backdrop from assistive tech rather than naming it", () => {
    open();
    const backdrop = backdropOf();
    expect(backdrop).toBeTruthy();
    // A focusable element must never be aria-hidden.
    expect(backdrop?.tagName).toBe("DIV");
  });

  describe("dismissing", () => {
    it("closes from the close button", async () => {
      open();
      await userEvent.setup().click(screen.getByRole("button", { name: "Close" }));
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("closes when the backdrop is clicked", async () => {
      open();
      await userEvent.setup().click(backdropOf()!);
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("closes on Escape", async () => {
      open();
      await userEvent.setup().keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("does not close on any other key", async () => {
      open();
      // Focus sits on the panel, not the close button, so these do nothing.
      await userEvent.setup().keyboard("{Enter}a ");
      expect(onClose).not.toHaveBeenCalled();
    });

    it("stops listening for Escape once unmounted", async () => {
      const { unmount } = open();
      unmount();
      await userEvent.setup().keyboard("{Escape}");
      // A leaked document listener would fire for an already-closed modal.
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("Persian", () => {
    it("localizes the close label", () => {
      open("fa");
      expect(screen.getByRole("button", { name: "بستن" })).toBeInTheDocument();
      // Previously hardcoded English, so a Persian UI announced "Close".
      expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    });
  });
});

describe("Modal — overlay behaviour", () => {
  // A dialog rendered inside a `backdrop-filter`/`transform` ancestor measures
  // `fixed inset-0` against that ancestor instead of the viewport, which is how
  // the mobile drawer ended up collapsed to the height of the header.
  it("renders into the body, clear of any containing block above it", () => {
    open();
    const dialog = screen.getByRole("dialog");
    expect(dialog.closest("[data-overlay]")?.parentElement).toBe(document.body);
  });

  it("locks the page behind it, and lets go on close", async () => {
    const { unmount } = open();
    expect(document.body.style.overflow).toBe("hidden");

    unmount();

    expect(document.body.style.overflow).toBe("");
  });

  it("moves focus into the dialog", () => {
    open();
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });
});
