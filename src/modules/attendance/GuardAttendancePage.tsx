import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Camera, LogIn, LogOut, MapPin, ShieldCheck, SwitchCamera } from "lucide-react";
import { api } from "../../services/api-client.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { CustomSelect } from "../../components/common/CustomSelect.js";
import { PageHeader } from "../../components/common/PageHeader.js";

export function GuardAttendancePage() {
  const [people, setPeople] = useState<Array<{ id: string; name: string; email: string; employeeNumber?: string }>>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [config, setConfig] = useState<{ policy: any; locations: Array<{ id: string; name: string; address: string; status: string }> } | null>(null);
  const [officeLocationId, setOfficeLocationId] = useState("");
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [photoPreview, setPhotoPreview] = useState("");
  // Guards photograph the employee in front of them, so the back camera is the default; they can switch.
  const [facingMode, setFacingMode] = useState<"environment" | "user">(() => { try { return window.localStorage.getItem("guard-camera-facing") === "user" ? "user" : "environment"; } catch { return "environment"; } });
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  useEffect(() => { void Promise.all([api.listAttendanceEmployees(), api.getGuardAttendanceConfig()]).then(([result, guardConfig]) => { setPeople(result.data ?? []); setConfig(guardConfig); }).catch((error) => toast.error(error instanceof Error ? error.message : "Could not load attendance station")); }, []);
  useEffect(() => () => { streamRef.current?.getTracks().forEach((track) => track.stop()); }, []);
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);
  useEffect(() => { if (cameraOpen && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current; }, [cameraOpen]);
  const openCamera = async (mode: "environment" | "user" = facingMode) => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera capture is unavailable in this browser. Use the photo picker below.");
      streamRef.current?.getTracks().forEach((track) => track.stop());
      let stream: MediaStream;
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: mode } }, audio: false }); }
      catch { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: false }); } // devices with a single camera
      streamRef.current = stream;
      setCameraReady(false);
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOpen(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not open camera"); }
  };
  const switchCamera = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    try { window.localStorage.setItem("guard-camera-facing", next); } catch { /* storage unavailable */ }
    void openCamera(next);
  };
  const closeCamera = () => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setCameraReady(false); setCameraOpen(false); };
  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) { toast.error("Could not capture the photo. Please try again."); return; }
      const captured = new File([blob], `attendance-${Date.now()}.jpg`, { type: "image/jpeg" });
      setPhoto(captured); setPhotoPreview(URL.createObjectURL(captured)); closeCamera();
    }, "image/jpeg", 0.9);
  };
  const getDeviceLocation = async () => {
    if (!navigator.geolocation) throw new Error("This device does not support location capture.");
    return new Promise<{ latitude: number; longitude: number; gpsAccuracyM: number }>((resolve, reject) => navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, gpsAccuracyM: position.coords.accuracy }),
      () => reject(new Error("Location permission is needed to record this punch. Enable location and try again.")),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    ));
  };
  const punch = async (action: "check_in" | "check_out") => {
    if (!employeeId || !photo) { toast.error("Choose the employee and take a photo before recording attendance."); return; }
    const locationRequired = config?.policy?.locationVerificationRequired !== false;
    if (locationRequired && !officeLocationId) { toast.error("Choose the office location for this punch."); return; }
    setBusy(true);
    try {
      let position: { latitude: number; longitude: number; gpsAccuracyM: number } | undefined;
      try { position = await getDeviceLocation(); } catch (error) { if (locationRequired) throw error; }
      const uploaded = await api.uploadFile(photo, "attendance_photo");
      await api.guardAttendancePunch({ employeeId, action, photoAssetId: uploaded.id, ...(officeLocationId ? { officeLocationId } : {}), ...(position ?? {}) });
      toast.success(action === "check_in" ? "Check-in recorded with photo and location" : "Check-out recorded with photo and location"); setPhoto(null); setPhotoPreview(""); setPhotoInputKey((value) => value + 1);
    }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not record attendance"); }
    finally { setBusy(false); }
  };
  return <div className="mx-auto max-w-2xl space-y-6">
    <PageHeader title="Employee Check-in" description="Use this device to record an employee’s arrival and departure." />
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-700 to-teal-700 p-5 text-white"><div className="flex items-center gap-3"><ShieldCheck className="h-7 w-7"/><div><p className="font-bold">Guard attendance station</p><p className="text-sm text-emerald-100">Choose the employee, then record their check-in or check-out.</p></div></div></div>
    <Card title="Record attendance" subtitle="Times are recorded from this device at the moment you tap a button.">
      <div className="space-y-5"><CustomSelect label="Employee" required searchable value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} placeholder="Search employee by name, ID, or email" options={people.map((person) => ({ value: person.id, label: person.name, sublabel: [person.employeeNumber, person.email].filter(Boolean).join(" · ") }))}/>
        {Boolean(config?.locations?.length) && <CustomSelect label="Office location" required={config?.policy?.locationVerificationRequired !== false} value={officeLocationId} onChange={(event) => setOfficeLocationId(event.target.value)} placeholder="Choose the office where the punch is happening" options={config!.locations.filter((location) => location.status === "active").map((location) => ({ value: location.id, label: location.name, sublabel: location.address }))}/>}
        {!people.length && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">No active employee profiles are available. Add active employees in Workforce to enable attendance recording.</p>}
        <div className="rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 p-4 text-sm text-indigo-900"><span className="flex items-center gap-2 font-semibold"><Camera className="h-4 w-4"/>Take a check-in/out photo</span><span className="mt-1 block text-xs text-slate-600">Capture a live photo, or use the device camera/photo picker. A fresh photo is needed for each punch.</span>{cameraOpen ? <div className="mt-3 space-y-2"><video ref={videoRef} autoPlay playsInline onLoadedMetadata={() => setCameraReady(Boolean(videoRef.current?.videoWidth))} onCanPlay={() => setCameraReady(true)} className={`max-h-72 w-full rounded-lg bg-slate-900 object-cover ${facingMode === "user" ? "-scale-x-100" : ""}`}/><div className="flex flex-wrap gap-2"><Button type="button" size="sm" disabled={!cameraReady} onClick={capturePhoto}>Capture photo</Button><Button type="button" size="sm" variant="outline" onClick={switchCamera} title="Switch between front and back camera"><SwitchCamera className="mr-2 h-4 w-4"/>{facingMode === "environment" ? "Use front camera" : "Use back camera"}</Button><Button type="button" size="sm" variant="ghost" onClick={closeCamera}>Cancel</Button></div><p className="text-[11px] text-slate-500">Using the {facingMode === "environment" ? "back" : "front"} camera.</p></div> : <div className="mt-3 flex flex-wrap items-center gap-3">{photoPreview && <img src={photoPreview} alt="Attendance photo preview" className="h-20 w-20 rounded-lg border border-slate-200 object-cover"/>}<Button type="button" size="sm" variant="outline" onClick={() => openCamera()}><Camera className="mr-2 h-4 w-4"/>{photo ? "Retake photo" : "Open camera"}</Button><label className="cursor-pointer text-xs font-semibold text-indigo-700 hover:underline">Choose photo<input key={photoInputKey} className="sr-only" type="file" accept="image/*" capture={facingMode} onChange={(event) => { const file = event.target.files?.[0] ?? null; setPhoto(file); setPhotoPreview(file ? URL.createObjectURL(file) : ""); }}/></label></div>}</div>
        <div className="grid gap-3 sm:grid-cols-2"><Button disabled={!employeeId || !photo || busy} onClick={() => punch("check_in")}><LogIn className="mr-2 h-4 w-4"/>Check In</Button><Button disabled={!employeeId || !photo || busy} variant="secondary" onClick={() => punch("check_out")}><LogOut className="mr-2 h-4 w-4"/>Check Out</Button></div>
        <p className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500"/>{config?.policy?.locationVerificationRequired === false ? "Device location is recorded when available. Choose an office if configured." : `The device location is checked against the selected office. GPS must be accurate within ${config?.policy?.gpsAccuracyThresholdM ?? 50} metres.`}</p>
      </div>
    </Card>
  </div>;
}
