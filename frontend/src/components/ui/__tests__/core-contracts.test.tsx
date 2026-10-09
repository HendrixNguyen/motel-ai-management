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
import type { CoreTone, CoreTheme, SpacingToken } from "../contracts";

describe("Core UI v2 compatibility contracts", () => {
  test("exports shared semantic contract types", () => {
    const tone: CoreTone = "success";
    const theme: CoreTheme = "system";
    const spacing: SpacingToken = "md";
    expect([tone, theme, spacing]).toEqual(["success", "system", "md"]);
  });

  test("preserves existing primitive semantics", () => {
    const html = renderToStaticMarkup(
      <div>
        <Button>Save</Button>
        <Field id="name" label="Name" error="Required">{(props) => <input {...props} />}</Field>
        <Modal open={false} onClose={() => {}} title="Edit">Body</Modal>
        <Drawer open={false} onClose={() => {}} title="Menu">Body</Drawer>
        <Badge label="Active" tone="success" />
        <StatCard label="Rooms" value={12} />
        <EmptyState title="Empty" description="Nothing" actionLabel="Add" onAction={() => {}} />
        <DataTable rows={[{ id: "1", name: "Room 1" }]} columns={[{ key: "name", label: "Name", render: (row) => row.name }]} getRowId={(row) => row.id} caption="Rooms" />
        <ToastProvider>Toast children</ToastProvider>
      </div>,
    );
    expect(html).toContain("Save");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("Active");
    expect(html).toContain("Rooms");
    expect(html).toContain("Nothing");
    expect(html).toContain("Menu");
    expect(html).toContain("Room 1");
    expect(html).toContain("Toast children");
  });
});
