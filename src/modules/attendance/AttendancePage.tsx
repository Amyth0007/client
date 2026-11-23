import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  AlertCircle,
  Building2,
  CalendarCheck,
  Camera,
  CheckCircle2,
  Clock3,
  Edit3,
  FileCheck2,
  History,
  MapPin,
  Save,
  ShieldCheck,
  Sliders,
  UserCheck,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext.js";
import {
  api,
  type AttendanceOfficeLocation,
  type AttendancePolicy,
  type AttendanceRecord,
} from "../../services/api-client.js";
import { Badge } from "../../components/common/Badge.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { EmptyState } from "../../components/common/EmptyState.js";
import { EvidencePreviewButton } from "../../components/common/EvidencePreviewButton.js";
import { Input } from "../../components/common/Input.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { CustomSelect } from "../../components/common/CustomSelect.js";
import { HelpGuide } from "../../components/common/HelpGuide.js";
import { Tabs } from "../../components/common/Tabs.js";
import { TextArea } from "../../components/common/TextArea.js";
import { Modal } from "../../components/common/Modal.js";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.js";
import { GuardAttendancePage } from "./GuardAttendancePage.js";
import { organizationModuleEnabled, userCanAccessModule } from "../platform/module-registry.js";
import { Link } from "react-router";

