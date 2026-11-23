import { useState } from "react";
import { Modal } from "./Modal.js";
import { Button } from "./Button.js";

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, description, confirmLabel = "Confirm", busy = false }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void | Promise<unknown>; title: string; description: string; confirmLabel?: string; busy?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const handleConfirm = () => {
    if (busy || pending) return;
    const result = onConfirm();
    if (result && typeof (result as Promise<unknown>).then === "function") {
      setPending(true);
      return Promise.resolve(result).then(
        () => setPending(false),
        () => setPending(false),
      );
    }
  };
  const isBusy = busy || pending;
  return <Modal isOpen={isOpen} onClose={() => { if (!isBusy) onClose(); }} title={title} description={description} maxWidth="sm">
    <div className="flex justify-end gap-2">
      <Button variant="secondary" onClick={onClose} disabled={isBusy}>Keep</Button>
      <Button variant="danger" onClick={handleConfirm} isLoading={isBusy}>{isBusy ? "Working…" : confirmLabel}</Button>
    </div>
  </Modal>;
}
