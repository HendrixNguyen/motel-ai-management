// Bundled only by component-kit.spec.ts; this never creates a Next product route.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import Button from "../../src/components/ui/button";
import Modal from "../../src/components/ui/modal";
import Drawer from "../../src/components/ui/drawer";
import CopyButton from "../../src/components/ui/copy-button";
import DataTable from "../../src/components/ui/data-table";
import Skeleton from "../../src/components/ui/skeleton";
import TruncatedText from "../../src/components/ui/truncated-text";
import { ToastProvider, useToast } from "../../src/components/ui/toast";

function Kit() {
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const toast = useToast();
  const rows = [{ id: "a", name: "Ánh", rent: "10000000000000" }, { id: "b", name: "Bình", rent: "900000000000" }, { id: "c", name: "Chi", rent: "2500000" }];
  return <main className="min-w-0 space-y-4 p-4">
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => setModal(true)}>Mở modal</Button>
      <Button onClick={() => setDrawer(true)}>Mở drawer</Button>
      <Button onClick={() => toast({ message: "Đã lưu phòng" })}>Thông báo</Button>
      <Button pending>Đang lưu</Button>
    </div>
    <Modal open={modal} onClose={() => setModal(false)} title="Sửa phòng" description="Kiểm tra thông tin trước khi lưu">
      <label>Tên phòng<input className="min-h-11 w-full border border-border-strong" /></label>
      <Button onClick={() => setModal(false)}>Lưu phòng</Button>
    </Modal>
    <Drawer open={drawer} onClose={() => setDrawer(false)} title="Chi tiết khách thuê"><p>Nguyễn Thị Ánh Hồng</p></Drawer>
    <CopyButton value="https://example.test/r/token" />
    <TruncatedText value="Một tên nhà trọ rất dài cần hiển thị đủ cho trình đọc màn hình" />
    <Skeleton />
    <DataTable rows={rows} columns={[
      { key: "name", label: "Họ tên", render: (row) => row.name, sortValue: (row) => row.name },
      { key: "rent", label: "Tiền thuê", render: (row) => row.rent, sortValue: (row) => BigInt(row.rent), money: true },
    ]} getRowId={(row) => row.id} searchText={(row) => row.name} pageSize={2} caption="Khách thuê" />
  </main>;
}

createRoot(document.getElementById("kit")!).render(<ToastProvider><Kit /></ToastProvider>);