function dateInZone(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
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
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
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

type LocationForm = {
  id?: string;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  geofenceRadiusM: string;
  status: "active" | "inactive";
};
type PunchLocation = { latitude: number; longitude: number; gpsAccuracyM: number; capturedAt: number };
const emptyLocation: LocationForm = {
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  geofenceRadiusM: "100",
  status: "active",
};
const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function AttendancePage() {
  const { user } = useAuth();
  return user?.role === "guard" ? <GuardAttendancePage /> : <AttendanceWorkspace />;
}

function AttendanceWorkspace() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEnabled = userCanAccessModule(
    user?.role,
    user?.organization?.modules,
    user?.modulePermissions,
    "attendance",
    user?.modulePermissionsConfigured ?? false,
    user?.actionPermissions
  );
  const noAttendanceActions =
    user?.role === "sub_admin" &&
    organizationModuleEnabled(user.organization?.modules, "attendance") &&
    user.modulePermissionsConfigured &&
    user.modulePermissions?.attendance === true &&
    !(user.actionPermissions ?? []).some((permission) => permission.startsWith("attendance."));
  const hasPermission = (permission: string) =>
    user?.role === "org_admin" || Boolean(user?.actionPermissions?.includes(permission));
  const canViewAllRecords = hasPermission("attendance.view_all");
  const canAdjustAttendance = hasPermission("attendance.adjust");
  const canReviewCorrections = hasPermission("attendance.review_corrections");
  const canManageLocations = hasPermission("attendance.manage_locations");
  const canManagePolicy = hasPermission("attendance.manage_policy");
  const isOrgAdmin = canViewAllRecords || canReviewCorrections;
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
  const [locationToDeactivate, setLocationToDeactivate] = useState<any | null>(null);
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
  const [adjustStatus, setAdjustStatus] = useState<"present" | "half_day" | "absent" | "leave">("present");
  const [adjustCheckIn, setAdjustCheckIn] = useState("");
  const [adjustCheckOut, setAdjustCheckOut] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const { data: config, isLoading: configLoading, isError: configError } = useQuery({
    queryKey: ["attendance-config", user?.organizationId],
    queryFn: api.getAttendanceConfig,
    enabled: isEnabled,
  });

  useEffect(() => {
    if (config?.policy && !policyForm) setPolicyForm(config.policy);
    if (config?.locations) {
      const active = config.locations.filter((location) => location.status === "active");
      if (!active.some((location) => location.id === officeLocationId)) {
        setOfficeLocationId(active[0]?.id || "");
      }
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
    void video.play().catch(() =>
      toast.error("Could not start camera preview. Check browser camera permissions.")
    );
  }, [cameraOpen]);

  const { data: todayRecords, isLoading: todayLoading } = useQuery({
    queryKey: ["attendance-records", user?.organizationId, user?.id, today, today, "", "", ""],
    queryFn: async () => (await api.listAttendanceRecords({ from: today, to: today, page: 1, limit: 100 })).data,
    enabled: isEnabled && activeTab === "today",
  });
  const currentRecord = todayRecords?.find((record) => record.employeeId === user?.id) ?? null;
  const activeLocations = config?.locations.filter((location) => location.status === "active") ?? [];
  const gpsAccuracyThresholdM = config?.policy.gpsAccuracyThresholdM ?? 50;
  const strictLocation = config?.policy.locationVerificationRequired !== false;

  const { data: dashboard } = useQuery({
    queryKey: ["attendance-dashboard", user?.organizationId, today],
    queryFn: () => api.getAttendanceDashboard(today),
    enabled: isEnabled && canViewAllRecords && activeTab === "today",
  });
  const { data: employees } = useQuery({
    queryKey: ["attendance-employees", user?.organizationId],
    queryFn: () => api.listAttendanceEmployees(),
    enabled: isEnabled && (canViewAllRecords || canAdjustAttendance) && (activeTab === "today" || activeTab === "adjust"),
  });
  const { data: recordsResult, isLoading: recordsLoading } = useQuery({
    queryKey: [
      "attendance-records",
      user?.organizationId,
      fromDate,
      toDate,
      filterEmployeeId,
      filterOfficeId,
      filterStatus,
    ],
    queryFn: () =>
      api.listAttendanceRecords({
        from: fromDate || undefined,
        to: toDate || undefined,
        employeeId: canViewAllRecords ? filterEmployeeId || undefined : user?.id,
        officeLocationId: filterOfficeId || undefined,
        status: filterStatus || undefined,
        page: 1,
        limit: 100,
      }),
    enabled: isEnabled && activeTab === "records",
  });
  const { data: corrections } = useQuery({
    queryKey: ["attendance-corrections", canReviewCorrections ? "all" : user?.id],
    queryFn: async () => (await api.listAttendanceCorrections(!canReviewCorrections, { page: 1, limit: 100 })).data,
    enabled: isEnabled && activeTab === "corrections",
  });

  const pendingCorrectionsCount = corrections?.filter((c) => c.status === "pending").length ?? 0;

  const punchMutation = useMutation({
    mutationFn: async (action: "check-in" | "check-out") => {
      if (!navigator.onLine)
        throw new Error("Attendance requires an active internet connection. Offline records are not accepted.");
      if (!capturedPhoto) throw new Error("Open the camera and capture a current attendance photo first.");
      if (strictLocation && (!punchLocation || Date.now() - punchLocation.capturedAt > 120_000))
        throw new Error("Tap ‘Use my current location’ and get a fresh GPS reading first.");
      if (strictLocation && punchLocation && punchLocation.gpsAccuracyM > gpsAccuracyThresholdM)
        throw new Error(
          `Your GPS accuracy is ${Math.round(punchLocation.gpsAccuracyM)} m, but your organization requires ${gpsAccuracyThresholdM} m or better.`
        );
      if (strictLocation && action === "check-in" && !officeLocationId)
        throw new Error("Select an active office location first.");
      const uploaded = await api.uploadFile(capturedPhoto, "attendance_photo");
      const punch = {
        ...(punchLocation
          ? {
              latitude: punchLocation.latitude,
              longitude: punchLocation.longitude,
              gpsAccuracyM: punchLocation.gpsAccuracyM,
            }
          : {}),
        photoAssetId: uploaded.id,
      };
      return action === "check-in"
        ? api.checkInAttendance({ ...punch, ...(strictLocation ? { officeLocationId } : {}) })
        : api.checkOutAttendance(punch);
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
        toast.error(
          `Best location found is ${Math.round(fix.gpsAccuracyM)} m accuracy. Requires ${gpsAccuracyThresholdM} m or better.`
        );
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
          toast.error("Location permission is blocked. Allow location access in browser settings.");
        }
      },
      { enableHighAccuracy: true, timeout: 35_000, maximumAge: 0 }
    );
    timeoutId = window.setTimeout(() => {
      if (!bestFix) {
        finished = true;
        stopWatch();
        setLocatingPunch(false);
        toast.error("Could not determine your location. Ensure device location is on.");
        return;
      }
      finish(bestFix);
    }, 35_000);
  };

  const locationMutation = useMutation({
    mutationFn: async (payload: { values: Omit<AttendanceOfficeLocation, "id">; id?: string }) =>
      payload.id
        ? api.updateAttendanceLocation(payload.id, payload.values)
        : api.createAttendanceLocation(payload.values),
    onSuccess: async () => {
      toast.success("Office location saved");
      setLocationForm(emptyLocation);
      await queryClient.invalidateQueries({ queryKey: ["attendance-config"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteLocationMutation = useMutation({
    mutationFn: api.deleteAttendanceLocation,
    onSuccess: async (deleted) => {
      if (officeLocationId === deleted.id)
        setOfficeLocationId(
          config?.locations.find((location) => location.status === "active" && location.id !== deleted.id)?.id ?? ""
        );
      toast.success("Office location deactivated");
      await queryClient.invalidateQueries({ queryKey: ["attendance-config"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const policyMutation = useMutation({
    mutationFn: (policy: AttendancePolicy) => api.updateAttendancePolicy(policy),
    onSuccess: async (policy) => {
      setPolicyForm(policy);
      toast.success("Attendance rules saved");
      await queryClient.invalidateQueries({ queryKey: ["attendance-config"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const correctionMutation = useMutation({
    mutationFn: async (decision: { id: string; action: "approved" | "rejected"; comment: string }) =>
      api.reviewAttendanceCorrection(decision.id, decision.action, decision.comment),
    onSuccess: async () => {
      toast.success("Correction reviewed");
      await queryClient.invalidateQueries({ queryKey: ["attendance-corrections"] });
      await queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
      await queryClient.invalidateQueries({ queryKey: ["attendance-dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const correctionRequestMutation = useMutation({
    mutationFn: async () => {
      if (!correctionRecord || (!correctionCheckInAt.trim() && !correctionCheckOutAt.trim()) || !correctionReason.trim())
        throw new Error("Enter at least one corrected time and a reason.");
      const evidence = correctionEvidence
        ? await api.uploadFile(correctionEvidence, "attendance_correction")
        : null;
      return api.requestAttendanceCorrection({
        attendanceRecordId: correctionRecord.id,
        ...(correctionCheckInAt ? { requestedCheckInAt: zonedDateTimeToIso(correctionCheckInAt, timeZone) } : {}),
        ...(correctionCheckOutAt ? { requestedCheckOutAt: zonedDateTimeToIso(correctionCheckOutAt, timeZone) } : {}),
        reason: correctionReason,
        ...(evidence ? { evidenceFileAssetId: evidence.id } : {}),
      });
    },
    onSuccess: async () => {
      toast.success("Correction request sent to your administrator");
      setCorrectionRecord(null);
      setCorrectionReason("");
      setCorrectionCheckInAt("");
      setCorrectionCheckOutAt("");
      setCorrectionEvidence(null);
      await queryClient.invalidateQueries({ queryKey: ["attendance-corrections"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const adjustmentMutation = useMutation({
    mutationFn: () => {
      if (!adjustEmployeeId || !adjustDate || adjustReason.trim().length < 3)
        throw new Error("Choose an employee, date, and reason.");
      if (adjustStatus === "present" && !adjustCheckIn)
        throw new Error("Enter the manual check-in time for present attendance.");
      return api.adjustAttendance({
        employeeId: adjustEmployeeId,
        attendanceDate: adjustDate,
        status: adjustStatus,
        ...(adjustStatus === "present" || adjustStatus === "half_day"
          ? {
              ...(adjustCheckIn ? { checkInAt: zonedDateTimeToIso(adjustCheckIn, timeZone) } : {}),
              ...(adjustCheckOut ? { checkOutAt: zonedDateTimeToIso(adjustCheckOut, timeZone) } : {}),
            }
          : {}),
        reason: adjustReason.trim(),
      });
    },
    onSuccess: async () => {
      toast.success("Attendance updated and audit logged");
      setAdjustReason("");
      await queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
      await queryClient.invalidateQueries({ queryKey: ["attendance-dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Camera access is unavailable in this browser.");
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
    if (
      !video ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      toast.error("The camera is still starting. Wait until the live preview appears, then capture.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      toast.error("Could not capture the photo.");
      return;
    }
    context.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Could not capture the photo.");
          return;
        }
        if (photoPreview) URL.revokeObjectURL(photoPreview);
        const file = new File([blob], `attendance-${Date.now()}.jpg`, { type: "image/jpeg" });
        setCapturedPhoto(file);
        setPhotoPreview(URL.createObjectURL(file));
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setCameraOpen(false);
      },
      "image/jpeg",
      0.88
    );
  };

  const submitLocation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = {
      name: locationForm.name.trim(),
      address: locationForm.address.trim(),
      latitude: Number(locationForm.latitude),
      longitude: Number(locationForm.longitude),
      geofenceRadiusM: Number(locationForm.geofenceRadiusM),
      status: locationForm.status,
    };
    if (
      !Number.isFinite(values.latitude) ||
      !Number.isFinite(values.longitude) ||
      !Number.isFinite(values.geofenceRadiusM)
    ) {
      toast.error("Enter valid coordinates and a radius.");
      return;
    }
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
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Allow location access in your browser, then try again."
            : error.code === error.POSITION_UNAVAILABLE
              ? "Your device could not determine its location. Try again outdoors or enable device location."
              : "Location request timed out. Try again.";
        toast.error(message);
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 }
    );
  };

  const submitPolicy = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (policyForm) policyMutation.mutate(policyForm);
  };

  const submitCorrection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    correctionRequestMutation.mutate();
  };

  if (!isEnabled)
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <CalendarCheck className="mx-auto h-10 w-10 text-slate-400" />
        <h1 className="mt-4 text-xl font-semibold text-slate-900">
          {noAttendanceActions ? "No attendance actions assigned" : "Attendance is not enabled"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {noAttendanceActions
            ? "Your administrator enabled Attendance but has not assigned actions to your account."
            : "Ask your organization administrator to enable Attendance and assign your screen access."}
        </p>
      </div>
    );

  const tabs = [
    { id: "today", label: canViewAllRecords ? "Today & Overview" : "Clock In / Today", icon: CalendarCheck },
    { id: "records", label: canViewAllRecords ? "Attendance Records" : "My History", icon: History },
    ...(canAdjustAttendance ? [{ id: "adjust", label: "Manual Adjustments", icon: Edit3 }] : []),
    {
      id: "corrections",
      label: canReviewCorrections ? "Corrections Queue" : "My Corrections",
      icon: FileCheck2,
      count: pendingCorrectionsCount > 0 ? pendingCorrectionsCount : undefined,
    },
    ...(canManageLocations ? [{ id: "offices", label: "Office Geofencing", icon: Building2 }] : []),
    ...(canManagePolicy ? [{ id: "rules", label: "Policy & Rules", icon: Sliders }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance & Time Tracking"
        description="Verify daily check-ins with anti-spoof geofencing, shift recognition, break deductions, and punch regularization."
        action={(user?.role === "org_admin" || user?.role === "sub_admin" && (user.actionPermissions ?? []).some((permission) => ["attendance.guard_punch", "attendance.view_all", "attendance.adjust"].includes(permission))) ? <Link to="/guard/attendance" className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Open employee check-in</Link> : undefined}
      />

      {/* Screen Help & Workflow Guide */}
      <HelpGuide
        title="Attendance & Geofencing System"
        description="Real-time employee clock-in, geofence verification, shift break calculations, and correction workflows."
        whyThisExists="Guarantees verified employee presence at authorized offices with anti-spoof GPS accuracy and camera evidence, preventing buddy punching and automating payroll-ready work hours."
        steps={[
          {
            step: 1,
            title: "Office Geofence",
            description: "Admins configure authorized office locations and radius (e.g. 100m).",
            badge: "Admin",
          },
          {
            step: 2,
            title: "Shift Matching",
            description: "Scheduled shift, breaks, and flexible windows are automatically recognized on today's punch.",
            badge: "Auto",
          },
          {
            step: 3,
            title: "Punch & Evidence",
            description: "Employees take a photo within GPS geofence to record check-in and check-out.",
            badge: "Staff",
          },
          {
            step: 4,
            title: "Breaks & Payroll",
            description: "Unpaid breaks are automatically deducted, half-days flagged, and hours fed to daily earnings.",
            badge: "Payroll Ready",
          },
        ]}
        rules={[
          { label: "GPS Accuracy", value: `Must meet threshold (${gpsAccuracyThresholdM}m) to prevent mock locations.` },
          { label: "Unpaid Breaks", value: "Deducted automatically from working duration on check-out." },
          { label: "Late Threshold", value: "Punches past expected start + grace window are marked Late." },
          { label: "Regularisation", value: "Employees can submit missed punch correction requests with evidence." },
        ]}
        roles={[
          { role: "Org Admin / Sub-admin", summary: "Set office locations, adjust attendance, and review punch corrections." },
          { role: "Employees", summary: "Punch in/out with camera, view today's assigned shift, and submit corrections." },
        ]}
      />

      {/* Modern Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* TAB 1: TODAY & OVERVIEW */}
      {activeTab === "today" && (
        <div className="space-y-6">
          {/* Org Dashboard Stats */}
          {canViewAllRecords && dashboard && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
              {[
                { label: "Total Staff", value: dashboard.totalEmployees, icon: UserCheck, color: "text-slate-900" },
                { label: "Present Today", value: dashboard.presentToday, icon: CheckCircle2, color: "text-emerald-600" },
                { label: "Absent", value: dashboard.absentToday, icon: AlertCircle, color: "text-rose-600" },
                { label: "Late Arrivals", value: dashboard.lateArrivals, icon: Clock3, color: "text-amber-600" },
                { label: "Still Clocked In", value: dashboard.currentlyCheckedIn, icon: Building2, color: "text-indigo-600" },
                { label: "Pending Issues", value: dashboard.exceptions, icon: FileCheck2, color: "text-purple-600" },
              ].map((item) => (
                <Card key={item.label} className="p-4">
                  <div className="flex items-center justify-between text-slate-500">
                    <p className="text-xs font-medium">{item.label}</p>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <p className={`mt-2 text-2xl font-bold ${item.color}`}>{item.value}</p>
                </Card>
              ))}
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            {/* Clock-In Card */}
            <Card title="Today's Attendance Punch" subtitle={`Date: ${today} · Timezone: ${timeZone}`}>
              {todayLoading || configLoading ? (
                <p className="text-sm text-slate-600">Loading attendance status…</p>
              ) : configError ? (
                <p className="text-sm text-rose-700">Attendance settings could not be loaded.</p>
              ) : (
                <div className="space-y-4">
                  {/* Scheduled Shift Banner */}
                  {config?.todayShift && (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3.5 text-xs text-indigo-950">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-sm">
                          Scheduled Shift: {config.todayShift.name} ({config.todayShift.startTime}–{config.todayShift.endTime}
                          {config.todayShift.crossesMidnight ? " · Overnight" : ""})
                        </span>
                        {config.todayShift.isWeeklyOff && <Badge variant="info">Weekly Off Today</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-slate-600">
                        {config.todayShift.flexibleWindowMinutes > 0 && (
                          <span>• {config.todayShift.flexibleWindowMinutes}m flexible start</span>
                        )}
                        {config.todayShift.breaks?.length > 0 && (
                          <span>
                            • Breaks:{" "}
                            {config.todayShift.breaks
                              .map((b) => `${b.name} ${b.startTime}–${b.endTime}${b.paid ? " (paid)" : ""}`)
                              .join(", ")}
                          </span>
                        )}
                        {config.todayShift.weeklyOffs?.length > 0 && (
                          <span>• Weekly off: {config.todayShift.weeklyOffs.map((d) => weekDays[d]).join(", ")}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Checked-in status */}
                  {currentRecord?.checkIn && currentRecord.status !== "absent" && currentRecord.status !== "leave" ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm">
                      <p className="font-semibold text-emerald-900">
                        Checked in {displayTime(currentRecord.checkIn.at, timeZone)}
                      </p>
                      <p className="mt-1 text-emerald-800 text-xs">
                        {currentRecord.manualAdjustment
                          ? "Admin-entered attendance"
                          : currentRecord.officeName ||
                            config?.locations.find((location) => location.id === currentRecord.officeLocationId)?.name}{" "}
                        ·{" "}
                        {currentRecord.checkIn.locationVerification === "not_enforced"
                          ? "Location checks disabled"
                          : currentRecord.manualAdjustment
                            ? "Manually adjusted"
                            : `GPS ${currentRecord.checkIn.gpsAccuracyM?.toFixed(0) ?? "—"} m accuracy`}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant={currentRecord.manualAdjustment ? "info" : "success"}>
                          {currentRecord.manualAdjustment
                            ? "Admin adjusted"
                            : currentRecord.checkIn.locationVerification === "not_enforced"
                              ? "Location not required"
                              : "Location verified"}
                        </Badge>
                        <Badge variant={currentRecord.lateArrival ? "warning" : "success"}>
                          {currentRecord.lateArrival ? "Late arrival" : "On time"}
                        </Badge>
                        {currentRecord.checkIn.photoAssetId && (
                          <EvidencePreviewButton fileId={currentRecord.checkIn.photoAssetId} label="View check-in photo" />
                        )}
                        {mapUrl(currentRecord.checkIn) && (
                          <a
                            href={mapUrl(currentRecord.checkIn)!}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 underline"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            Check-in map
                          </a>
                        )}
                      </div>

                      {currentRecord.checkOut && (
                        <div className="mt-3 border-t border-emerald-200 pt-3">
                          <p className="font-medium text-slate-800">
                            Checked out {displayTime(currentRecord.checkOut.at, timeZone)}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            Total: {Math.floor((currentRecord.totalWorkingMinutes ?? 0) / 60)}h{" "}
                            {(currentRecord.totalWorkingMinutes ?? 0) % 60}m{" "}
                            {Boolean(currentRecord.unpaidBreakMinutes) &&
                              `(${currentRecord.unpaidBreakMinutes}m unpaid break deducted)`}{" "}
                            {currentRecord.halfDay && <Badge variant="warning">Half day</Badge>}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-3">
                            {currentRecord.checkOut.photoAssetId && (
                              <EvidencePreviewButton
                                fileId={currentRecord.checkOut.photoAssetId}
                                label="View check-out photo"
                              />
                            )}
                            {mapUrl(currentRecord.checkOut) && (
                              <a
                                href={mapUrl(currentRecord.checkOut)!}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 underline"
                              >
                                <MapPin className="h-3.5 w-3.5" />
                                Check-out map
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {currentRecord.status === "completed" && currentRecord.correctedCheckOutAt && (
                        <div className="mt-3 border-t border-emerald-200 pt-3">
                          <p className="text-xs font-semibold text-slate-800">
                            Checked out {displayTime(currentRecord.correctedCheckOutAt, timeZone)}{" "}
                            <Badge variant="info">Admin approved correction</Badge>
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            Total: {Math.floor((currentRecord.totalWorkingMinutes ?? 0) / 60)}h{" "}
                            {(currentRecord.totalWorkingMinutes ?? 0) % 60}m{" "}
                            {Boolean(currentRecord.unpaidBreakMinutes) &&
                              `(${currentRecord.unpaidBreakMinutes}m unpaid break deducted)`}{" "}
                            {currentRecord.halfDay && <Badge variant="warning">Half day</Badge>}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : currentRecord?.status === "absent" || currentRecord?.status === "leave" ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      <p className="font-semibold">Today marked {currentRecord.status} by your administrator.</p>
                      <p className="mt-1 text-xs">{currentRecord.manualAdjustment?.reason}</p>
                    </div>
                  ) : (
                    <>
                      {/* Check-In Form Controls */}
                      {strictLocation && (
                        <div>
                          <CustomSelect
                            id="attendance-office"
                            label="Select Office Location"
                            value={officeLocationId}
                            onChange={(event) => setOfficeLocationId(event.target.value)}
                            options={activeLocations.map((location) => ({
                              value: location.id,
                              label: location.name,
                              sublabel: `${location.geofenceRadiusM}m geofence`,
                            }))}
                            placeholder="Choose your reporting office"
                          />
                          {activeLocations.length === 0 && (
                            <p className="mt-1 text-xs text-rose-700">
                              Your administrator needs to add an active office location.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Photo Capture Section */}
                      <div className="space-y-3 rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Attendance Selfie Photo</p>
                            <p className="text-xs text-slate-500">
                              A clear photo is captured as attendance evidence. No facial biometric models are stored.
                            </p>
                          </div>
                          <Camera className="h-5 w-5 text-indigo-600" />
                        </div>
                        {cameraOpen ? (
                          <div className="space-y-3">
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              onLoadedMetadata={() => setCameraReady(Boolean(videoRef.current?.videoWidth))}
                              onCanPlay={() => setCameraReady(true)}
                              className="max-h-72 w-full rounded-lg bg-slate-900 object-cover"
                            />
                            <p className="text-xs text-slate-500">
                              {cameraReady ? "Camera live and ready" : "Starting camera preview…"}
                            </p>
                            <div className="flex gap-2">
                              <Button type="button" size="sm" disabled={!cameraReady} onClick={capturePhoto}>
                                Capture photo
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  streamRef.current?.getTracks().forEach((track) => track.stop());
                                  streamRef.current = null;
                                  setCameraReady(false);
                                  setCameraOpen(false);
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-3">
                            {photoPreview && (
                              <img
                                src={photoPreview}
                                alt="Captured attendance evidence"
                                className="h-20 w-20 rounded-lg border border-slate-200 object-cover shadow-xs"
                              />
                            )}
                            <Button type="button" size="sm" variant="outline" onClick={() => openCamera()}>
                              <Camera className="h-4 w-4" />
                              {capturedPhoto ? "Retake photo" : "Open camera"}
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Geolocation Section */}
                      {strictLocation && (
                        <div className="space-y-2 rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                          <div className="flex flex-wrap items-center gap-3">
                            <Button
                              type="button"
                              variant="outline"
                              isLoading={locatingPunch}
                              onClick={capturePunchLocation}
                            >
                              <MapPin className="h-4 w-4" />
                              Use my current location
                            </Button>
                            {punchLocation && (
                              <span
                                className={`text-xs font-medium ${
                                  punchLocation.gpsAccuracyM <= gpsAccuracyThresholdM &&
                                  Date.now() - punchLocation.capturedAt <= 120_000
                                    ? "text-emerald-700"
                                    : "text-rose-700"
                                }`}
                              >
                                Accuracy: {Math.round(punchLocation.gpsAccuracyM)}m
                                {punchLocation.gpsAccuracyM <= gpsAccuracyThresholdM
                                  ? " · Geofence ready"
                                  : ` · Requires ${gpsAccuracyThresholdM}m or better`}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">
                            Strict geofence enabled. Location must be verified within the selected office radius.
                          </p>
                        </div>
                      )}

                      <Button
                        disabled={
                          (strictLocation && activeLocations.length === 0) ||
                          !capturedPhoto ||
                          (strictLocation &&
                            (!punchLocation ||
                              punchLocation.gpsAccuracyM > gpsAccuracyThresholdM ||
                              Date.now() - punchLocation.capturedAt > 120_000))
                        }
                        isLoading={punchMutation.isPending}
                        onClick={() => punchMutation.mutate("check-in")}
                      >
                        <CalendarCheck className="h-4 w-4" />
                        Check In Now
                      </Button>
                    </>
                  )}

                  {/* Check-out Action Card */}
                  {currentRecord?.status === "checked_in" && (
                    <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                      <p className="text-xs font-semibold text-slate-800">
                        Check-out requires a fresh photo{strictLocation ? " and verified location" : ""}.
                      </p>
                      {cameraOpen ? (
                        <div className="space-y-3">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            onLoadedMetadata={() => setCameraReady(Boolean(videoRef.current?.videoWidth))}
                            onCanPlay={() => setCameraReady(true)}
                            className="max-h-72 w-full rounded-lg bg-slate-900 object-cover"
                          />
                          <p className="text-xs text-slate-500">
                            {cameraReady ? "Camera live and ready" : "Starting camera preview…"}
                          </p>
                          <div className="flex gap-2">
                            <Button type="button" size="sm" disabled={!cameraReady} onClick={capturePhoto}>
                              Capture check-out photo
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                streamRef.current?.getTracks().forEach((track) => track.stop());
                                streamRef.current = null;
                                setCameraReady(false);
                                setCameraOpen(false);
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3">
                          {photoPreview && (
                            <img
                              src={photoPreview}
                              alt="Captured check-out evidence"
                              className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                            />
                          )}
                          <Button type="button" size="sm" variant="outline" onClick={() => openCamera()}>
                            <Camera className="h-4 w-4" />
                            {capturedPhoto ? "Retake photo" : "Open camera"}
                          </Button>
                        </div>
                      )}

                      {strictLocation && (
                        <div className="flex flex-wrap items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            isLoading={locatingPunch}
                            onClick={capturePunchLocation}
                          >
                            <MapPin className="h-4 w-4" />
                            Use my current location
                          </Button>
                          {punchLocation && (
                            <span className="text-xs text-slate-700">
                              Accuracy: {Math.round(punchLocation.gpsAccuracyM)}m
                            </span>
                          )}
                        </div>
                      )}

                      <Button
                        type="button"
                        size="sm"
                        isLoading={punchMutation.isPending}
                        disabled={
                          !capturedPhoto ||
                          (strictLocation &&
                            (!punchLocation ||
                              punchLocation.gpsAccuracyM > gpsAccuracyThresholdM ||
                              Date.now() - punchLocation.capturedAt > 120_000))
                        }
                        onClick={() => punchMutation.mutate("check-out")}
                      >
                        Check Out & Complete Day
                      </Button>
                    </div>
                  )}

                  {currentRecord?.status === "completed" && (
                    <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-800">
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                      Your attendance is complete for today.
                    </p>
                  )}
                </div>
              )}
            </Card>

            {/* Quick Rules Snapshot */}
            <Card title="Current Rules Summary" subtitle="Organization Schedule">
              <div className="space-y-3 text-xs text-slate-700">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="flex items-center gap-2 font-semibold text-slate-900">
                    <Clock3 className="h-4 w-4 text-indigo-600" />
                    Standard Schedule
                  </p>
                  <p className="mt-1 text-slate-600">
                    Expected: {config?.policy.expectedCheckIn} – {config?.policy.expectedCheckOut} ({timeZone})
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-slate-500">Grace period</p>
                    <p className="mt-1 text-base font-bold text-slate-900">{config?.policy.gracePeriodMinutes ?? 15}m</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-slate-500">GPS Tolerance</p>
                    <p className="mt-1 text-base font-bold text-slate-900">{gpsAccuracyThresholdM}m</p>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-slate-500">Half-day threshold</p>
                  <p className="mt-1 text-base font-bold text-slate-900">{config?.policy.halfDayHours ?? 4} Hours</p>
                  <p className="mt-1 text-[11px] text-slate-500">Working fewer hours flags the record as half-day.</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: ATTENDANCE RECORDS */}
      {activeTab === "records" && (
        <Card
          title={canViewAllRecords ? "Organization Attendance Records" : "My Attendance History"}
          subtitle="All punch logs with verified timestamps, GPS coordinates, and break deductions"
        >
          {/* Filters */}
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Input label="From Date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            <Input label="To Date" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            {isOrgAdmin && (
              <CustomSelect
                label="Employee"
                value={filterEmployeeId}
                onChange={(event) => setFilterEmployeeId(event.target.value)}
                options={[
                  { value: "", label: "All Employees" },
                  ...(employees?.data ?? []).map((employee: { id: string; name: string }) => ({
                    value: employee.id,
                    label: employee.name,
                  })),
                ]}
              />
            )}
            <CustomSelect
              label="Office Location"
              value={filterOfficeId}
              onChange={(event) => setFilterOfficeId(event.target.value)}
              options={[
                { value: "", label: "All Offices" },
                ...(config?.locations ?? []).map((loc) => ({
                  value: loc.id,
                  label: loc.name,
                })),
              ]}
            />
            <CustomSelect
              label="Punch Status"
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              options={[
                { value: "", label: "All Statuses" },
                { value: "checked_in", label: "Checked In" },
                { value: "completed", label: "Completed" },
                { value: "present", label: "Present" },
                { value: "half_day", label: "Half day" },
                { value: "absent", label: "Absent" },
                { value: "leave", label: "On Leave" },
              ]}
            />
          </div>

          {recordsLoading ? (
            <p className="p-8 text-center text-sm text-slate-500">Loading history records…</p>
          ) : (recordsResult?.data.length ?? 0) === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="No attendance records found"
              description="Records matching your date and filter criteria will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                    <th className="px-4 py-3">Date & Shift</th>
                    {isOrgAdmin && <th className="px-4 py-3">Employee</th>}
                    <th className="px-4 py-3">Office Location</th>
                    <th className="px-4 py-3">Check-In</th>
                    <th className="px-4 py-3">Check-Out & Hours</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Photo Evidence</th>
                    <th className="px-4 py-3">GPS Location</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recordsResult?.data.map((record) => {
                    const pendingCorrection = corrections?.some(
                      (correction) => correction.attendanceRecordId === record.id && correction.status === "pending"
                    );
                    return (
                      <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-900">{record.attendanceDate}</span>
                          {record.shiftName && (
                            <span className="block text-[11px] font-medium text-indigo-700">{record.shiftName}</span>
                          )}
                        </td>
                        {isOrgAdmin && (
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {record.employee?.name || "Employee"}
                          </td>
                        )}
                        <td className="px-4 py-3 text-slate-600">
                          {record.officeName ||
                            config?.locations.find((l) => l.id === record.officeLocationId)?.name ||
                            "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div>{displayTime(record.checkIn?.at, timeZone)}</div>
                          {record.lateArrival && <Badge variant="warning">Late arrival</Badge>}
                        </td>
                        <td className="px-4 py-3">
                          <div>{displayTime(record.checkOut?.at || record.correctedCheckOutAt, timeZone)}</div>
                          {record.totalWorkingMinutes != null && (
                            <div className="text-[11px] text-slate-500 font-medium">
                              {Math.floor(record.totalWorkingMinutes / 60)}h {record.totalWorkingMinutes % 60}m
                              {record.unpaidBreakMinutes ? ` (-${record.unpaidBreakMinutes}m break)` : ""}
                            </div>
                          )}
                          {record.correctedCheckOutAt && <Badge variant="info">Corrected</Badge>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={record.status === "completed" ? "success" : "info"}>
                            {record.status.replace("_", " ")}
                          </Badge>
                          {record.halfDay && <Badge variant="warning">Half day</Badge>}
                        </td>
                        <td className="px-4 py-3 space-x-1 whitespace-nowrap">
                          {record.checkIn?.photoAssetId && (
                            <EvidencePreviewButton fileId={record.checkIn.photoAssetId} label="In Photo" />
                          )}
                          {record.checkOut?.photoAssetId && (
                            <EvidencePreviewButton fileId={record.checkOut.photoAssetId} label="Out Photo" />
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {mapUrl(record.checkIn) && (
                            <a
                              href={mapUrl(record.checkIn)!}
                              target="_blank"
                              rel="noreferrer"
                              className="mr-2 inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                            >
                              <MapPin className="h-3.5 w-3.5" />
                              In
                            </a>
                          )}
                          {mapUrl(record.checkOut) && (
                            <a
                              href={mapUrl(record.checkOut)!}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                            >
                              <MapPin className="h-3.5 w-3.5" />
                              Out
                            </a>
                          )}
                          {!mapUrl(record.checkIn) && !mapUrl(record.checkOut) && (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {!canReviewCorrections &&
                            record.employeeId === user?.id &&
                            record.checkIn &&
                            !record.manualAdjustment &&
                            (pendingCorrection ? (
                              <Badge variant="warning">Pending review</Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setCorrectionRecord(record);
                                  setCorrectionCheckInAt("");
                                  setCorrectionCheckOutAt("");
                                  setCorrectionReason("");
                                }}
                              >
                                Request Correction
                              </Button>
                            ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: MANUAL ADJUSTMENTS */}
      {canAdjustAttendance && activeTab === "adjust" && (
        <Card
          title="Manual Attendance Adjustment"
          subtitle="Administratively record or adjust attendance for employees. Changes are audit-logged while retaining device punch history."
        >
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Record New Adjustment</h3>
            <p className="mb-4 mt-1 text-xs text-slate-600">
              Set Present, Absent, or Leave for an employee. Required for manual overrides, on-duty visits, or missed card events.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <CustomSelect
                label="Select Employee"
                value={adjustEmployeeId}
                onChange={(event) => setAdjustEmployeeId(event.target.value)}
                options={[
                  { value: "", label: "Select employee" },
                  ...(employees?.data ?? []).map((employee: { id: string; name: string }) => ({
                    value: employee.id,
                    label: employee.name,
                  })),
                ]}
                required
              />
              <Input
                label="Attendance Date"
                type="date"
                value={adjustDate}
                onChange={(event) => setAdjustDate(event.target.value)}
                required
              />
              <CustomSelect
                label="Attendance Status"
                value={adjustStatus}
                onChange={(event) => setAdjustStatus(event.target.value as "present" | "half_day" | "absent" | "leave")}
                options={[
                  { value: "present", label: "Present" },
                  { value: "half_day", label: "Half day" },
                  { value: "absent", label: "Absent" },
                  { value: "leave", label: "On Leave" },
                ]}
                required
              />
              {(adjustStatus === "present" || adjustStatus === "half_day") && (
                <>
                  <Input
                    label={adjustStatus === "present" ? "Manual Check-In Time" : "Manual Check-In Time (optional)"}
                    type="datetime-local"
                    value={adjustCheckIn}
                    onChange={(event) => setAdjustCheckIn(event.target.value)}
                    required={adjustStatus === "present"}
                  />
                  <Input
                    label="Manual Check-Out Time (Optional)"
                    type="datetime-local"
                    value={adjustCheckOut}
                    onChange={(event) => setAdjustCheckOut(event.target.value)}
                  />
                </>
              )}
              <div className="sm:col-span-2 lg:col-span-3">
                <Input
                  label="Adjustment Reason (Required for audit log)"
                  value={adjustReason}
                  onChange={(event) => setAdjustReason(event.target.value)}
                  placeholder="e.g., Client on-site visit, hardware punch failure verified by manager"
                  required
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                size="sm"
                isLoading={adjustmentMutation.isPending}
                onClick={() => adjustmentMutation.mutate()}
              >
                Save Attendance Adjustment
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* TAB 4: CORRECTIONS QUEUE */}
      {activeTab === "corrections" && (
        <Card
          title={canReviewCorrections ? "Attendance Correction Review Queue" : "My Attendance Correction Requests"}
          subtitle="Regularization requests submitted by employees for missed punches or timing adjustments"
        >
          {(corrections?.length ?? 0) === 0 ? (
            <EmptyState
              icon={FileCheck2}
              title="No correction requests"
              description="Correction requests requiring review or submitted by you will appear here."
            />
          ) : (
            <div className="space-y-3">
              {corrections?.map((correction) => (
                <div key={correction.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {correction.employee?.name || "My Request"} · {correction.attendanceDate || "Attendance"}
                      </p>
                      <p className="text-xs text-slate-500">Reason: {correction.reason}</p>
                    </div>
                    <Badge
                      variant={
                        correction.status === "approved"
                          ? "success"
                          : correction.status === "rejected"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {correction.status}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">
                    {correction.currentCheckInAt && (
                      <span>Current check-in: {displayTime(correction.currentCheckInAt, timeZone)}</span>
                    )}
                    {correction.requestedCheckInAt && (
                      <span className="font-medium text-indigo-700">
                        Requested check-in: {displayTime(correction.requestedCheckInAt, timeZone)}
                      </span>
                    )}
                    {correction.currentCheckOutAt && (
                      <span>Current check-out: {displayTime(correction.currentCheckOutAt, timeZone)}</span>
                    )}
                    {correction.requestedCheckOutAt && (
                      <span className="font-medium text-indigo-700">
                        Requested check-out: {displayTime(correction.requestedCheckOutAt, timeZone)}
                      </span>
                    )}
                  </div>
                  {correction.reviewComment && (
                    <p className="mt-2 text-xs text-slate-600 bg-amber-50 p-2 rounded-lg">
                      <strong className="text-amber-900">Admin review note:</strong> {correction.reviewComment}
                    </p>
                  )}
                  {correction.evidenceFileAssetId && (
                    <div className="mt-2">
                      <EvidencePreviewButton
                        fileId={correction.evidenceFileAssetId}
                        label="View Supporting Image Evidence"
                      />
                    </div>
                  )}
                  {canReviewCorrections && correction.status === "pending" && (
                    <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                      <Button
                        size="sm"
                        isLoading={correctionMutation.isPending}
                        onClick={() =>
                          correctionMutation.mutate({
                            id: correction.id,
                            action: "approved",
                            comment: "",
                          })
                        }
                      >
                        Approve Regularisation
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        isLoading={correctionMutation.isPending}
                        onClick={() =>
                          correctionMutation.mutate({
                            id: correction.id,
                            action: "rejected",
                            comment: "",
                          })
                        }
                      >
                        Reject Request
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 5: OFFICE GEOFENCING */}
      {canManageLocations && activeTab === "offices" && (
        <Card
          title="Office Geofence Locations"
          subtitle="Configure physical office boundaries where staff are authorized to clock in."
        >
          <form onSubmit={submitLocation} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Location Name"
              required
              value={locationForm.name}
              onChange={(event) => setLocationForm({ ...locationForm, name: event.target.value })}
              placeholder="e.g. Headquarters, Bangalore Branch"
            />
            <Input
              label="Office Address"
              required
              value={locationForm.address}
              onChange={(event) => setLocationForm({ ...locationForm, address: event.target.value })}
              placeholder="Full physical street address"
            />
            <div className="flex flex-col justify-end gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                isLoading={locatingOffice}
                onClick={useCurrentOfficeLocation}
              >
                <MapPin className="h-4 w-4" />
                Capture My Coordinates
              </Button>
              <p className="text-[11px] text-slate-500">Requires browser GPS permissions</p>
            </div>
            <Input
              label="Latitude"
              type="number"
              step="any"
              min={-90}
              max={90}
              required
              value={locationForm.latitude}
              onChange={(event) => setLocationForm({ ...locationForm, latitude: event.target.value })}
            />
            <Input
              label="Longitude"
              type="number"
              step="any"
              min={-180}
              max={180}
              required
              value={locationForm.longitude}
              onChange={(event) => setLocationForm({ ...locationForm, longitude: event.target.value })}
            />
            <Input
              label="Geofence Radius (meters)"
              type="number"
              min={20}
              max={5000}
              required
              value={locationForm.geofenceRadiusM}
              onChange={(event) => setLocationForm({ ...locationForm, geofenceRadiusM: event.target.value })}
              helperText="Recommended: 100m - 200m to account for indoor GPS drift"
            />
            <CustomSelect
              label="Status"
              value={locationForm.status}
              onChange={(event) =>
                setLocationForm({ ...locationForm, status: event.target.value as "active" | "inactive" })
              }
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
            <div className="flex gap-2 sm:col-span-2 lg:col-span-3 mt-2">
              <Button type="submit" size="sm" isLoading={locationMutation.isPending}>
                {locationForm.id ? "Update Office Location" : "Add Office Location"}
              </Button>
              {locationForm.id && (
                <Button type="button" size="sm" variant="outline" onClick={() => setLocationForm(emptyLocation)}>
                  Cancel Edit
                </Button>
              )}
            </div>
          </form>

          <div className="mt-6 divide-y divide-slate-100 border-t border-slate-100 pt-4">
            <h4 className="mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Configured Offices</h4>
            {config?.locations.map((location) => (
              <div key={location.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {location.name}{" "}
                    <Badge variant={location.status === "active" ? "success" : "neutral"}>{location.status}</Badge>
                  </p>
                  <p className="text-xs text-slate-600">
                    {location.address} · Coordinates: {location.latitude}, {location.longitude} · Radius:{" "}
                    {location.geofenceRadiusM}m
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setLocationForm({
                        ...location,
                        latitude: String(location.latitude),
                        longitude: String(location.longitude),
                        geofenceRadiusM: String(location.geofenceRadiusM),
                      })
                    }
                  >
                    Edit
                  </Button>
                  {location.status === "active" && (
                    <Button
                      size="sm"
                      variant="danger"
                      isLoading={deleteLocationMutation.isPending}
                      onClick={() => setLocationToDeactivate(location)}
                    >
                      Deactivate
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 6: POLICY & RULES */}
      {canManagePolicy && activeTab === "rules" && (
        <Card
          title="Attendance Organization Policy"
          subtitle="Define schedule thresholds, GPS tolerances, and grace periods for late calculations"
        >
          {policyForm && (
            <form onSubmit={submitPolicy} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Input
                  label="Expected Check-In"
                  type="time"
                  value={policyForm.expectedCheckIn}
                  onChange={(event) => setPolicyForm({ ...policyForm, expectedCheckIn: event.target.value })}
                />
                <Input
                  label="Expected Check-Out"
                  type="time"
                  value={policyForm.expectedCheckOut}
                  onChange={(event) => setPolicyForm({ ...policyForm, expectedCheckOut: event.target.value })}
                />
                <Input
                  label="Grace Period (minutes)"
                  type="number"
                  min={0}
                  max={240}
                  value={policyForm.gracePeriodMinutes}
                  onChange={(event) =>
                    setPolicyForm({ ...policyForm, gracePeriodMinutes: Number(event.target.value) })
                  }
                  helperText="Lateness calculated after expected check-in + grace period."
                />
                <Input
                  label="Half-Day Threshold (hours)"
                  type="number"
                  min={1}
                  max={12}
                  step={0.5}
                  value={policyForm.halfDayHours}
                  onChange={(event) => setPolicyForm({ ...policyForm, halfDayHours: Number(event.target.value) })}
                  helperText="Shifts below this working duration flag half-day status."
                />
                <Input
                  label="Maximum GPS Accuracy (meters)"
                  type="number"
                  min={5}
                  max={500}
                  value={policyForm.gpsAccuracyThresholdM}
                  onChange={(event) =>
                    setPolicyForm({ ...policyForm, gpsAccuracyThresholdM: Number(event.target.value) })
                  }
                  helperText="Lower is stricter. 50m balances mobile accuracy and anti-spoofing."
                />
              </div>

              <fieldset className="rounded-xl border border-slate-200 p-4">
                <legend className="px-2 text-xs font-semibold text-slate-700">Weekly Off Days</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {weekDays.map((day, index) => (
                    <label key={day} className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={policyForm.weeklyHolidays.includes(index)}
                        onChange={(event) =>
                          setPolicyForm({
                            ...policyForm,
                            weeklyHolidays: event.target.checked
                              ? [...policyForm.weeklyHolidays, index].sort()
                              : policyForm.weeklyHolidays.filter((value) => value !== index),
                          })
                        }
                      />
                      {day}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="space-y-2 rounded-xl border border-slate-200 p-4">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={policyForm.correctionRequestsEnabled}
                    onChange={(event) =>
                      setPolicyForm({ ...policyForm, correctionRequestsEnabled: event.target.checked })
                    }
                  />
                  Allow employees to submit punch correction / regularization requests
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={policyForm.locationVerificationRequired}
                    onChange={(event) =>
                      setPolicyForm({ ...policyForm, locationVerificationRequired: event.target.checked })
                    }
                  />
                  Require strict device GPS location and office geofence verification
                </label>
              </div>

              <Button type="submit" size="sm" isLoading={policyMutation.isPending}>
                <Save className="h-4 w-4" />
                Save Attendance Rules
              </Button>
            </form>
          )}
        </Card>
      )}

      {/* MODAL: Request Attendance Correction */}
      <Modal
        isOpen={Boolean(correctionRecord)}
        onClose={() => setCorrectionRecord(null)}
        title="Request Attendance Correction"
        description={
          correctionRecord
            ? `${correctionRecord.attendanceDate} · Enter corrected times in ${timeZone}. Administrator will review.`
            : undefined
        }
      >
        <form onSubmit={submitCorrection} className="space-y-4">
          <Input
            label="Corrected Check-In Time (optional)"
            type="datetime-local"
            value={correctionCheckInAt}
            onChange={(event) => setCorrectionCheckInAt(event.target.value)}
          />
          <Input
            label="Corrected Check-Out Time (optional)"
            type="datetime-local"
            value={correctionCheckOutAt}
            onChange={(event) => setCorrectionCheckOutAt(event.target.value)}
          />
          <TextArea
            label="Reason for Regularisation"
            required
            minLength={3}
            maxLength={1000}
            value={correctionReason}
            onChange={(event) => setCorrectionReason(event.target.value)}
            placeholder="e.g. Forgot to punch check-out after closing shift; verified with manager"
          />
          <Input
            label="Supporting Evidence / Document (optional)"
            type="file"
            accept="image/*"
            onChange={(event) => setCorrectionEvidence(event.target.files?.[0] ?? null)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCorrectionRecord(null)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={correctionRequestMutation.isPending}>
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={Boolean(locationToDeactivate)} onClose={() => setLocationToDeactivate(null)} onConfirm={() => { if (locationToDeactivate) deleteLocationMutation.mutate(locationToDeactivate.id, { onSuccess: () => setLocationToDeactivate(null) }); }} title="Deactivate office location?" description={locationToDeactivate ? `Deactivate “${locationToDeactivate.name}”? Existing attendance records will remain available.` : ""} confirmLabel="Deactivate" busy={deleteLocationMutation.isPending} />
    </div>
  );
}
