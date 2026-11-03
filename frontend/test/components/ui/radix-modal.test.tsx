// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/shadcn/dialog";
import Modal from "@/components/ui/modal";

afterEach(cleanup);
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: () => {},
});
Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
  configurable: true,
  value: () => false,
});
Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
  configurable: true,
  value: () => {},
});
Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
  configurable: true,
  value: () => {},
});

describe("Radix modal and select lifecycle contracts", () => {
  it("renders open controlled Modal without requiring a Radix trigger", async () => {
    render(
      <Modal open onClose={() => {}} title="Open modal">
        <p>Dialog content</p>
      </Modal>,
    );
    expect(await screen.findByRole("dialog", { name: "Open modal" })).toBeVisible();
  });

  it("updates internal open state when onOpenChange is observed", async () => {
    const onOpenChange = vi.fn();
    const view = render(
      <Dialog defaultOpen={false} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Observed close</DialogTitle>
          <DialogClose>Close</DialogClose>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    view.rerender(
      <Dialog defaultOpen={false} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Observed close</DialogTitle>
          <DialogClose>Close now</DialogClose>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Modal restores the opener that controlled it open", async () => {
    function ControlledModal() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open modal</button>
          <Modal open={open} onClose={() => setOpen(false)} title="Modal">
            <button>Body action</button>
          </Modal>
        </>
      );
    }
    render(<ControlledModal />);
    const opener = screen.getByRole("button", { name: "Open modal" });
    opener.focus();
    fireEvent.click(opener);
    await screen.findByRole("dialog", { name: "Modal" });
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    await vi.waitFor(() => expect(opener).toHaveFocus());
  });

  it("closes controlled Radix Dialog on Escape", async () => {
    function ControlledDialog() {
      const [open, setOpen] = React.useState(true);
      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogTitle>Closable</DialogTitle>
          </DialogContent>
        </Dialog>
      );
    }
    render(<ControlledDialog />);
    const dialog = await screen.findByRole("dialog", { name: "Closable" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(await screen.queryByRole("dialog")).toBeNull();
  });

  it("passes outside interaction events to caller prevention hook", async () => {
    const onPointerDownOutside = vi.fn((event: { preventDefault: () => void }) =>
      event.preventDefault(),
    );
    render(
      <Modal open onClose={() => {}} title="Outside" onPointerDownOutside={onPointerDownOutside}>
        Content
      </Modal>,
    );
    const dialog = await screen.findByRole("dialog", { name: "Outside" });
    fireEvent.pointerDown(document.querySelector("[data-slot='dialog-overlay']")!);
    fireEvent.click(document.querySelector("[data-slot='dialog-overlay']")!);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onPointerDownOutside).toHaveBeenCalled();
    expect(dialog).toBeVisible();
  });

  it("restores the trigger focus when Radix Dialog closes", async () => {
    function TriggeredDialog() {
      const [open, setOpen] = React.useState(false);
      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button>Open</button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Focus</DialogTitle>
            <DialogClose asChild>
              <button>Close</button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      );
    }
    render(<TriggeredDialog />);
    const trigger = screen.getByRole("button", { name: "Open" });
    fireEvent.click(trigger);
    await screen.findByRole("dialog", { name: "Focus" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await vi.waitFor(() => expect(trigger).toHaveFocus());
  });

  it("Select trigger and list options use a document portal", async () => {
    render(
      <Select defaultValue="one">
        <SelectTrigger aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="one">One</SelectItem>
          <SelectItem value="two">Two</SelectItem>
        </SelectContent>
      </Select>,
    );
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    expect(await screen.findByRole("listbox")).toBeVisible();
    expect(screen.getByRole("option", { name: "One" })).toBeVisible();
    expect(within(document.body).getByRole("listbox")).toBeVisible();
  });

  it("does not invoke onClose when onOpenChange handles closing", async () => {
    const onClose = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <Modal open onClose={onClose} onOpenChange={onOpenChange} title="Exclusive close">
        Content
      </Modal>,
    );
    const dialog = await screen.findByRole("dialog", { name: "Exclusive close" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Select portals into its owning dialog when multiple dialogs exist", async () => {
    render(
      <Modal open onClose={() => {}} title="First dialog" data-testid="first-dialog">
        <Modal open onClose={() => {}} title="Second dialog" data-testid="second-dialog">
          <Select defaultValue="two">
            <SelectTrigger aria-label="Second select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="two">Two</SelectItem>
            </SelectContent>
          </Select>
        </Modal>
      </Modal>,
    );
    const secondDialog = await screen.findByTestId("second-dialog");
    fireEvent.keyDown(within(secondDialog).getByRole("combobox", { name: "Second select" }), {
      key: "ArrowDown",
    });
    const listbox = await screen.findByRole("listbox");
    expect(secondDialog.parentElement?.contains(listbox)).toBe(true);
  });
});
