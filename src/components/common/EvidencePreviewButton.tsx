import { useEffect, useState } from "react";
import { Eye, RefreshCw } from "lucide-react";
import { api } from "../../services/api-client.js";
import { Button } from "./Button.js";
import { Modal } from "./Modal.js";

export function EvidencePreviewButton({ fileId, label = "View evidence" }: { fileId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    let active = true;
    let objectUrl = "";
    setSource("");
    setMimeType("");
    setError("");
    api.getFileBlob(fileId).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
      setMimeType(blob.type || "application/octet-stream");
    }).catch((failure: unknown) => {
      if (active) setError(failure instanceof Error ? failure.message : "Could not load this file");
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, open, attempt]);

  return <>
    <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}><Eye className="h-4 w-4" /><span>{label}</span></Button>
    <Modal isOpen={open} onClose={() => setOpen(false)} title={label} description="Secure file preview" maxWidth="xl">
      {error ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-rose-50 p-4 text-sm text-rose-800"><span>{error}</span><Button type="button" size="sm" variant="outline" onClick={() => setAttempt((value) => value + 1)}><RefreshCw className="h-4 w-4" />Retry</Button></div>
        : !source ? <div className="flex min-h-40 items-center justify-center text-sm font-medium text-slate-600">Loading evidence…</div>
        : mimeType.startsWith("image/") ? <img src={source} alt={label} className="mx-auto max-h-[65vh] max-w-full rounded-lg object-contain" />
        : mimeType === "application/pdf" ? <iframe title={label} src={source} className="h-[65vh] w-full rounded-lg border border-slate-200" />
        : <div className="space-y-3 text-sm text-slate-800"><p>This file type cannot be previewed here.</p><a href={source} target="_blank" rel="noreferrer" className="font-semibold text-indigo-700 underline">Open file in a new tab</a></div>}
    </Modal>
  </>;
}
