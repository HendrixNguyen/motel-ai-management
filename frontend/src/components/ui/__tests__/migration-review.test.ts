import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import EmptyState from "../empty-state";

describe("Core UI v2 migration contracts", () => {
  test("empty state hides button without action and renders button with action", () => {
    const withoutAction = renderToStaticMarkup(createElement(EmptyState, { title: "Empty", description: "Nothing" }));
    const withAction = renderToStaticMarkup(createElement(EmptyState, { title: "Empty", description: "Nothing", actionLabel: "Add", onAction: () => {} }));
    expect(withoutAction).not.toContain("<button");
    expect(withAction).toContain(">Add</button>");
  });

  test("dark theme defines semantic surface tokens", async () => {
    const css = await readFile(new URL("../../../app/globals.css", import.meta.url), "utf8");
    expect(css).toMatch(/html\[data-theme="dark"\]\s*\{[\s\S]*--color-surface:\s*#111827;[\s\S]*--color-canvas:\s*#0F172A;/);
  });
});
