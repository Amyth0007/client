import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, ImagePlus, RotateCcw, SwitchCamera } from "lucide-react";
import { toast } from "react-hot-toast";
import { api } from "../../services/api-client.js";
import { Button } from "../../components/common/Button.js";

export function VisitEvidenceCapture({ fileAssetId, onUploaded }: { fileAssetId: string | null; onUploaded: (id: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => toast.error("Could not start the camera preview."));
    }
  }, [cameraOpen, facing]);

  const startCamera = async (nextFacing = facing) => {
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: nextFacing } }, audio: false });
      streamRef.current = stream;
      setFacing(nextFacing);
      setCameraOpen(true);
    } catch {
      toast.error("Camera access was blocked or is unavailable. Choose a photo from your device instead.");
    }
  };

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file. PDFs are not accepted."); return; }
    setBusy(true);
    try {
      const asset = await api.uploadFile(file, "visit_evidence");
      onUploaded(asset.id);
      setFileName(file.name);
      stopCamera();
      toast.success("Visit photo uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image upload failed");
    } finally { setBusy(false); }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { toast.error("Wait for the camera preview, then take the photo."); return; }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) { toast.error("Could not capture the photo. Please try again."); return; }
    await upload(new File([blob], `visit-${Date.now()}.jpg`, { type: "image/jpeg" }));
  };

  return <div className="space-y-2">
    <p className="block text-xs font-medium text-slate-700">Visit photo evidence <span className="text-rose-600">(required)</span></p>
    {cameraOpen && <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-950 p-2">
      <video ref={videoRef} autoPlay playsInline className="max-h-72 w-full rounded-lg object-contain" />
      <div className="flex flex-wrap gap-2"><Button type="button" size="sm" isLoading={busy} onClick={() => void capture()}><Camera className="h-4 w-4"/>Capture photo</Button><Button type="button" size="sm" variant="outline" onClick={() => void startCamera(facing === "environment" ? "user" : "environment")}><SwitchCamera className="h-4 w-4"/>Switch camera</Button><Button type="button" size="sm" variant="outline" onClick={stopCamera}><RotateCcw className="h-4 w-4"/>Close camera</Button></div>
    </div>}
    <input ref={pickerRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} />
    <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" isLoading={busy} onClick={() => void startCamera()}><Camera className="h-4 w-4"/>Open camera</Button><Button type="button" size="sm" variant="outline" isLoading={busy} onClick={() => pickerRef.current?.click()}><ImagePlus className="h-4 w-4"/>Choose from device</Button></div>
    {fileAssetId && <p className="flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4"/>{fileName || "Visit image uploaded"}</p>}
    {!fileAssetId && <p className="text-xs text-rose-600">Upload or capture a visit photo before submitting.</p>}
  </div>;
}
