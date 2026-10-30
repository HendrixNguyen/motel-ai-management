import { Button } from "@/components/ui/shadcn/button";
import Modal, { type ModalProps } from "./modal";

export default function ConfirmDialog({
  title,
  description,
  open,
  onClose,
  onConfirm,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  destructive = false,
  pending = false,
}: Omit<ModalProps, "children" | "footer"> & {
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      data-destructive={destructive || undefined}
      data-autofocus="preserve"
      data-block-outside-dismiss="true"
      onCloseAutoFocus={(event) => event.preventDefault()}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? "Đang xử lý…" : confirmLabel}
          </Button>
        </>
      }
    >
      {destructive && (
        <p className="sr-only">Thao tác này có thể gây mất dữ liệu và cần xác nhận rõ ràng.</p>
      )}
    </Modal>
  );
}
