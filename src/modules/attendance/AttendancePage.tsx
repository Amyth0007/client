import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { CalendarCheck, Camera, Clock3, MapPin, Save, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth/AuthContext.js";
import { api, type AttendanceOfficeLocation, type AttendancePolicy, type AttendanceRecord } from "../../services/api-client.js";
import { Badge } from "../../components/common/Badge.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { EmptyState } from "../../components/common/EmptyState.js";
import { EvidencePreviewButton } from "../../components/common/EvidencePreviewButton.js";
import { Input } from "../../components/common/Input.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Select } from "../../components/common/Select.js";
import { TextArea } from "../../components/common/TextArea.js";
import { Modal } from "../../components/common/Modal.js";

function dateInZone(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function zonedDateTimeToIso(value: string, timeZone: string) {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const targetWallTime = Date.UTC(year, month - 1, day, hour, minute);
  let guess = targetWallTime;
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    const actualWallTime = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
    guess += targetWallTime - actualWallTime;
  }
  return new Date(guess).toISOString();
}

function displayTime(value: string | null | undefined, timeZone: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { timeZone, dateStyle: "medium", timeStyle: "short" });
}

type LocationForm = { id?: string; name: string; address: string; latitude: string; longitude: string; geofenceRadiusM: string; status: "active" | "inactive" };
type PunchLocation = { latitude: number; longitude: number; gpsAccuracyM: number; capturedAt: number };
const emptyLocation: LocationForm = { name: "", address: "", latitude: "", longitude: "", geofenceRadiusM: "100", status: "active" };
const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function AttendancePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEnabled = user?.organization?.modules?.attendance === true;
  const isOrgAdmin = user?.role === "org_admin";
  const timeZone = user?.organization?.timezone || "Asia/Kolkata";
  const today = dateInZone(timeZone);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<File | null>(null);
  const [punchLocation, setPunchLocation] = useState<PunchLocation | null>(null);
  const [locatingPunch, setLocatingPunch] = useState(false);
  const [photoPreview, setPhotoPreview] = useState("");
  const [officeLocationId, setOfficeLocationId] = useState("");
  const [correctionRecord, setCorrectionRecord] = useState<AttendanceRecord | null>(null);
  const [correctionAt, setCorrectionAt] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionEvidence, setCorrectionEvidence] = useState<File | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [filterOfficeId, setFilterOfficeId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [locationForm, setLocationForm] = useState<LocationForm>(emptyLocation);
  const [locatingOffice, setLocatingOffice] = useState(false);
  const [policyForm, setPolicyForm] = useState<AttendancePolicy | null>(null);

  const { data: config, isLoading: configLoading, isError: configError } = useQuery({ queryKey: ["attendance-config"], queryFn: api.getAttendanceConfig, enabled: isEnabled });
  useEffect(() => {
    if (config?.policy && !policyForm) setPolicyForm(config.policy);
    if (config?.locations?.length && !officeLocationId) setOfficeLocationId(config.locations.find((location) => location.status === "active")?.id || "");
  }, [config, officeLocationId, policyForm]);
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!cameraOpen || !video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => toast.error("Could not start the camera preview. Check browser camera permissions."));
  }, [cameraOpen]);

  const { data: todayRecords, isLoading: todayLoading } = useQuery({
    queryKey: ["attendance-records", today, today, "", "", ""],
    queryFn: async () => (await api.listAttendanceRecords({ from: today, to: today, page: 1, limit: 20 })).data,
    enabled: isEnabled,
  });
  const currentRecord = todayRecords?.find((record) => record.employeeId === user?.id) ?? null;
  const activeLocations = config?.locations.filter((location) => location.status === "active") ?? [];
  const gpsAccuracyThresholdM = config?.policy.gpsAccuracyThresholdM ?? 50;

  const { data: dashboard } = useQuery({ queryKey: ["attendance-dashboard", today], queryFn: () => api.getAttendanceDashboard(today), enabled: isEnabled && isOrgAdmin });
  const { data: employees } = useQuery({ queryKey: ["attendance-employees"], queryFn: () => api.listEmployees({ page: 1, limit: 100 }), enabled: isEnabled && isOrgAdmin });
  const { data: recordsResult, isLoading: recordsLoading } = useQuery({
    queryKey: ["attendance-records", fromDate, toDate, filterEmployeeId, filterOfficeId, filterStatus],
    queryFn: () => api.listAttendanceRecords({ from: fromDate || undefined, to: toDate || undefined, employeeId: isOrgAdmin ? filterEmployeeId || undefined : user?.id, officeLocationId: filterOfficeId || undefined, status: filterStatus || undefined, page: 1, limit: 100 }),
    enabled: isEnabled,
  });
  const { data: corrections } = useQuery({
    queryKey: ["attendance-corrections", isOrgAdmin ? "all" : user?.id],
    queryFn: async () => (await api.listAttendanceCorrections(!isOrgAdmin, { page: 1, limit: 100 })).data,
    enabled: isEnabled,
  });

  const punchMutation = useMutation({
    mutationFn: async (action: "check-in" | "check-out") => {
      if (!navigator.onLine) throw new Error("Attendance requires an active internet connection. Offline records are not accepted.");
      if (!capturedPhoto) throw new Error("Open the camera and capture a current attendance photo first.");
      if (!punchLocation || Date.now() - punchLocation.capturedAt > 120_000) throw new Error("Tap ‘Use my current location’ and get a fresh GPS reading first.");
      if (punchLocation.gpsAccuracyM > gpsAccuracyThresholdM) throw new Error(`Your GPS accuracy is ${Math.round(punchLocation.gpsAccuracyM)} m, but your organization requires ${gpsAccuracyThresholdM} m or better. Try outdoors or ask your administrator to adjust the GPS threshold.`);
      if (action === "check-in" && !officeLocationId) throw new Error("Select an active office location first.");
      const uploaded = await api.uploadFile(capturedPhoto, "attendance_photo");
      const punch = { latitude: punchLocation.latitude, longitude: punchLocation.longitude, gpsAccuracyM: punchLocation.gpsAccuracyM, photoAssetId: uploaded.id };
      return action === "check-in" ? api.checkInAttendance({ ...punch, officeLocationId }) : api.checkOutAttendance(punch);
    },
    onSuccess: async (record) => {
      toast.success(record.status === "checked_in" ? "Checked in successfully" : "Checked out successfully");
      setCapturedPhoto(null);
      setPunchLocation(null);
      setPhotoPreview("");
      await queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
      await queryClient.invalidateQueries({ queryKey: ["attendance-dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const capturePunchLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location access is not available in this browser. Use a supported browser on HTTPS or localhost.");
      return;
    }
    setPunchLocation(null);
    setLocatingPunch(true);
    let watchId: number | null = null;
    let timeoutId: number | null = null;
    let bestFix: PunchLocation | null = null;
    let finished = false;
    const stopWatch = () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
    const finish = (fix: PunchLocation | null) => {
      if (finished) return;
      finished = true;
      stopWatch();
      setLocatingPunch(false);
      if (!fix) return;
      setPunchLocation(fix);
      if (fix.gpsAccuracyM > gpsAccuracyThresholdM) {
        toast.error(`Best location found is ${Math.round(fix.gpsAccuracyM)} m accuracy. This organization requires ${gpsAccuracyThresholdM} m or better. Try a phone outdoors; if this remains the best reading, ask an administrator to adjust the threshold.`);
      } else {
        toast.success(`Location ready · ${Math.round(fix.gpsAccuracyM)} m accuracy`);
      }
    };
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const fix = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          gpsAccuracyM: position.coords.accuracy,
          capturedAt: Date.now(),
        };
        if (!bestFix || fix.gpsAccuracyM < bestFix.gpsAccuracyM) bestFix = fix;
        setPunchLocation(bestFix);
        if (fix.gpsAccuracyM <= gpsAccuracyThresholdM) finish(fix);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          finished = true;
          stopWatch();
          setLocatingPunch(false);
          toast.error("Location permission is blocked. Allow Location for this site in your browser’s address bar/site settings, then tap Use my current location again.");
        }
      },
      { enableHighAccuracy: true, timeout: 35_000, maximumAge: 0 },
    );
    timeoutId = window.setTimeout(() => {
      if (!bestFix) {
        finished = true;
        stopWatch();
        setLocatingPunch(false);
        toast.error("The device could not determine your location. Turn on device Location and try outdoors or near a window.");
        return;
      }
      finish(bestFix);
    }, 35_000);
  };
  const locationMutation = useMutation({
    mutationFn: async (payload: { values: Omit<AttendanceOfficeLocation, "id">; id?: string }) => payload.id ? api.updateAttendanceLocation(payload.id, payload.values) : api.createAttendanceLocation(payload.values),
    onSuccess: async () => {
      toast.success("Office location saved");
      setLocationForm(emptyLocation);
      await queryClient.invalidateQueries({ queryKey: ["attendance-config"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const policyMutation = useMutation({
    mutationFn: (policy: AttendancePolicy) => api.updateAttendancePolicy(policy),
    onSuccess: async (policy) => { setPolicyForm(policy); toast.success("Attendance rules saved"); await queryClient.invalidateQueries({ queryKey: ["attendance-config"] }); },
    onError: (error: Error) => toast.error(error.message),
  });

  const correctionMutation = useMutation({
    mutationFn: async (decision: { id: string; action: "approved" | "rejected"; comment: string }) => api.reviewAttendanceCorrection(decision.id, decision.action, decision.comment),
    onSuccess: async () => { toast.success("Correction reviewed"); await queryClient.invalidateQueries({ queryKey: ["attendance-corrections"] }); await queryClient.invalidateQueries({ queryKey: ["attendance-records"] }); await queryClient.invalidateQueries({ queryKey: ["attendance-dashboard"] }); },
    onError: (error: Error) => toast.error(error.message),
  });

  const correctionRequestMutation = useMutation({
    mutationFn: async () => {
      if (!correctionRecord || !correctionAt.trim() || !correctionReason.trim()) throw new Error("Enter a proposed check-out time and reason.");
      const evidence = correctionEvidence ? await api.uploadFile(correctionEvidence, "attendance_correction") : null;
      return api.requestAttendanceCorrection({ attendanceRecordId: correctionRecord.id, requestedCheckOutAt: zonedDateTimeToIso(correctionAt, timeZone), reason: correctionReason, ...(evidence ? { evidenceFileAssetId: evidence.id } : {}) });
    },
    onSuccess: async () => { toast.success("Correction request submitted"); setCorrectionRecord(null); setCorrectionReason(""); setCorrectionAt(""); setCorrectionEvidence(null); await queryClient.invalidateQueries({ queryKey: ["attendance-corrections"] }); },
    onError: (error: Error) => toast.error(error.message),
  });

  const openCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is unavailable in this browser.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      setCameraReady(false);
      setCameraOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Camera permission is required.");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0 || video.videoHeight === 0) { toast.error("The camera is still starting. Wait until the live preview appears, then capture."); return; }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) { toast.error("Could not capture the photo."); return; }
    context.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) { toast.error("Could not capture the photo."); return; }
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      const file = new File([blob], `attendance-${Date.now()}.jpg`, { type: "image/jpeg" });
      setCapturedPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraOpen(false);
    }, "image/jpeg", 0.88);
  };

  const submitLocation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = { name: locationForm.name.trim(), address: locationForm.address.trim(), latitude: Number(locationForm.latitude), longitude: Number(locationForm.longitude), geofenceRadiusM: Number(locationForm.geofenceRadiusM), status: locationForm.status };
    if (!Number.isFinite(values.latitude) || !Number.isFinite(values.longitude) || !Number.isFinite(values.geofenceRadiusM)) { toast.error("Enter valid coordinates and a radius."); return; }
    locationMutation.mutate({ values, id: locationForm.id });
  };

  const useCurrentOfficeLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location access is not available in this browser.");
      return;
    }
    setLocatingOffice(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setLocatingOffice(false);
        toast.success(`Coordinates captured (about ${Math.round(position.coords.accuracy)} m accuracy).`);
      },
      (error) => {
        setLocatingOffice(false);
        const message = error.code === error.PERMISSION_DENIED
          ? "Allow location access in your browser, then try again."
          : error.code === error.POSITION_UNAVAILABLE
            ? "Your device could not determine its location. Try again outdoors or enable device location."
            : "Location request timed out. Try again.";
        toast.error(message);
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  };

  const submitPolicy = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (policyForm) policyMutation.mutate(policyForm); };

  const submitCorrection = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); correctionRequestMutation.mutate(); };

  if (!isEnabled) return <div className="mx-auto max-w-2xl py-16 text-center"><CalendarCheck className="mx-auto h-10 w-10 text-slate-400" /><h1 className="mt-4 text-xl font-semibold text-slate-900">Attendance is not enabled</h1><p className="mt-2 text-sm text-slate-600">Ask your organization administrator to enable the Attendance module.</p></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description="Check in and out using your current location and a fresh photo." />

      {isOrgAdmin && dashboard && <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[{ label: "Employees", value: dashboard.totalEmployees }, { label: "Present", value: dashboard.presentToday }, { label: "Absent", value: dashboard.absentToday }, { label: "Late", value: dashboard.lateArrivals }, { label: "Still checked in", value: dashboard.currentlyCheckedIn }, { label: "Corrections", value: dashboard.exceptions }].map((item) => <Card key={item.label} className="p-4"><p className="text-xs text-slate-600">{item.label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{item.value}</p></Card>)}
      </div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <Card title="Today" subtitle={today}>
          {todayLoading || configLoading ? <p className="text-sm text-slate-600">Loading attendance…</p> : configError ? <p className="text-sm text-rose-700">Attendance settings could not be loaded.</p> : <div className="space-y-4">
            {currentRecord?.checkIn ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
              <p className="font-semibold text-emerald-900">Checked in {displayTime(currentRecord.checkIn.at, timeZone)}</p>
              <p className="mt-1 text-emerald-800">{currentRecord.officeName || config?.locations.find((location) => location.id === currentRecord.officeLocationId)?.name} · GPS verified · {currentRecord.checkIn.gpsAccuracyM.toFixed(0)} m reported accuracy</p>
              <div className="mt-2 flex flex-wrap gap-2"><Badge variant="success">Location verified</Badge><Badge variant={currentRecord.lateArrival ? "warning" : "success"}>{currentRecord.lateArrival ? "Late arrival" : "On time"}</Badge><EvidencePreviewButton fileId={currentRecord.checkIn.photoAssetId} label="View check-in photo" /></div>
              {currentRecord.status === "completed" && currentRecord.checkOut && <div className="mt-3 border-t border-emerald-200 pt-3"><p>Checked out {displayTime(currentRecord.checkOut.at, timeZone)}</p><p className="mt-1">Total: {Math.floor((currentRecord.totalWorkingMinutes ?? 0) / 60)}h {(currentRecord.totalWorkingMinutes ?? 0) % 60}m {currentRecord.halfDay && <Badge variant="warning">Half day</Badge>}</p><div className="mt-2"><EvidencePreviewButton fileId={currentRecord.checkOut.photoAssetId} label="View check-out photo" /></div></div>}
              {currentRecord.status === "completed" && currentRecord.correctedCheckOutAt && <div className="mt-3 border-t border-emerald-200 pt-3"><p>Checked out {displayTime(currentRecord.correctedCheckOutAt, timeZone)} <Badge variant="info">Admin approved correction</Badge></p><p className="mt-1">Total: {Math.floor((currentRecord.totalWorkingMinutes ?? 0) / 60)}h {(currentRecord.totalWorkingMinutes ?? 0) % 60}m {currentRecord.halfDay && <Badge variant="warning">Half day</Badge>}</p></div>}
            </div> : currentRecord?.correctedCheckOutAt ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Attendance completed with an approved correction.</p><p className="mt-1">Check-out {displayTime(currentRecord.correctedCheckOutAt, timeZone)}</p></div> : <>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700" htmlFor="attendance-office">Office location</label>
                <Select id="attendance-office" value={officeLocationId} onChange={(event) => setOfficeLocationId(event.target.value)} options={activeLocations.map((location) => ({ value: location.id, label: `${location.name} · ${location.geofenceRadiusM} m` }))} />
                {activeLocations.length === 0 && <p className="text-xs text-rose-700">Your administrator needs to add an active office location.</p>}
              </div>
              <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">Attendance photo</p><p className="text-xs text-slate-600">A normal photo is saved as attendance evidence. No face recognition is used.</p></div><Camera className="h-5 w-5 text-indigo-600" /></div>
                {cameraOpen ? <div className="space-y-3"><video ref={videoRef} autoPlay playsInline onLoadedMetadata={() => setCameraReady(Boolean(videoRef.current?.videoWidth))} onCanPlay={() => setCameraReady(true)} className="max-h-72 w-full rounded-lg bg-slate-900 object-cover" /><p className="text-xs text-slate-500">{cameraReady ? "Camera ready" : "Starting camera preview…"}</p><div className="flex gap-2"><Button type="button" size="sm" disabled={!cameraReady} onClick={capturePhoto}>Capture photo</Button><Button type="button" size="sm" variant="outline" onClick={() => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setCameraReady(false); setCameraOpen(false); }}>Cancel</Button></div></div> : <div className="flex flex-wrap items-center gap-3">{photoPreview && <img src={photoPreview} alt="Captured attendance evidence" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />}<Button type="button" size="sm" variant="outline" onClick={() => void openCamera()}><Camera className="h-4 w-4" />{capturedPhoto ? "Retake photo" : "Open camera"}</Button></div>}
              </div>
              <div className="space-y-2 rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" isLoading={locatingPunch} onClick={capturePunchLocation}><MapPin className="h-4 w-4" />Use my current location</Button>{punchLocation && <span className={`text-xs ${punchLocation.gpsAccuracyM <= gpsAccuracyThresholdM && Date.now() - punchLocation.capturedAt <= 120_000 ? "text-emerald-700" : "text-rose-700"}`}>Accuracy: {Math.round(punchLocation.gpsAccuracyM)} m{punchLocation.gpsAccuracyM <= gpsAccuracyThresholdM ? " · ready" : ` · needs ${gpsAccuracyThresholdM} m or better`}</span>}</div><p className="text-xs text-slate-500">The browser asks for permission only if it has not already been granted or blocked. If no prompt appears, check the location permission beside the address bar. Use a phone outdoors for the best GPS accuracy.</p></div>
              <p className="flex gap-2 text-xs text-slate-600"><MapPin className="h-4 w-4 shrink-0" />Location must be clearly inside the selected geofence. Readings near its boundary are rejected for retry.</p>
              <Button disabled={activeLocations.length === 0 || !capturedPhoto || !punchLocation || punchLocation.gpsAccuracyM > gpsAccuracyThresholdM || Date.now() - punchLocation.capturedAt > 120_000} isLoading={punchMutation.isPending} onClick={() => punchMutation.mutate("check-in")}><CalendarCheck className="h-4 w-4" />Check In</Button>
            </>}</div>}
          {currentRecord?.status === "checked_in" && <div className="mt-4 space-y-3 border-t border-slate-100 pt-4"><p className="text-xs text-slate-600">Check-out requires a fresh photo and a new GPS reading.</p>{cameraOpen ? <div className="space-y-3"><video ref={videoRef} autoPlay playsInline onLoadedMetadata={() => setCameraReady(Boolean(videoRef.current?.videoWidth))} onCanPlay={() => setCameraReady(true)} className="max-h-72 w-full rounded-lg bg-slate-900 object-cover" /><p className="text-xs text-slate-500">{cameraReady ? "Camera ready" : "Starting camera preview…"}</p><div className="flex gap-2"><Button type="button" size="sm" disabled={!cameraReady} onClick={capturePhoto}>Capture check-out photo</Button><Button type="button" size="sm" variant="outline" onClick={() => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setCameraReady(false); setCameraOpen(false); }}>Cancel</Button></div></div> : <div className="flex flex-wrap items-center gap-3">{photoPreview && <img src={photoPreview} alt="Captured check-out evidence" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />}<Button type="button" size="sm" variant="outline" onClick={() => void openCamera()}><Camera className="h-4 w-4" />{capturedPhoto ? "Retake photo" : "Open camera"}</Button></div>}<div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" isLoading={locatingPunch} onClick={capturePunchLocation}><MapPin className="h-4 w-4" />Use my current location</Button>{punchLocation && <span className={`text-xs ${punchLocation.gpsAccuracyM <= gpsAccuracyThresholdM && Date.now() - punchLocation.capturedAt <= 120_000 ? "text-emerald-700" : "text-rose-700"}`}>Accuracy: {Math.round(punchLocation.gpsAccuracyM)} m{punchLocation.gpsAccuracyM <= gpsAccuracyThresholdM ? " · ready" : ` · needs ${gpsAccuracyThresholdM} m or better`}</span>}<Button type="button" size="sm" isLoading={punchMutation.isPending} disabled={!capturedPhoto || !punchLocation || punchLocation.gpsAccuracyM > gpsAccuracyThresholdM || Date.now() - punchLocation.capturedAt > 120_000} onClick={() => punchMutation.mutate("check-out")}>Check Out</Button></div><p className="text-xs text-slate-500">Use a phone outdoors for the best GPS reading. If the browser shows no permission prompt, review Location permission for this site.</p></div>}
          {currentRecord?.status === "completed" && <p className="mt-4 flex items-center gap-2 text-sm text-slate-700"><ShieldCheck className="h-4 w-4 text-emerald-600" />Your attendance is complete for today.</p>}
        </Card>

        <Card title={isOrgAdmin ? "Attendance rules" : "How verification works"} subtitle={isOrgAdmin ? "Organization schedule and GPS tolerance" : "Current organization attendance settings"}>
          {!isOrgAdmin || !policyForm ? <div className="space-y-3 text-sm text-slate-700"><p className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-indigo-600" />Expected hours: {config?.policy.expectedCheckIn}–{config?.policy.expectedCheckOut} ({timeZone})</p><p>Grace period: {config?.policy.gracePeriodMinutes} minutes</p><p>Maximum GPS accuracy: {config?.policy.gpsAccuracyThresholdM} meters</p><p>Late arrivals are marked after the expected check-in plus grace period. Low-accuracy or boundary-ambiguous readings are not silently accepted.</p></div> : <form onSubmit={submitPolicy} className="space-y-4">
            <div className="grid grid-cols-2 gap-3"><Input label="Expected check-in" type="time" value={policyForm.expectedCheckIn} onChange={(event) => setPolicyForm({ ...policyForm, expectedCheckIn: event.target.value })} /><Input label="Expected check-out" type="time" value={policyForm.expectedCheckOut} onChange={(event) => setPolicyForm({ ...policyForm, expectedCheckOut: event.target.value })} /><Input label="Grace period (minutes)" type="number" min={0} max={240} value={policyForm.gracePeriodMinutes} onChange={(event) => setPolicyForm({ ...policyForm, gracePeriodMinutes: Number(event.target.value) })} /><Input label="Half-day threshold (hours)" type="number" min={1} max={12} step={0.5} value={policyForm.halfDayHours} onChange={(event) => setPolicyForm({ ...policyForm, halfDayHours: Number(event.target.value) })} /><Input label="Maximum GPS accuracy (meters)" type="number" min={5} max={500} helperText="10 m is very strict and may fail indoors or on desktop. A larger value is more practical, but less precise." value={policyForm.gpsAccuracyThresholdM} onChange={(event) => setPolicyForm({ ...policyForm, gpsAccuracyThresholdM: Number(event.target.value) })} /></div>
            <fieldset><legend className="mb-2 text-xs font-medium text-slate-700">Weekly holidays</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{weekDays.map((day, index) => <label key={day} className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={policyForm.weeklyHolidays.includes(index)} onChange={(event) => setPolicyForm({ ...policyForm, weeklyHolidays: event.target.checked ? [...policyForm.weeklyHolidays, index].sort() : policyForm.weeklyHolidays.filter((value) => value !== index) })} />{day}</label>)}</div></fieldset>
            <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={policyForm.correctionRequestsEnabled} onChange={(event) => setPolicyForm({ ...policyForm, correctionRequestsEnabled: event.target.checked })} />Allow employee correction requests</label>
            <Button type="submit" size="sm" isLoading={policyMutation.isPending}><Save className="h-4 w-4" />Save rules</Button>
          </form>}
        </Card>
      </div>

      {isOrgAdmin && <Card title="Office locations" subtitle="Manage the offices employees can check in from">
        <form onSubmit={submitLocation} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="Location name" required value={locationForm.name} onChange={(event) => setLocationForm({ ...locationForm, name: event.target.value })} />
          <Input label="Office address" required value={locationForm.address} onChange={(event) => setLocationForm({ ...locationForm, address: event.target.value })} />
          <div className="flex flex-col justify-end gap-1"><Button type="button" size="sm" variant="outline" isLoading={locatingOffice} onClick={useCurrentOfficeLocation}><MapPin className="h-4 w-4" />Use my current location</Button><p className="text-xs text-slate-500">Allow browser location access. Works on HTTPS or localhost.</p></div>
          <Input label="Latitude" type="number" step="any" min={-90} max={90} required value={locationForm.latitude} onChange={(event) => setLocationForm({ ...locationForm, latitude: event.target.value })} />
          <Input label="Longitude" type="number" step="any" min={-180} max={180} required value={locationForm.longitude} onChange={(event) => setLocationForm({ ...locationForm, longitude: event.target.value })} />
          <Input label="Geofence radius (meters)" type="number" min={20} max={5000} required value={locationForm.geofenceRadiusM} onChange={(event) => setLocationForm({ ...locationForm, geofenceRadiusM: event.target.value })} />
          <Select label="Status" value={locationForm.status} onChange={(event) => setLocationForm({ ...locationForm, status: event.target.value as "active" | "inactive" })} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3"><Button type="submit" size="sm" isLoading={locationMutation.isPending}>{locationForm.id ? "Save location" : "Add office location"}</Button>{locationForm.id && <Button type="button" size="sm" variant="outline" onClick={() => setLocationForm(emptyLocation)}>Cancel edit</Button>}</div>
        </form>
        <div className="mt-5 divide-y divide-slate-100">{config?.locations.map((location) => <div key={location.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-900">{location.name} <Badge variant={location.status === "active" ? "success" : "neutral"}>{location.status}</Badge></p><p className="text-xs text-slate-600">{location.address} · {location.latitude}, {location.longitude} · {location.geofenceRadiusM} m</p></div><Button size="sm" variant="outline" onClick={() => setLocationForm({ ...location, latitude: String(location.latitude), longitude: String(location.longitude), geofenceRadiusM: String(location.geofenceRadiusM) })}>Edit</Button></div>)}</div>
      </Card>}

      <Card title="Attendance history" subtitle={isOrgAdmin ? "Organization-wide records" : "Your own attendance records"}>
        {isOrgAdmin && <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Input label="From" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /><Input label="To" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /><Select label="Employee" value={filterEmployeeId} onChange={(event) => setFilterEmployeeId(event.target.value)} options={[{ value: "", label: "All employees" }, ...(employees?.data ?? []).map((employee: { id: string; name: string }) => ({ value: employee.id, label: employee.name }))]} /><Select label="Office" value={filterOfficeId} onChange={(event) => setFilterOfficeId(event.target.value)} options={[{ value: "", label: "All offices" }, ...(config?.locations ?? []).map((location) => ({ value: location.id, label: location.name }))]} /><Select label="Status" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} options={[{ value: "", label: "All statuses" }, { value: "checked_in", label: "Checked in" }, { value: "completed", label: "Completed" }]} /></div>}
        {recordsLoading ? <p className="text-sm text-slate-600">Loading history…</p> : (recordsResult?.data.length ?? 0) === 0 ? <EmptyState icon={CalendarCheck} title="No attendance records" description="Your verified attendance history will appear here." /> : <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-xs"><thead><tr className="border-b border-slate-100 text-slate-600"><th className="py-2">Date</th>{isOrgAdmin && <th>Employee</th>}<th>Office</th><th>Check-in</th><th>Check-out</th><th>Status</th><th>Evidence</th><th /></tr></thead><tbody>{recordsResult?.data.map((record) => <tr key={record.id} className="border-b border-slate-50"><td className="py-3">{record.attendanceDate}</td>{isOrgAdmin && <td>{record.employee?.name || "Employee"}</td>}<td>{record.officeName || config?.locations.find((location) => location.id === record.officeLocationId)?.name}</td><td>{displayTime(record.checkIn?.at, timeZone)}{record.lateArrival && <Badge variant="warning">Late</Badge>}</td><td>{displayTime(record.checkOut?.at || record.correctedCheckOutAt, timeZone)}{record.correctedCheckOutAt && <Badge variant="info">Corrected</Badge>}</td><td><Badge variant={record.status === "completed" ? "success" : "info"}>{record.status.replace("_", " ")}</Badge>{record.halfDay && <Badge variant="warning">Half day</Badge>}</td><td className="space-x-1">{record.checkIn?.photoAssetId && <EvidencePreviewButton fileId={record.checkIn.photoAssetId} label="In photo" />}{record.checkOut?.photoAssetId && <EvidencePreviewButton fileId={record.checkOut.photoAssetId} label="Out photo" />}</td><td>{record.status === "checked_in" && !isOrgAdmin && <Button size="sm" variant="outline" onClick={() => { setCorrectionRecord(record); setCorrectionAt(`${record.attendanceDate}T${config?.policy.expectedCheckOut || "17:00"}`); }}>Request correction</Button>}</td></tr>)}</tbody></table></div>}
      </Card>

      <Card title={isOrgAdmin ? "Attendance correction requests" : "My correction requests"} subtitle="Review or track requested check-out corrections">
        {(corrections?.length ?? 0) === 0 ? <p className="text-sm text-slate-600">No correction requests.</p> : <div className="space-y-3">{corrections?.map((correction) => <div key={correction.id} className="rounded-lg border border-slate-200 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-900">{correction.employee?.name || "Correction request"} · {displayTime(correction.requestedCheckOutAt, timeZone)}</p><Badge variant={correction.status === "approved" ? "success" : correction.status === "rejected" ? "danger" : "warning"}>{correction.status}</Badge></div><p className="mt-1 text-xs text-slate-700">{correction.reason}</p>{correction.reviewComment && <p className="mt-1 text-xs text-slate-600">Admin: {correction.reviewComment}</p>}{correction.evidenceFileAssetId && <div className="mt-2"><EvidencePreviewButton fileId={correction.evidenceFileAssetId} label="View supporting evidence" /></div>}{isOrgAdmin && correction.status === "pending" && <div className="mt-3 flex gap-2"><Button size="sm" isLoading={correctionMutation.isPending} onClick={() => correctionMutation.mutate({ id: correction.id, action: "approved", comment: window.prompt("Optional admin comment:")?.trim() ?? "" })}>Approve</Button><Button size="sm" variant="outline" isLoading={correctionMutation.isPending} onClick={() => correctionMutation.mutate({ id: correction.id, action: "rejected", comment: window.prompt("Optional reason for rejection:")?.trim() ?? "" })}>Reject</Button></div>}</div>)}</div>}
      </Card>

      <Modal isOpen={Boolean(correctionRecord)} onClose={() => setCorrectionRecord(null)} title="Request attendance correction" description={correctionRecord ? `${correctionRecord.attendanceDate} · Proposed check-out is interpreted in ${timeZone}` : undefined}>
        <form onSubmit={submitCorrection} className="space-y-4"><Input label="Requested check-out time" type="datetime-local" required value={correctionAt} onChange={(event) => setCorrectionAt(event.target.value)} /><TextArea label="Reason" required minLength={3} maxLength={1000} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} /><Input label="Supporting evidence (optional)" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event) => setCorrectionEvidence(event.target.files?.[0] ?? null)} /><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCorrectionRecord(null)}>Cancel</Button><Button type="submit" isLoading={correctionRequestMutation.isPending}>Submit request</Button></div></form>
      </Modal>
    </div>
  );
}
