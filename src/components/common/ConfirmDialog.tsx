import { Modal } from "./Modal.js";
import { Button } from "./Button.js";

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, description, confirmLabel = "Confirm", busy = false }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; description: string; confirmLabel?: string; busy?: boolean;
}) {
  return <Modal isOpen={isOpen} onClose={onClose} title={title} description={description} maxWidth="sm">
    <div className="flex justify-end gap-2">
      <Button variant="secondary" onClick={onClose} disabled={busy}>Keep</Button>
      <Button variant="danger" onClick={onConfirm} disabled={busy}>{busy ? "Working…" : confirmLabel}</Button>
    </div>
  </Modal>;
}
