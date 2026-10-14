import Button from "./button";
import Modal, { type ModalProps } from "./modal";

export default function ConfirmDialog({ title, description, open, onClose, onConfirm, confirmLabel = "Xác nhận", cancelLabel = "Hủy", destructive = false, pending = false }: Omit<ModalProps, "children" | "footer"> & { onConfirm: () => void; confirmLabel?: string; cancelLabel?: string; destructive?: boolean; pending?: boolean }) {
  return <Modal open={open} onClose={onClose} title={title} description={description} footer={<>
    <Button variant="secondary" onClick={onClose} disabled={pending}>{cancelLabel}</Button>
    <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} pending={pending} data-destructive={destructive || undefined}>{confirmLabel}</Button>
  </>}>
    {destructive && <p className="sr-only">Thao tác này có thể gây mất dữ liệu và cần xác nhận rõ ràng.</p>}
  </Modal>;
}
