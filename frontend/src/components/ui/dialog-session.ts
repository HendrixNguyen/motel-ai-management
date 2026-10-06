export function openDialogSession(dialog: Pick<HTMLDialogElement, "open" | "showModal" | "close" | "addEventListener" | "removeEventListener">, trigger: Pick<HTMLElement, "focus"> | null) {
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    trigger?.focus();
  };
  dialog.addEventListener("close", restore);
  dialog.showModal();
  return () => {
    dialog.removeEventListener("close", restore);
    if (dialog.open) dialog.close();
    restore();
  };
}
