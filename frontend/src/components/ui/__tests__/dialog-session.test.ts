import { describe, expect, it } from "vitest";
import { openDialogSession } from "../dialog-session";

// Only the browser boundary is doubled: native showModal/close and focus events.
// The production session owns capture/restore and cleanup behavior.
function setup() {
  const events = new EventTarget();
  let focused = "trigger";
  const trigger = { focus() { focused = "trigger"; } };
  const dialog = {
    open: false,
    showModal() { this.open = true; focused = "dialog"; },
    close() { this.open = false; events.dispatchEvent(new Event("close")); },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  return { dialog, trigger, focused: () => focused, moveFocus: () => { focused = "elsewhere"; } };
}

describe("native dialog focus session", () => {
  it("restores the opening control on the native close event", () => {
    const state = setup();
    openDialogSession(state.dialog, state.trigger);
    expect(state.dialog.open).toBe(true);
    expect(state.focused()).toBe("dialog");
    state.dialog.close();
    expect(state.focused()).toBe("trigger");
  });
  it("closes and restores focus when a controlled open state ends or the dialog unmounts", () => {
    const state = setup();
    const cleanup = openDialogSession(state.dialog, state.trigger);
    expect(state.dialog.open).toBe(true);
    expect(state.focused()).toBe("dialog");
    cleanup();
    expect(state.dialog.open).toBe(false);
    expect(state.focused()).toBe("trigger");
  });
  it("does not steal later focus when an already closed dialog unmounts", () => {
    const state = setup();
    const cleanup = openDialogSession(state.dialog, state.trigger);
    state.dialog.close();
    state.moveFocus();
    cleanup();
    expect(state.focused()).toBe("elsewhere");
  });
});
