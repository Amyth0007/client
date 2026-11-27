import { useState, useRef } from "react";
import { UploadCloud, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "../../services/api-client.js";
import { IMAGE_ACCEPT, MAX_UPLOAD_BYTES, isImageFile, prepareImageForUpload } from "../../utils/image-upload.js";

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
  label = "Upload image (up to 10 MB)",
  onUploaded,
  accept = IMAGE_ACCEPT,
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    if (!isImageFile(file)) {
      setError("Choose a photo or image file. PDF and other documents are not accepted.");
      return;
    }
    setIsUploading(true);
    setFileName(file.name);
    try {
      const prepared = await prepareImageForUpload(file);
      if (prepared.size > MAX_UPLOAD_BYTES) throw new Error("This photo is larger than 10 MB. Please choose a smaller image.");
      const asset = await api.uploadFile(prepared, purpose);
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
    if (file) void handleFile(file);
    e.target.value = "";
  };

  const [isDragging, setIsDragging] = useState(false);
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !isUploading) void handleFile(file);
  };

  return (
    <div className="w-full">
      {label && <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>}
      <div
        role="button"
        tabIndex={0}
        onClick={() => !isUploading && inputRef.current?.click()}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !isUploading) { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center rounded-xl border border-dashed p-4 text-center transition-colors cursor-pointer ${isDragging ? "border-indigo-400 bg-indigo-50" : "border-slate-300 bg-white hover:bg-slate-50"}`}
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
            <span className="text-xs">Tap to take or choose a photo, or drag an image here</span>
            <span className="text-[11px] text-slate-400">JPG, PNG, HEIC, WEBP and other image formats</span>
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
