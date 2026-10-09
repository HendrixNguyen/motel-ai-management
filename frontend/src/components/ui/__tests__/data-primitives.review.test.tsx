import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Progress from "../progress";
import Tabs from "../tabs";
import Accordion from "../accordion";

describe("Task 4 review contracts", () => {
  test("Tabs expose relationships and roving keyboard contract", () => {
    const markup = renderToStaticMarkup(<Tabs tabs={[{ id: "one", label: "Một", content: "Nội dung 1" }, { id: "two", label: "Hai", content: "Nội dung 2" }]} />);
    expect(markup).toMatch(/id="[^"]+-one-tab"/);
    expect(markup).toMatch(/aria-controls="[^"]+-one-panel"/);
    expect(markup).toMatch(/aria-labelledby="[^"]+-one-tab"/);
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('tabindex="-1"');
  });

  test("multiple Tabs instances receive unique tab and panel IDs", () => {
    const markup = renderToStaticMarkup(<><Tabs tabs={[{ id: "one", label: "Một", content: "Nội dung 1" }]} /><Tabs tabs={[{ id: "one", label: "Một", content: "Nội dung 2" }]} /></>);
    const tabIds = [...markup.matchAll(/id="([^"]+-one-tab)"/g)].map((match) => match[1]);
    const panelIds = [...markup.matchAll(/id="([^"]+-one-panel)"/g)].map((match) => match[1]);
    expect(tabIds).toHaveLength(2);
    expect(new Set(tabIds).size).toBe(2);
    expect(panelIds).toHaveLength(2);
    expect(new Set(panelIds).size).toBe(2);
  });

  test("Accordion keeps closed panels in DOM with hidden relationship", () => {
    const markup = renderToStaticMarkup(<Accordion items={[{ id: "one", title: "Chi tiết", content: "Nội dung" }]} />);
    expect(markup).toContain('id="one-content"');
    expect(markup).toContain('hidden=""');
  });

  test("Progress normalizes invalid max and value without transition", () => {
    const markup = renderToStaticMarkup(<Progress value={-10} max={0} label="Hoàn tất" />);
    expect(markup).toContain('aria-valuemax="1"');
    expect(markup).toContain('aria-valuenow="0"');
    expect(markup).not.toContain("transition-[width]");
  });
});
