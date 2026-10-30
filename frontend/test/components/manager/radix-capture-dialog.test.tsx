// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/shadcn/dialog";

afterEach(cleanup);

describe("Radix Dialog adapter", () => {
  it("renders controlled open content through portal without native showModal", async () => {
    const view = render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Safety check</DialogTitle>
          <p>Confirm state</p>
        </DialogContent>
      </Dialog>,
    );
    expect(await screen.findByRole("dialog", { name: "Safety check" })).toBeVisible();
    expect(document.querySelector("dialog")).toBeNull();
    expect(view.container.querySelector("[data-slot='dialog-content']")).toBeNull();
    expect(document.body.querySelector("[data-slot='dialog-content']")).toBeInTheDocument();
  });
});
