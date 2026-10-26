import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import EmptyState from "@/components/ui/empty-state";

describe("Core UI v2 migration contracts", () => {
  test("empty state hides button without action and renders button with action", () => {
    const withoutAction = renderToStaticMarkup(
      createElement(EmptyState, { title: "Empty", description: "Nothing" }),
    );
    const withAction = renderToStaticMarkup(
      createElement(EmptyState, {
        title: "Empty",
        description: "Nothing",
        actionLabel: "Add",
        onAction: () => {},
      }),
    );
    expect(withoutAction).not.toContain("<button");
    expect(withAction).toContain(">Add</button>");
  });

  test("dark theme updates runtime colors consumed by Tailwind utilities", async () => {
    const css = await readFile(new URL("../../../src/app/globals.css", import.meta.url), "utf8");
    expect(css).toMatch(/--color-surface:\s*var\(--color-surface-runtime\)/i);
    expect(css).toMatch(
      /html\[data-theme="dark"\]\s*\{[\s\S]*--color-surface-runtime:\s*#1B303C;[\s\S]*--color-canvas-runtime:\s*#10232E;/i,
    );
  });
});
