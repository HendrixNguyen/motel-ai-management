import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Button from "../button";
import Field from "../field";
import Badge from "../badge";
import StatCard from "../stat-card";
import EmptyState from "../empty-state";
import DataTable from "../data-table";
import Modal from "../modal";
import Drawer from "../drawer";
import { ToastProvider } from "../toast";
import ThemeSelect from "../theme-select";
import type { CoreTone, CoreTheme, SpacingToken } from "../contracts";

const markup = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("Core UI v2 compatibility contracts", () => {
  test("exports shared semantic contract types", () => {
    const tone: CoreTone = "success";
    const theme: CoreTheme = "system";
    const spacing: SpacingToken = "md";
    expect([tone, theme, spacing]).toEqual(["success", "system", "md"]);
  });

  test("Button keeps default action semantics", () => {
    const html = markup(<Button>Save</Button>);
    expect(html).toContain("Save");
    expect(html).toContain('type="button"');
    expect(html).toContain("min-h-11");
  });

  test("Field keeps label and error association", () => {
    const html = markup(<Field id="name" label="Name" error="Required">{(props) => <input {...props} />}</Field>);
    expect(html).toContain('for="name"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="name-error"');
    expect(html).toContain("Required");
  });

  test("Modal and Drawer preserve headings and closed state", () => {
    expect(markup(<Modal open={false} onClose={() => {}} title="Edit">Body</Modal>)).toContain("Edit");
    expect(markup(<Drawer open={false} onClose={() => {}} title="Menu">Body</Drawer>)).toContain("Menu");
  });

  test("Badge preserves tone and label", () => {
    const html = markup(<Badge label="Active" tone="success" />);
    expect(html).toContain("Active");
    expect(html).toContain("bg-success-bg");
  });

  test("StatCard preserves labelled definition list", () => {
    const html = markup(<StatCard label="Rooms" value={12} description="Available" />);
    expect(html).toContain("Rooms");
    expect(html).toContain("12");
    expect(html).toContain("Available");
    expect(html).toContain("<dt");
    expect(html).toContain("<dd");
  });

  test("EmptyState preserves action and copy", () => {
    const html = markup(<EmptyState title="Empty" description="Nothing" actionLabel="Add" onAction={() => {}} />);
    expect(html).toContain("Empty");
    expect(html).toContain("Nothing");
    expect(html).toContain("Add");
  });

  test("DataTable preserves caption, labels, and row data", () => {
    const html = markup(<DataTable rows={[{ id: "1", name: "Room 1" }]} columns={[{ key: "name", label: "Name", render: (row) => row.name }]} getRowId={(row) => row.id} caption="Rooms" />);
    expect(html).toContain("Rooms");
    expect(html).toContain("Name");
    expect(html).toContain("Room 1");
    expect(html).toContain('scope="col"');
  });

  test("ToastProvider preserves live region and children", () => {
    const html = markup(<ToastProvider>Toast children</ToastProvider>);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Toast children");
  });

  test("ThemeSelect renders system theme on server", () => {
    const html = markup(<ThemeSelect />);
    expect(html).toContain('value="system"');
    expect(html).toContain("Theo hệ thống");
  });
});
