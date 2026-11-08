import { useState, useRef } from "react";
import { UploadCloud, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "../../services/api-client.js";

type FileUploadProps = {
  purpose:
    | "invoice_document"
    | "acknowledgement_evidence"
    | "payment_support"
    | "visit_evidence"
    | "commitment_evidence";
  label?: string;
  onUploaded: (fileAssetId: string) => void;
  accept?: string;
};

export function FileUpload({
  purpose,
  label = "Upload file (PDF, Image up to 10MB)",
  onUploaded,
  accept = "application/pdf,image/*",
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setIsUploading(true);
    setFileName(file.name);
    try {
      const asset = await api.uploadFile(file, purpose);
      onUploaded(asset.id);
    } catch (err: any) {
      setError(err?.message || "Upload failed");
      setFileName(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="w-full">
      {label && <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>}
      <div
        onClick={() => inputRef.current?.click()}
        className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 p-4 text-center hover:bg-slate-50 transition-colors cursor-pointer bg-white"
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />

        {isUploading ? (
          <div className="flex items-center gap-2 text-indigo-600 text-xs">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
            <span>Uploading {fileName}...</span>
          </div>
        ) : fileName ? (
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium">
            <CheckCircle2 className="h-4 w-4" />
            <span>Uploaded: {fileName}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-600">
            <UploadCloud className="h-5 w-5 text-slate-500" />
            <span className="text-xs">Click or drag file here</span>
          </div>
        )}
      </div>
      {error && (
        <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
