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
import { userCanAccessModule } from "../platform/module-registry.js";

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

function mapUrl(punch: { latitude?: number | null; longitude?: number | null } | null | undefined) {
  if (punch?.latitude == null || punch.longitude == null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${punch.latitude},${punch.longitude}`)}`;
}

type LocationForm = { id?: string; name: string; address: string; latitude: string; longitude: string; geofenceRadiusM: string; status: "active" | "inactive" };
type PunchLocation = { latitude: number; longitude: number; gpsAccuracyM: number; capturedAt: number };
const emptyLocation: LocationForm = { name: "", address: "", latitude: "", longitude: "", geofenceRadiusM: "100", status: "active" };
const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function AttendancePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEnabled = userCanAccessModule(user?.role, user?.organization?.modules, user?.modulePermissions, "attendance", user?.modulePermissionsConfigured ?? false);
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
  const [correctionCheckInAt, setCorrectionCheckInAt] = useState("");
  const [correctionCheckOutAt, setCorrectionCheckOutAt] = useState("");
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
  const [activeTab, setActiveTab] = useState("today");
  const [adjustEmployeeId, setAdjustEmployeeId] = useState("");
  const [adjustDate, setAdjustDate] = useState(today);
  const [adjustStatus, setAdjustStatus] = useState<"present" | "absent" | "leave">("present");
  const [adjustCheckIn, setAdjustCheckIn] = useState("");
  const [adjustCheckOut, setAdjustCheckOut] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const { data: config, isLoading: configLoading, isError: configError } = useQuery({ queryKey: ["attendance-config", user?.organizationId], queryFn: api.getAttendanceConfig, enabled: isEnabled });
  useEffect(() => {
    if (config?.policy && !policyForm) setPolicyForm(config.policy);
    if (config?.locations) {
      const active = config.locations.filter((location) => location.status === "active");
      if (!active.some((location) => location.id === officeLocationId)) setOfficeLocationId(active[0]?.id || "");
    }
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
    queryKey: ["attendance-records", user?.organizationId, user?.id, today, today, "", "", ""],
    queryFn: async () => (await api.listAttendanceRecords({ from: today, to: today, page: 1, limit: 100 })).data,
    enabled: isEnabled,
  });
  const currentRecord = todayRecords?.find((record) => record.employeeId === user?.id) ?? null;
  const activeLocations = config?.locations.filter((location) => location.status === "active") ?? [];
  const gpsAccuracyThresholdM = config?.policy.gpsAccuracyThresholdM ?? 50;
  const strictLocation = config?.policy.locationVerificationRequired !== false;

  const { data: dashboard } = useQuery({ queryKey: ["attendance-dashboard", user?.organizationId, today], queryFn: () => api.getAttendanceDashboard(today), enabled: isEnabled && isOrgAdmin });
  const { data: employees } = useQuery({ queryKey: ["attendance-employees", user?.organizationId], queryFn: () => api.listEmployees({ page: 1, limit: 100 }), enabled: isEnabled && isOrgAdmin });
  const { data: recordsResult, isLoading: recordsLoading } = useQuery({
    queryKey: ["attendance-records", user?.organizationId, fromDate, toDate, filterEmployeeId, filterOfficeId, filterStatus],
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
      if (strictLocation && (!punchLocation || Date.now() - punchLocation.capturedAt > 120_000)) throw new Error("Tap ‘Use my current location’ and get a fresh GPS reading first.");
      if (strictLocation && punchLocation && punchLocation.gpsAccuracyM > gpsAccuracyThresholdM) throw new Error(`Your GPS accuracy is ${Math.round(punchLocation.gpsAccuracyM)} m, but your organization requires ${gpsAccuracyThresholdM} m or better.`);
      if (strictLocation && action === "check-in" && !officeLocationId) throw new Error("Select an active office location first.");
      const uploaded = await api.uploadFile(capturedPhoto, "attendance_photo");
      const punch = { ...(punchLocation ? { latitude: punchLocation.latitude, longitude: punchLocation.longitude, gpsAccuracyM: punchLocation.gpsAccuracyM } : {}), photoAssetId: uploaded.id };
      return action === "check-in" ? api.checkInAttendance({ ...punch, ...(strictLocation ? { officeLocationId } : {}) }) : api.checkOutAttendance(punch);
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
      if (strictLocation && fix.gpsAccuracyM > gpsAccuracyThresholdM) {
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
  const deleteLocationMutation = useMutation({
    mutationFn: api.deleteAttendanceLocation,
    onSuccess: async (deleted) => { if (officeLocationId === deleted.id) setOfficeLocationId(config?.locations.find((location) => location.status === "active" && location.id !== deleted.id)?.id ?? ""); toast.success("Office location deactivated"); await queryClient.invalidateQueries({ queryKey: ["attendance-config"] }); },
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
      if (!correctionRecord || (!correctionCheckInAt.trim() && !correctionCheckOutAt.trim()) || !correctionReason.trim()) throw new Error("Enter at least one corrected time and a reason.");
      const evidence = correctionEvidence ? await api.uploadFile(correctionEvidence, "attendance_correction") : null;
      return api.requestAttendanceCorrection({ attendanceRecordId: correctionRecord.id, ...(correctionCheckInAt ? { requestedCheckInAt: zonedDateTimeToIso(correctionCheckInAt, timeZone) } : {}), ...(correctionCheckOutAt ? { requestedCheckOutAt: zonedDateTimeToIso(correctionCheckOutAt, timeZone) } : {}), reason: correctionReason, ...(evidence ? { evidenceFileAssetId: evidence.id } : {}) });
    },
    onSuccess: async () => { toast.success("Correction request sent to your administrator"); setCorrectionRecord(null); setCorrectionReason(""); setCorrectionCheckInAt(""); setCorrectionCheckOutAt(""); setCorrectionEvidence(null); await queryClient.invalidateQueries({ queryKey: ["attendance-corrections"] }); },
    onError: (error: Error) => toast.error(error.message),
  });

  const adjustmentMutation = useMutation({
    mutationFn: () => {
      if (!adjustEmployeeId || !adjustDate || adjustReason.trim().length < 3) throw new Error("Choose an employee, date, and reason.");
      if (adjustStatus === "present" && !adjustCheckIn) throw new Error("Enter the manual check-in time for present attendance.");
      return api.adjustAttendance({ employeeId: adjustEmployeeId, attendanceDate: adjustDate, status: adjustStatus, ...(adjustStatus === "present" ? { checkInAt: zonedDateTimeToIso(adjustCheckIn, timeZone), ...(adjustCheckOut ? { checkOutAt: zonedDateTimeToIso(adjustCheckOut, timeZone) } : {}) } : {}), reason: adjustReason.trim() });
    },
    onSuccess: async () => { toast.success("Attendance updated and audit logged"); setAdjustReason(""); await queryClient.invalidateQueries({ queryKey: ["attendance-records"] }); await queryClient.invalidateQueries({ queryKey: ["attendance-dashboard"] }); },
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

      <div role="tablist" aria-label="Attendance sections" className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2">
        {(isOrgAdmin ? [{ id: "today", label: "Overview" }, { id: "records", label: "Records & adjustments" }, { id: "offices", label: "Office locations" }, { id: "rules", label: "Rules" }, { id: "corrections", label: "Corrections" }] : [{ id: "today", label: "Today" }, { id: "records", label: "History" }, { id: "corrections", label: "Corrections" }]).map((tab) => <button key={tab.id} role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${activeTab === tab.id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{tab.label}</button>)}
      </div>

      {activeTab === "today" && isOrgAdmin && dashboard && <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[{ label: "Employees", value: dashboard.totalEmployees }, { label: "Present", value: dashboard.presentToday }, { label: "Absent", value: dashboard.absentToday }, { label: "Late", value: dashboard.lateArrivals }, { label: "Still checked in", value: dashboard.currentlyCheckedIn }, { label: "Corrections", value: dashboard.exceptions }].map((item) => <Card key={item.label} className="p-4"><p className="text-xs text-slate-600">{item.label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{item.value}</p></Card>)}
      </div>}

      {(activeTab === "today" || (isOrgAdmin && activeTab === "rules")) && <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        {activeTab === "today" && <Card title="Today" subtitle={today}>
          {todayLoading || configLoading ? <p className="text-sm text-slate-600">Loading attendance…</p> : configError ? <p className="text-sm text-rose-700">Attendance settings could not be loaded.</p> : <div className="space-y-4">
            {currentRecord?.checkIn && currentRecord.status !== "absent" && currentRecord.status !== "leave" ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
              <p className="font-semibold text-emerald-900">Checked in {displayTime(currentRecord.checkIn.at, timeZone)}</p>
              <p className="mt-1 text-emerald-800">{currentRecord.manualAdjustment ? "Admin-entered attendance" : currentRecord.officeName || config?.locations.find((location) => location.id === currentRecord.officeLocationId)?.name} · {currentRecord.checkIn.locationVerification === "not_enforced" ? "Location checks disabled" : currentRecord.manualAdjustment ? "Manually adjusted" : `GPS ${currentRecord.checkIn.gpsAccuracyM?.toFixed(0) ?? "—"} m accuracy`}</p>
              <div className="mt-2 flex flex-wrap gap-2"><Badge variant={currentRecord.manualAdjustment ? "info" : "success"}>{currentRecord.manualAdjustment ? "Admin adjusted" : currentRecord.checkIn.locationVerification === "not_enforced" ? "Location not required" : "Location verified"}</Badge><Badge variant={currentRecord.lateArrival ? "warning" : "success"}>{currentRecord.lateArrival ? "Late arrival" : "On time"}</Badge>{currentRecord.checkIn.photoAssetId && <EvidencePreviewButton fileId={currentRecord.checkIn.photoAssetId} label="View check-in photo" />}{mapUrl(currentRecord.checkIn) && <a href={mapUrl(currentRecord.checkIn)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 underline"><MapPin className="h-3.5 w-3.5" />Check-in map</a>}</div>
              {currentRecord.checkOut && <div className="mt-3 border-t border-emerald-200 pt-3"><p>Checked out {displayTime(currentRecord.checkOut.at, timeZone)}</p><p className="mt-1">Total: {Math.floor((currentRecord.totalWorkingMinutes ?? 0) / 60)}h {(currentRecord.totalWorkingMinutes ?? 0) % 60}m {currentRecord.halfDay && <Badge variant="warning">Half day</Badge>}</p><div className="mt-2 flex flex-wrap gap-3">{currentRecord.checkOut.photoAssetId && <EvidencePreviewButton fileId={currentRecord.checkOut.photoAssetId} label="View check-out photo" />}{mapUrl(currentRecord.checkOut) && <a href={mapUrl(currentRecord.checkOut)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 underline"><MapPin className="h-3.5 w-3.5" />Check-out map</a>}</div></div>}
              {currentRecord.status === "completed" && currentRecord.correctedCheckOutAt && <div className="mt-3 border-t border-emerald-200 pt-3"><p>Checked out {displayTime(currentRecord.correctedCheckOutAt, timeZone)} <Badge variant="info">Admin approved correction</Badge></p><p className="mt-1">Total: {Math.floor((currentRecord.totalWorkingMinutes ?? 0) / 60)}h {(currentRecord.totalWorkingMinutes ?? 0) % 60}m {currentRecord.halfDay && <Badge variant="warning">Half day</Badge>}</p></div>}
            </div> : currentRecord?.status === "absent" || currentRecord?.status === "leave" ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Today marked {currentRecord.status} by your administrator.</p><p className="mt-1">{currentRecord.manualAdjustment?.reason}</p></div> : currentRecord?.correctedCheckOutAt ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Attendance completed with an approved correction.</p><p className="mt-1">Check-out {displayTime(currentRecord.correctedCheckOutAt, timeZone)}</p></div> : <>
              {strictLocation && <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700" htmlFor="attendance-office">Office location</label>
                <Select id="attendance-office" value={officeLocationId} onChange={(event) => setOfficeLocationId(event.target.value)} options={activeLocations.map((location) => ({ value: location.id, label: `${location.name} · ${location.geofenceRadiusM} m` }))} />
                {activeLocations.length === 0 && <p className="text-xs text-rose-700">Your administrator needs to add an active office location.</p>}
              </div>}
              <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">Attendance photo</p><p className="text-xs text-slate-600">A normal photo is saved as attendance evidence. No face recognition is used.</p></div><Camera className="h-5 w-5 text-indigo-600" /></div>
                {cameraOpen ? <div className="space-y-3"><video ref={videoRef} autoPlay playsInline onLoadedMetadata={() => setCameraReady(Boolean(videoRef.current?.videoWidth))} onCanPlay={() => setCameraReady(true)} className="max-h-72 w-full rounded-lg bg-slate-900 object-cover" /><p className="text-xs text-slate-500">{cameraReady ? "Camera ready" : "Starting camera preview…"}</p><div className="flex gap-2"><Button type="button" size="sm" disabled={!cameraReady} onClick={capturePhoto}>Capture photo</Button><Button type="button" size="sm" variant="outline" onClick={() => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setCameraReady(false); setCameraOpen(false); }}>Cancel</Button></div></div> : <div className="flex flex-wrap items-center gap-3">{photoPreview && <img src={photoPreview} alt="Captured attendance evidence" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />}<Button type="button" size="sm" variant="outline" onClick={() => void openCamera()}><Camera className="h-4 w-4" />{capturedPhoto ? "Retake photo" : "Open camera"}</Button></div>}
              </div>
              {strictLocation && <div className="space-y-2 rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" isLoading={locatingPunch} onClick={capturePunchLocation}><MapPin className="h-4 w-4" />Use my current location</Button>{punchLocation && <span className={`text-xs ${punchLocation.gpsAccuracyM <= gpsAccuracyThresholdM && Date.now() - punchLocation.capturedAt <= 120_000 ? "text-emerald-700" : "text-rose-700"}`}>Accuracy: {Math.round(punchLocation.gpsAccuracyM)} m{punchLocation.gpsAccuracyM <= gpsAccuracyThresholdM ? " · ready" : ` · needs ${gpsAccuracyThresholdM} m or better`}</span>}</div><p className="text-xs text-slate-500">Location verification is enabled by your administrator.</p></div>}
              {strictLocation && <p className="flex gap-2 text-xs text-slate-600"><MapPin className="h-4 w-4 shrink-0" />Location must be clearly inside the selected geofence. Readings near its boundary are rejected for retry.</p>}
              <Button disabled={(strictLocation && activeLocations.length === 0) || !capturedPhoto || (strictLocation && (!punchLocation || punchLocation.gpsAccuracyM > gpsAccuracyThresholdM || Date.now() - punchLocation.capturedAt > 120_000))} isLoading={punchMutation.isPending} onClick={() => punchMutation.mutate("check-in")}><CalendarCheck className="h-4 w-4" />Check In</Button>
            </>}</div>}
          {currentRecord?.status === "checked_in" && <div className="mt-4 space-y-3 border-t border-slate-100 pt-4"><p className="text-xs text-slate-600">Check-out requires a fresh photo{strictLocation ? " and verified location" : ""}.</p>{cameraOpen ? <div className="space-y-3"><video ref={videoRef} autoPlay playsInline onLoadedMetadata={() => setCameraReady(Boolean(videoRef.current?.videoWidth))} onCanPlay={() => setCameraReady(true)} className="max-h-72 w-full rounded-lg bg-slate-900 object-cover" /><p className="text-xs text-slate-500">{cameraReady ? "Camera ready" : "Starting camera preview…"}</p><div className="flex gap-2"><Button type="button" size="sm" disabled={!cameraReady} onClick={capturePhoto}>Capture check-out photo</Button><Button type="button" size="sm" variant="outline" onClick={() => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setCameraReady(false); setCameraOpen(false); }}>Cancel</Button></div></div> : <div className="flex flex-wrap items-center gap-3">{photoPreview && <img src={photoPreview} alt="Captured check-out evidence" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />}<Button type="button" size="sm" variant="outline" onClick={() => void openCamera()}><Camera className="h-4 w-4" />{capturedPhoto ? "Retake photo" : "Open camera"}</Button></div>}{strictLocation && <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" isLoading={locatingPunch} onClick={capturePunchLocation}><MapPin className="h-4 w-4" />Use my current location</Button>{punchLocation && <span className="text-xs">Accuracy: {Math.round(punchLocation.gpsAccuracyM)} m</span>}</div>}<Button type="button" size="sm" isLoading={punchMutation.isPending} disabled={!capturedPhoto || (strictLocation && (!punchLocation || punchLocation.gpsAccuracyM > gpsAccuracyThresholdM || Date.now() - punchLocation.capturedAt > 120_000))} onClick={() => punchMutation.mutate("check-out")}>Check Out</Button></div>}
          {currentRecord?.status === "completed" && <p className="mt-4 flex items-center gap-2 text-sm text-slate-700"><ShieldCheck className="h-4 w-4 text-emerald-600" />Your attendance is complete for today.</p>}
        </Card>}

        {(!isOrgAdmin || activeTab === "rules") && <Card title={isOrgAdmin ? "Attendance rules" : "How verification works"} subtitle={isOrgAdmin ? "Organization schedule and GPS tolerance" : "Current organization attendance settings"}>
          {!isOrgAdmin || !policyForm ? <div className="space-y-3 text-sm text-slate-700"><p className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-indigo-600" />Expected hours: {config?.policy.expectedCheckIn}–{config?.policy.expectedCheckOut} ({timeZone})</p><p>Grace period: {config?.policy.gracePeriodMinutes} minutes</p><p>Maximum GPS accuracy: {config?.policy.gpsAccuracyThresholdM} meters</p><p>Late arrivals are marked after the expected check-in plus grace period. Low-accuracy or boundary-ambiguous readings are not silently accepted.</p></div> : <form onSubmit={submitPolicy} className="space-y-4">
            <div className="grid grid-cols-2 gap-3"><Input label="Expected check-in" type="time" value={policyForm.expectedCheckIn} onChange={(event) => setPolicyForm({ ...policyForm, expectedCheckIn: event.target.value })} /><Input label="Expected check-out" type="time" value={policyForm.expectedCheckOut} onChange={(event) => setPolicyForm({ ...policyForm, expectedCheckOut: event.target.value })} /><Input label="Grace period (minutes)" type="number" min={0} max={240} value={policyForm.gracePeriodMinutes} onChange={(event) => setPolicyForm({ ...policyForm, gracePeriodMinutes: Number(event.target.value) })} /><Input label="Half-day threshold (hours)" type="number" min={1} max={12} step={0.5} value={policyForm.halfDayHours} onChange={(event) => setPolicyForm({ ...policyForm, halfDayHours: Number(event.target.value) })} /><Input label="Maximum GPS accuracy (meters)" type="number" min={5} max={500} helperText="10 m is very strict and may fail indoors or on desktop. A larger value is more practical, but less precise." value={policyForm.gpsAccuracyThresholdM} onChange={(event) => setPolicyForm({ ...policyForm, gpsAccuracyThresholdM: Number(event.target.value) })} /></div>
            <fieldset><legend className="mb-2 text-xs font-medium text-slate-700">Weekly holidays</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{weekDays.map((day, index) => <label key={day} className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={policyForm.weeklyHolidays.includes(index)} onChange={(event) => setPolicyForm({ ...policyForm, weeklyHolidays: event.target.checked ? [...policyForm.weeklyHolidays, index].sort() : policyForm.weeklyHolidays.filter((value) => value !== index) })} />{day}</label>)}</div></fieldset>
            <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={policyForm.correctionRequestsEnabled} onChange={(event) => setPolicyForm({ ...policyForm, correctionRequestsEnabled: event.target.checked })} />Allow employee correction requests</label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700"><input type="checkbox" checked={policyForm.locationVerificationRequired} onChange={(event) => setPolicyForm({ ...policyForm, locationVerificationRequired: event.target.checked })} />Require strict device location and office geofence verification</label>
            <Button type="submit" size="sm" isLoading={policyMutation.isPending}><Save className="h-4 w-4" />Save rules</Button>
          </form>}
        </Card>}
      </div>}

      {isOrgAdmin && activeTab === "offices" && <Card title="Office locations" subtitle="Manage the offices employees can check in from">
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
        <div className="mt-5 divide-y divide-slate-100">{config?.locations.map((location) => <div key={location.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-900">{location.name} <Badge variant={location.status === "active" ? "success" : "neutral"}>{location.status}</Badge></p><p className="text-xs text-slate-600">{location.address} · {location.latitude}, {location.longitude} · {location.geofenceRadiusM} m</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setLocationForm({ ...location, latitude: String(location.latitude), longitude: String(location.longitude), geofenceRadiusM: String(location.geofenceRadiusM) })}>Edit</Button>{location.status === "active" && <Button size="sm" variant="danger" isLoading={deleteLocationMutation.isPending} onClick={() => { if (window.confirm(`Deactivate ${location.name}? Existing attendance records remain available.`)) deleteLocationMutation.mutate(location.id); }}>Delete</Button>}</div></div>)}</div>
      </Card>}

      {activeTab === "records" && <Card title="Attendance history" subtitle={isOrgAdmin ? "Organization-wide records" : "Your own attendance records"}>
        {isOrgAdmin && <div className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4"><h3 className="text-sm font-semibold text-slate-900">Manual attendance adjustment</h3><p className="mb-3 mt-1 text-xs text-slate-600">Set present, absent, or leave for an employee. Changes are logged; original device punches are preserved.</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Select label="Employee" value={adjustEmployeeId} onChange={(event) => setAdjustEmployeeId(event.target.value)} options={[{ value: "", label: "Select employee" }, ...(employees?.data ?? []).map((employee: { id: string; name: string }) => ({ value: employee.id, label: employee.name }))]} /><Input label="Date" type="date" value={adjustDate} onChange={(event) => setAdjustDate(event.target.value)} /><Select label="Attendance" value={adjustStatus} onChange={(event) => setAdjustStatus(event.target.value as "present" | "absent" | "leave")} options={[{ value: "present", label: "Present" }, { value: "absent", label: "Absent" }, { value: "leave", label: "Leave" }]} />{adjustStatus === "present" && <><Input label="Check-in time" type="datetime-local" value={adjustCheckIn} onChange={(event) => setAdjustCheckIn(event.target.value)} /><Input label="Check-out time (optional)" type="datetime-local" value={adjustCheckOut} onChange={(event) => setAdjustCheckOut(event.target.value)} /></>}<Input label="Reason (required)" value={adjustReason} onChange={(event) => setAdjustReason(event.target.value)} /></div><Button className="mt-3" size="sm" isLoading={adjustmentMutation.isPending} onClick={() => adjustmentMutation.mutate()}>Save adjustment</Button></div>}
        {isOrgAdmin && <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Input label="From" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /><Input label="To" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /><Select label="Employee" value={filterEmployeeId} onChange={(event) => setFilterEmployeeId(event.target.value)} options={[{ value: "", label: "All employees" }, ...(employees?.data ?? []).map((employee: { id: string; name: string }) => ({ value: employee.id, label: employee.name }))]} /><Select label="Office" value={filterOfficeId} onChange={(event) => setFilterOfficeId(event.target.value)} options={[{ value: "", label: "All offices" }, ...(config?.locations ?? []).map((location) => ({ value: location.id, label: location.name }))]} /><Select label="Status" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} options={[{ value: "", label: "All statuses" }, { value: "checked_in", label: "Checked in" }, { value: "completed", label: "Completed" }, { value: "present", label: "Present" }, { value: "absent", label: "Absent" }, { value: "leave", label: "Leave" }]} /></div>}
        {recordsLoading ? <p className="text-sm text-slate-600">Loading history…</p> : (recordsResult?.data.length ?? 0) === 0 ? <EmptyState icon={CalendarCheck} title="No attendance records" description="Your verified attendance history will appear here." /> : <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-left text-xs"><thead><tr className="border-b border-slate-100 text-slate-600"><th className="px-4 py-3">Date</th>{isOrgAdmin && <th className="px-4 py-3">Employee</th>}<th className="px-4 py-3">Office</th><th className="px-4 py-3">Check-in</th><th className="px-4 py-3">Check-out</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Evidence</th><th className="px-4 py-3">Map</th><th className="px-4 py-3">Correction</th></tr></thead><tbody>{recordsResult?.data.map((record) => { const pendingCorrection = corrections?.some((correction) => correction.attendanceRecordId === record.id && correction.status === "pending"); return <tr key={record.id} className="border-b border-slate-50"><td className="px-4 py-3">{record.attendanceDate}</td>{isOrgAdmin && <td className="px-4 py-3">{record.employee?.name || "Employee"}</td>}<td className="px-4 py-3">{record.officeName || config?.locations.find((location) => location.id === record.officeLocationId)?.name}</td><td className="px-4 py-3">{displayTime(record.checkIn?.at, timeZone)}{record.lateArrival && <Badge variant="warning">Late</Badge>}</td><td className="px-4 py-3">{displayTime(record.checkOut?.at || record.correctedCheckOutAt, timeZone)}{record.correctedCheckOutAt && <Badge variant="info">Corrected</Badge>}</td><td className="px-4 py-3"><Badge variant={record.status === "completed" ? "success" : "info"}>{record.status.replace("_", " ")}</Badge>{record.halfDay && <Badge variant="warning">Half day</Badge>}</td><td className="px-4 py-3 space-x-2">{record.checkIn?.photoAssetId && <EvidencePreviewButton fileId={record.checkIn.photoAssetId} label="In photo" />}{record.checkOut?.photoAssetId && <EvidencePreviewButton fileId={record.checkOut.photoAssetId} label="Out photo" />}</td><td className="px-4 py-3 whitespace-nowrap">{mapUrl(record.checkIn) && <a href={mapUrl(record.checkIn)!} target="_blank" rel="noreferrer" aria-label="Open check-in location in Google Maps" title="Open check-in location in Google Maps" className="mr-3 inline-flex items-center gap-2 rounded-lg px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-50"><MapPin className="h-4 w-4" />In</a>}{mapUrl(record.checkOut) && <a href={mapUrl(record.checkOut)!} target="_blank" rel="noreferrer" aria-label="Open check-out location in Google Maps" title="Open check-out location in Google Maps" className="inline-flex items-center gap-2 rounded-lg px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-50"><MapPin className="h-4 w-4" />Out</a>}{!mapUrl(record.checkIn) && !mapUrl(record.checkOut) && <span className="text-slate-400">—</span>}</td><td className="px-4 py-3">{!isOrgAdmin && record.checkIn && !record.manualAdjustment && (pendingCorrection ? <Badge variant="warning">Pending review</Badge> : <Button size="sm" variant="outline" onClick={() => { setCorrectionRecord(record); setCorrectionCheckInAt(""); setCorrectionCheckOutAt(""); setCorrectionReason(""); }}>Request correction</Button>)}</td></tr>; })}</tbody></table></div>}
      </Card>}

      {activeTab === "corrections" && <Card title={isOrgAdmin ? "Attendance correction requests" : "My correction requests"} subtitle="Review or track requested check-out corrections">
        {(corrections?.length ?? 0) === 0 ? <p className="text-sm text-slate-600">No correction requests.</p> : <div className="space-y-3">{corrections?.map((correction) => <div key={correction.id} className="rounded-lg border border-slate-200 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-900">{correction.employee?.name || "My request"} · {correction.attendanceDate || "Attendance"}</p><Badge variant={correction.status === "approved" ? "success" : correction.status === "rejected" ? "danger" : "warning"}>{correction.status}</Badge></div><div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-700">{correction.currentCheckInAt && <span>Current check-in: {displayTime(correction.currentCheckInAt, timeZone)}</span>}{correction.requestedCheckInAt && <span>Requested check-in: {displayTime(correction.requestedCheckInAt, timeZone)}</span>}{correction.currentCheckOutAt && <span>Current check-out: {displayTime(correction.currentCheckOutAt, timeZone)}</span>}{correction.requestedCheckOutAt && <span>Requested check-out: {displayTime(correction.requestedCheckOutAt, timeZone)}</span>}</div><p className="mt-1 text-xs text-slate-700">{correction.reason}</p>{correction.reviewComment && <p className="mt-1 text-xs text-slate-600">Admin: {correction.reviewComment}</p>}{correction.evidenceFileAssetId && <div className="mt-2"><EvidencePreviewButton fileId={correction.evidenceFileAssetId} label="View supporting evidence" /></div>}{isOrgAdmin && correction.status === "pending" && <div className="mt-3 flex gap-2"><Button size="sm" isLoading={correctionMutation.isPending} onClick={() => correctionMutation.mutate({ id: correction.id, action: "approved", comment: window.prompt("Optional admin comment:")?.trim() ?? "" })}>Approve</Button><Button size="sm" variant="outline" isLoading={correctionMutation.isPending} onClick={() => correctionMutation.mutate({ id: correction.id, action: "rejected", comment: window.prompt("Optional reason for rejection:")?.trim() ?? "" })}>Reject</Button></div>}</div>)}</div>}
      </Card>}

      <Modal isOpen={Boolean(correctionRecord)} onClose={() => setCorrectionRecord(null)} title="Request attendance correction" description={correctionRecord ? `${correctionRecord.attendanceDate} · Enter one or both corrected times in ${timeZone}. Your administrator will review the request.` : undefined}>
        <form onSubmit={submitCorrection} className="space-y-4"><Input label="Corrected check-in time (optional)" type="datetime-local" value={correctionCheckInAt} onChange={(event) => setCorrectionCheckInAt(event.target.value)} /><Input label="Corrected check-out time (optional)" type="datetime-local" value={correctionCheckOutAt} onChange={(event) => setCorrectionCheckOutAt(event.target.value)} /><TextArea label="Reason" required minLength={3} maxLength={1000} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} /><Input label="Supporting image (optional)" type="file" accept="image/*" onChange={(event) => setCorrectionEvidence(event.target.files?.[0] ?? null)} /><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCorrectionRecord(null)}>Cancel</Button><Button type="submit" isLoading={correctionRequestMutation.isPending}>Send to administrator</Button></div></form>
      </Modal>
    </div>
  );
}
