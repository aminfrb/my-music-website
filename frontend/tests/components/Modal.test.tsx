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
    const { container } = open();
    const backdrop = container.querySelector("[aria-hidden='true']");
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
      const { container } = open();
      const backdrop = container.querySelector("[aria-hidden='true']") as HTMLElement;
      await userEvent.setup().click(backdrop);
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("closes on Escape", async () => {
      open();
      await userEvent.setup().keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("does not close on any other key", async () => {
      open();
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
