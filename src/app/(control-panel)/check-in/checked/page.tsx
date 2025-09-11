// src/app/check-in/checked/page.tsx
"use client";

import dayjs, { Dayjs } from "dayjs";
import duration from "dayjs/plugin/duration";
import * as React from "react";
dayjs.extend(duration);

import DownloadIcon from "@mui/icons-material/Download";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ReplayIcon from "@mui/icons-material/Replay";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from "@mui/icons-material/Search";
import StopIcon from "@mui/icons-material/Stop";
import {
  Alert,
  Box, // ⬅️ เพิ่ม Box เพื่อใช้กับ FusePageSimple
  Button,
  Chip,
  Divider,
  FormControl,
  FormLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";

// ⬅️ ใช้โครงหน้าแบบ Fuse
import FusePageSimple from "@fuse/core/FusePageSimple";

import TimeConfirmDialog from "./components/TimeConfirmDialog";
import WeightDialog, { RubberTypeOpt } from "./components/WeightDialog";

/* ================= CONFIG ================= */
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "/api";
const api = (path: string) =>
  `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

const EVENTS_API = (dateISO: string) =>
  api(`/bookings/events?date=${encodeURIComponent(dateISO)}`);
const UPDATE_BOOKING_API = api(`/bookings`);
const RUBBER_TYPES_API = api(`/bookings/rubber-types`);
const ME_API = api(`/admin/users/me`);
const UPDATE_DRAIN_API = (id: string) => api(`/bookings/${id}/drain`);
const UPDATE_WEIGHTS_API = (id: string) => api(`/bookings/${id}/weights`);
const UPDATE_CHECKIN_TIME_API = (id: string) =>
  api(`/bookings/${id}/check-in-time`);

type Perms = {
  create?: boolean;
  read?: boolean;
  update?: boolean;
  delete?: boolean;
  approve?: boolean;
};

const RADIUS = 1;
const FIELD_PROPS = { size: "medium", variant: "outlined" } as const;
const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: RADIUS } };

type BookingView = {
  id: string;
  bookingCode: string;
  sequence?: number | null;
  date: string;
  startTime: string;
  endTime?: string;
  supCode: string;
  supplierName: string;
  truckRegister: string;
  truckType?: string;
  rubberTypeName?: string;
  rubberTypeId?: string | null;
  recorder?: string;
  checkInTime?: string | null;

  weightIn?: number | null;
  weightInHead?: number | null;
  weightInTrailer?: number | null;
  rubberTypeHeadId?: string | null;
  rubberTypeTrailerId?: string | null;

  drainStartTime?: string | null; // HH:mm หรือ ISO
  drainStopTime?: string | null; // HH:mm หรือ ISO
};

function getStoredToken(): string | undefined {
  try {
    if (typeof window !== "undefined") {
      const fromLS = window.localStorage.getItem("backend_access_token");
      if (fromLS) return fromLS;
      const m = document.cookie
        ?.split(";")
        ?.map((s) => s.trim())
        ?.find((s) => s.startsWith("backend_access_token="));
      if (m) return decodeURIComponent(m.split("=")[1]);
    }
  } catch {}
  if (process.env.NEXT_PUBLIC_DEV_BACKEND_TOKEN) {
    return process.env.NEXT_PUBLIC_DEV_BACKEND_TOKEN;
  }
  return undefined;
}

function firstDefined<T>(
  ...cands: Array<T | null | undefined | "">
): T | undefined {
  for (const c of cands) {
    if (c !== undefined && c !== null && c !== "") return c as T;
  }
  return undefined;
}

async function fetchJSON<T>(
  url: string,
  init?: RequestInit,
  token?: string
): Promise<T> {
  const headers = new Headers(init?.headers || {});
  const bearer = token || getStoredToken();
  if (bearer && !headers.has("Authorization"))
    headers.set("Authorization", `Bearer ${bearer}`);
  if (!headers.has("Content-Type") && init?.body)
    headers.set("Content-Type", "application/json");

  const res = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
    headers,
  });
  const txt = await res.text().catch(() => "");
  const ct = res.headers.get("content-type") || "";

  if (!res.ok) {
    let message = txt || `HTTP ${res.status}`;
    try {
      const j = txt && ct.includes("application/json") ? JSON.parse(txt) : null;
      if (j?.error) message = typeof j.error === "string" ? j.error : message;
      if (j?.message)
        message = Array.isArray(j.message) ? j.message.join(", ") : j.message;
      if (/unauthorized|401/i.test(message))
        message = "Unauthorized (no credentials to call backend via proxy)";
    } catch {}
    throw new Error(message);
  }
  if (!txt) return {} as T;
  if (ct.includes("application/json")) return JSON.parse(txt) as T;
  return JSON.parse(txt) as T;
}

function rubberChipSx(name?: string) {
  const n = (name || "").toLowerCase();
  if (n.includes("fsc"))
    return { bgcolor: "#2e7d32", color: "#fff", fontWeight: 700 };
  if (n.includes("north-east") && n.includes("eudr"))
    return { bgcolor: "#00897b", color: "#fff", fontWeight: 700 };
  if (n.includes("eudr"))
    return { bgcolor: "#1565c0", color: "#fff", fontWeight: 700 };
  if (n.includes("north-east"))
    return { bgcolor: "#6a1b9a", color: "#fff", fontWeight: 700 };
  if (n.includes("regular"))
    return { bgcolor: "#455a64", color: "#fff", fontWeight: 700 };
  return { bgcolor: "#9e9e9e", color: "#fff", fontWeight: 700 };
}

function joinSupplierName(xp: any, raw: any) {
  const s = firstDefined<any>(xp?.supplier, raw?.supplier);
  const first = firstDefined(
    xp?.supplierFirstName,
    xp?.supplier_first_name,
    xp?.firstName,
    xp?.first_name,
    s?.firstName,
    s?.first_name,
    raw?.supplierFirstName,
    raw?.supplier_first_name,
    raw?.firstName,
    raw?.first_name
  );
  const last = firstDefined(
    xp?.supplierLastName,
    xp?.supplier_last_name,
    xp?.lastName,
    xp?.last_name,
    s?.lastName,
    s?.last_name,
    raw?.supplierLastName,
    raw?.supplier_last_name,
    raw?.lastName,
    raw?.last_name
  );
  const full = [first, last].filter(Boolean).join(" ").trim();
  return full || undefined;
}

function normalizeFromEvent(raw: any): BookingView {
  const xp = raw?.extendedProps ?? {};
  const supplierObj = firstDefined<any>(xp?.supplier, raw?.supplier);

  const supCode =
    firstDefined(
      xp?.supplier_code,
      xp?.supplierCode,
      supplierObj?.code,
      raw?.supplier_code,
      raw?.supplierCode,
      xp?.supCode,
      raw?.supCode
    ) || "-";

  const supplierName =
    firstDefined(
      xp?.supplier_name,
      xp?.supplierName,
      supplierObj?.name,
      joinSupplierName(xp, raw)
    ) || "";

  const recorder =
    firstDefined(
      xp?.recorded_by,
      xp?.recordedBy,
      xp?.recorder,
      raw?.recorded_by,
      raw?.recordedBy,
      raw?.recorder,
      xp?.createdBy?.name,
      raw?.createdBy?.name,
      xp?.created_by_name,
      raw?.created_by_name
    ) || "";

  // --- Rubber type resolve ---
  const rubberTypeName =
    firstDefined(
      xp?.rubber_type_name,
      raw?.rubberTypeName,
      raw?.rubber_type_name,
      // บางระบบส่งชื่อไว้ใน xp.rubber_type
      typeof xp?.rubber_type === "string" ? xp?.rubber_type : undefined
    ) || "";

  const rubberTypeId =
    firstDefined(
      xp?.rubber_type_id,
      raw?.rubberTypeId,
      raw?.rubber_type_id,
      // บางระบบส่ง id ไว้ใน xp.rubber_type
      typeof xp?.rubber_type === "string" ? xp?.rubber_type : undefined
    ) ?? null;

  return {
    id: String(raw?.id ?? raw?._id ?? xp?.booking_code ?? ""),
    bookingCode:
      firstDefined(
        xp?.booking_code,
        raw?.bookingCode,
        raw?.booking_code,
        raw?.code
      ) || "",
    sequence:
      Number(
        firstDefined(
          xp?.sequence,
          xp?.queue,
          raw?.sequence,
          raw?.queue,
          raw?.order
        ) as any
      ) || null,
    date: String(raw?.start ?? xp?.start ?? raw?.date ?? xp?.date).slice(0, 10),
    startTime: dayjs(firstDefined(raw?.start, xp?.start)).format("HH:mm"),
    endTime: firstDefined(raw?.end, xp?.end)
      ? dayjs(firstDefined(raw?.end, xp?.end)).format("HH:mm")
      : "",
    supCode,
    supplierName: supplierName.trim(),
    truckRegister:
      firstDefined(
        xp?.truck_register,
        raw?.truckRegister,
        raw?.truck_register
      ) || "",
    truckType:
      firstDefined(
        xp?.truck_type,
        xp?.truck_type_name,
        raw?.truckType,
        raw?.truck_type
      ) || "",
    rubberTypeName,
    // ⬇️ ใช้ถ้าคุณมีฟิลด์นี้ใน BookingView (แนะนำให้มี)
    rubberTypeId,

    recorder,
    checkInTime:
      firstDefined(xp?.check_in_time, raw?.checkInTime, raw?.check_in_time) ??
      null,

    weightIn:
      firstDefined(xp?.weight_in, raw?.weightIn, raw?.weight_in) ?? null,
    // ✅ แก้พิมพ์ผิด (เดิม raw?.WeightInHead)
    weightInHead: firstDefined(xp?.weight_in_head, raw?.weightInHead) ?? null,
    weightInTrailer:
      firstDefined(xp?.weight_in_trailer, raw?.weightInTrailer) ?? null,
    rubberTypeHeadId:
      firstDefined(xp?.rubber_type_head, raw?.rubberTypeHeadId) ?? null,
    rubberTypeTrailerId:
      firstDefined(xp?.rubber_type_trailer, raw?.rubberTypeTrailerId) ?? null,

    drainStartTime:
      firstDefined(
        xp?.drain_start_time,
        raw?.drainStartTime,
        raw?.drain_start_time
      ) ?? null,
    drainStopTime:
      firstDefined(
        xp?.drain_stop_time,
        raw?.drainStopTime,
        raw?.drain_stop_time
      ) ?? null,
  };
}

function readRole(obj: any): string {
  return String(
    obj?.role ?? obj?.user?.role ?? obj?.user?.role?.name ?? ""
  ).toLowerCase();
}
function readPermObject(obj: any): any {
  return (
    obj?.permission ??
    obj?.permissions ??
    obj?.user?.permission ??
    obj?.user?.permissions ??
    {}
  );
}
function mergePermsWithRole(base: Partial<Perms>, role: string): Perms {
  const r = (role || "").toLowerCase();
  if (r === "admin")
    return {
      create: true,
      read: true,
      update: true,
      delete: true,
      approve: true,
    };
  if (r === "staff")
    return {
      create: base.create ?? true,
      read: base.read ?? true,
      update: true,
      delete: base.delete ?? false,
      approve: base.approve ?? false,
    };
  return {
    create: !!base.create,
    read: base.read ?? true,
    update: !!base.update,
    delete: !!base.delete,
    approve: !!base.approve,
  };
}
function seedPermsFromSession(session: any): Perms {
  if (!session) return {};
  const role = readRole(session);
  const p = readPermObject(session);
  const base: Partial<Perms> = {
    create: !!p.create,
    read: p.read ?? true,
    update: !!p.update,
    delete: !!p.delete,
    approve: !!p.approve,
  };
  return mergePermsWithRole(base, role);
}

function isTrailer(truckType?: string) {
  const t = (truckType || "").toLowerCase();
  return t.includes("พ่วง") || t.includes("trailer");
}

/** ===== Helpers: Drain time display (HH:mm:ss) ===== */
function isHHmm(v?: string | null) {
  return typeof v === "string" && /^\d{2}:\d{2}$/.test(v);
}
function formatDrainCell(v?: string | null) {
  if (!v) return "";
  if (isHHmm(v)) return `${v}:00`;
  const d = dayjs(v);
  return d.isValid() ? d.format("HH:mm:ss") : String(v);
}

/** ===== แสดงผล HH:mm สำหรับช่อง Start/Stop ===== */
function formatDrainCellHHmm(v?: string | null) {
  if (!v) return "";
  if (isHHmm(v)) return v; // case ที่ BE ส่งมาเป็น "08:15"
  const d = dayjs(v);
  return d.isValid() ? d.format("HH:mm") : String(v);
}

/** ===== Realtime counter component ===== */
function LiveTimer({ startISO }: { startISO: string }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = dayjs(startISO);
  const diff = Math.max(0, Math.floor((now - s.valueOf()) / 1000)); // seconds
  const dur = dayjs.duration(diff, "seconds");
  const mm = String(Math.floor(dur.asMinutes())).padStart(2, "0");
  const ss = String(dur.seconds()).padStart(2, "0");
  return (
    <Typography variant="body2" component="span">
      {mm}:{ss}
    </Typography>
  );
}

export default function CheckedInSummaryPage() {
  const { data: session, status } = useSession();

  const authToken = React.useMemo<string | undefined>(() => {
    return (session as any)?.accessToken || getStoredToken();
  }, [session]);

  const callApi = React.useCallback(
    async <T,>(url: string, init?: RequestInit) => {
      return fetchJSON<T>(url, init, authToken);
    },
    [authToken]
  );

  const [perms, setPerms] = React.useState<Perms>({});
  const [permsReady, setPermsReady] = React.useState(false);

  React.useEffect(() => {
    if (status === "authenticated") {
      setPerms(seedPermsFromSession(session));
      setPermsReady(true);
    } else if (status === "unauthenticated") {
      setPerms({ read: true });
      setPermsReady(true);
    }
  }, [session, status]);

  React.useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const me = await callApi<any>(ME_API);
        if (!cancelled) {
          const merged = mergePermsWithRole(readPermObject(me), readRole(me));
          setPerms(merged);
          setPermsReady(true);
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [status, callApi]);

  const [listDate, setListDate] = React.useState<Dayjs | null>(dayjs());
  const [timePreset, setTimePreset] = React.useState<
    "all" | "am" | "pm" | "custom"
  >("all");
  const [customStart, setCustomStart] = React.useState("00:00");
  const [customEnd, setCustomEnd] = React.useState("23:59");
  const [query, setQuery] = React.useState("");

  const [rows, setRows] = React.useState<BookingView[]>([]);
  const [rubberTypes, setRubberTypes] = React.useState<RubberTypeOpt[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [toast, setToast] = React.useState<{
    open: boolean;
    msg: string;
    sev: "success" | "error" | "info";
  }>({ open: false, msg: "", sev: "success" });

  // ==== Drain log state ====

  const listDateISO = React.useMemo(
    () => (listDate?.isValid() ? listDate : dayjs()).format("YYYY-MM-DD"),
    [listDate]
  );

  React.useEffect(() => {
    (async () => {
      try {
        const rts = await callApi<any[]>(RUBBER_TYPES_API);
        setRubberTypes(
          (rts || []).map((r: any) => ({
            id: String(r._id ?? r.id),
            name: r.name,
          }))
        );
      } catch {}
    })();
  }, [callApi]);

  const getWindow = React.useCallback(() => {
    if (timePreset === "all") return { s: "00:00", e: "23:59" };
    if (timePreset === "am") return { s: "08:00", e: "12:00" };
    if (timePreset === "pm") return { s: "12:00", e: "17:00" };
    return { s: customStart, e: customEnd };
  }, [timePreset, customStart, customEnd]);

  const loadData = React.useCallback(async () => {
    const { s, e } = getWindow();
    setLoading(true);
    try {
      const events = await callApi<any[]>(EVENTS_API(listDateISO));
      const normalized = (events || [])
        .map(normalizeFromEvent)
        .filter((r) => !!r.checkInTime)
        .filter(
          (r) =>
            (timePreset === "all" || (r.startTime >= s && r.startTime <= e)) &&
            (query.trim() === "" ||
              [r.bookingCode, r.truckRegister, r.supCode, r.supplierName]
                .join(" ")
                .toLowerCase()
                .includes(query.trim().toLowerCase()))
        )
        .sort((a, b) => {
          const qa = a.sequence || 0;
          const qb = b.sequence || 0;
          if (qa !== qb) return qa - qb;
          const ta = a.checkInTime ? dayjs(a.checkInTime).valueOf() : 0;
          const tb = b.checkInTime ? dayjs(b.checkInTime).valueOf() : 0;
          return ta - tb;
        });
      setRows(normalized);
    } catch (error: any) {
      setRows([]);
      setToast({
        open: true,
        msg:
          /Unauthorized/i.test(String(error?.message || "")) && !authToken
            ? "ยังไม่ได้แนบ token ไปยัง backend (โปรด login และเก็บ token เป็น backend_access_token)"
            : "ไม่สามารถโหลดรายการได้",
        sev: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [listDateISO, getWindow, timePreset, callApi, authToken, query]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const supplierText = (r: BookingView) => {
    const code = r.supCode?.trim();
    const name = r.supplierName?.trim();
    if (!code && !name) return "-";
    if (code && name) return `${code} : ${name}`;
    return code || name || "-";
  };

  const fmtTotal = (r: BookingView) => {
    const s = r.drainStartTime;
    const e = r.drainStopTime;
    if (!s || !e) return "-";

    let diffSec = 0;
    if (isHHmm(s) && isHHmm(e)) {
      const base = r.date || dayjs().format("YYYY-MM-DD");
      const ds = dayjs(`${base}T${s}:00`);
      const de = dayjs(`${base}T${e}:00`);
      if (!ds.isValid() || !de.isValid()) return "-";
      diffSec = de.diff(ds, "second");
    } else {
      const ds = dayjs(s);
      const de = dayjs(e);
      if (!ds.isValid() || !de.isValid()) return "-";
      diffSec = de.diff(ds, "second");
    }

    if (diffSec < 0) return "-";
    const d = dayjs.duration(diffSec, "seconds");
    const mm = String(Math.floor(d.asMinutes())).padStart(2, "0");
    const ss = String(d.seconds()).padStart(2, "0");
    return `${mm}:${ss}`;
  };
  function latestOpenStartISO(r: BookingView): string | undefined {
    // ถ้าเริ่มแล้วและยังไม่หยุด ให้ใช้เวลาจาก drainStartTime
    if (r.drainStartTime && !r.drainStopTime) {
      const base = r.date || dayjs().format("YYYY-MM-DD");
      return isHHmm(r.drainStartTime)
        ? `${base}T${r.drainStartTime}:00`
        : String(r.drainStartTime);
    }
    return undefined;
  }

  async function updateRow(id: string, body: Record<string, any>) {
    const hasDrain =
      Object.prototype.hasOwnProperty.call(body, "drain_start_time") ||
      Object.prototype.hasOwnProperty.call(body, "drain_stop_time");

    const hasWeights = [
      "weight_in",
      "weight_in_head",
      "weight_in_trailer",
      "rubber_type",
      "rubber_type_head",
      "rubber_type_trailer",
    ].some((k) => Object.prototype.hasOwnProperty.call(body, k));

    const isOnlyCheckIn =
      Object.keys(body).length === 1 &&
      Object.prototype.hasOwnProperty.call(body, "check_in_time");

    try {
      if (hasDrain) {
        return await callApi(UPDATE_DRAIN_API(id), {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      }
      if (hasWeights) {
        return await callApi(UPDATE_WEIGHTS_API(id), {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      }
      if (isOnlyCheckIn) {
        return await callApi(UPDATE_CHECKIN_TIME_API(id), {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      }
    } catch (e: any) {
      if (!/404/i.test(String(e?.message || e))) throw e;
    }
    return callApi(`${UPDATE_BOOKING_API}?id=${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  const [timeDlgOpen, setTimeDlgOpen] = React.useState(false);
  const [timeDlgTitle, setTimeDlgTitle] = React.useState("ตั้งเวลา");
  const [timeDlgRow, setTimeDlgRow] = React.useState<BookingView | null>(null);
  const [timeDlgField, setTimeDlgField] = React.useState<
    "drain_start_time" | "drain_stop_time"
  >("drain_start_time");

  const openTimeDialog = (
    r: BookingView,
    field: "drain_start_time" | "drain_stop_time",
    title: string
  ) => {
    setTimeDlgRow(r);
    setTimeDlgField(field);
    setTimeDlgTitle(title);
    setTimeDlgOpen(true);
  };

  const handleTimeConfirm = async (hhmm: string) => {
    if (!timeDlgRow) return;
    const id = timeDlgRow.id;
    const field = timeDlgField;

    const base = timeDlgRow.date || dayjs().format("YYYY-MM-DD");
    const iso = `${base}T${hhmm}:00`;

    setRows((prev) =>
      prev.map((x) =>
        x.id === id
          ? {
              ...x,
              [field === "drain_start_time"
                ? "drainStartTime"
                : "drainStopTime"]: hhmm,
            }
          : x
      )
    );

    try {
      await updateRow(id, { [field]: hhmm });
      setToast({
        open: true,
        msg:
          field === "drain_start_time"
            ? "ตั้งเวลา Start Drain แล้ว"
            : "ตั้งเวลา Stop Drain แล้ว",
        sev: "success",
      });
      await loadData();
    } catch (e: any) {
      setToast({ open: true, msg: `บันทึกไม่ได้: ${e.message}`, sev: "error" });
      await loadData();
    } finally {
      setTimeDlgOpen(false);
      setTimeDlgRow(null);
    }
  };

  const [weightDlgOpen, setWeightDlgOpen] = React.useState(false);
  const [weightDlgRow, setWeightDlgRow] = React.useState<BookingView | null>(
    null
  );

  const openWeightDialog = (r: BookingView) => {
    setWeightDlgRow(r);
    setWeightDlgOpen(true);
  };

  const handleWeightSave = async (payload: {
    weight_in?: number | null;
    weight_in_head?: number | null;
    weight_in_trailer?: number | null;
    rubber_type?: string | null;
    rubber_type_head?: string | null;
    rubber_type_trailer?: string | null;
  }) => {
    if (!weightDlgRow) return;
    const id = weightDlgRow.id;

    setRows((prev) =>
      prev.map((x) =>
        x.id === id
          ? {
              ...x,
              weightIn: payload.weight_in ?? x.weightIn ?? null,
              weightInHead: payload.weight_in_head ?? x.weightInHead ?? null,
              weightInTrailer:
                payload.weight_in_trailer ?? x.weightInTrailer ?? null,
              rubberTypeHeadId:
                payload.rubber_type_head ?? x.rubberTypeHeadId ?? null,
              rubberTypeTrailerId:
                payload.rubber_type_trailer ?? x.rubberTypeTrailerId ?? null,
            }
          : x
      )
    );

    try {
      await updateRow(id, payload);
      setToast({ open: true, msg: "บันทึก Weight In แล้ว", sev: "success" });
      await loadData();
    } catch (e: any) {
      setToast({ open: true, msg: `บันทึกไม่ได้: ${e.message}`, sev: "error" });
      await loadData();
    } finally {
      setWeightDlgOpen(false);
      setWeightDlgRow(null);
    }
  };

  const exportCSV = () => {
    const header = [
      "Booking Code",
      "Queue",
      "Date",
      "TimeSlot",
      "Supplier Code",
      "Supplier Name",
      "License Plate",
      "Truck Type",
      "Rubber",
      "Checked-In Time",
      "Start Drain",
      "Stop Drain",
      "Total Drain (mm:ss)",
      "Weight In (kg)",
      "Recorder",
    ];
    const lines = rows.map((r) => {
      const trailer = isTrailer(r.truckType);
      const weightCol = trailer
        ? `${r.weightInHead ?? ""}/${r.weightInTrailer ?? ""}`
        : `${r.weightIn ?? ""}`;
      return [
        r.bookingCode,
        r.sequence ?? "",
        dayjs(r.date).format("YYYY-MM-DD"),
        r.endTime ? `${r.startTime}-${r.endTime}` : r.startTime,
        r.supCode,
        r.supplierName,
        r.truckRegister,
        r.truckType || "",
        r.rubberTypeName || "",
        r.checkInTime ? dayjs(r.checkInTime).format("YYYY-MM-DD HH:mm:ss") : "",
        formatDrainCell(r.drainStartTime),
        formatDrainCell(r.drainStopTime),
        fmtTotal(r),
        weightCol,
        r.recorder || "",
      ];
    });
    const csv =
      [header, ...lines]
        .map((row) =>
          row
            .map((cell) => {
              const str = String(cell ?? "");
              if (str.includes(",") || str.includes('"') || str.includes("\n"))
                return `"${str.replace(/"/g, '""')}"`;
              return str;
            })
            .join(",")
        )
        .join("\n") + "\n";

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `checked-in_${listDateISO}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // =============== เปลี่ยนโครงหน้าเป็น FusePageSimple ===============
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <FusePageSimple
        header={
          <Box className="p-6">
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "flex-start", sm: "center" }}
              justifyContent="space-between"
              spacing={2}
            >
              <Box>
                <Typography variant="h5" fontWeight={800}>
                  Weight in
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {rows.length.toLocaleString()} Items
                </Typography>
              </Box>

              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  onClick={exportCSV}
                  startIcon={<DownloadIcon />}
                  sx={{ borderRadius: RADIUS, px: 2 }}
                  disabled={rows.length === 0}
                >
                  Export CSV
                </Button>
              </Stack>
            </Stack>
          </Box>
        }
        content={
          <Box className="p-6">
            {/* Filter */}
            <Paper
              component={motion.div}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              variant="outlined"
              sx={{ p: 2, borderRadius: RADIUS, mb: 2.5 }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.25}
                alignItems={{ xs: "stretch", md: "flex-end" }}
              >
                <FormControl sx={{ width: { xs: "100%", md: 220 } }}>
                  <FormLabel>Date</FormLabel>
                  <DatePicker
                    value={listDate}
                    onChange={(v: Dayjs | null) => setListDate(v)}
                    format="DD-MMM-YYYY"
                    slotProps={{
                      textField: {
                        size: "small",
                        sx: {
                          "& .MuiOutlinedInput-root": { borderRadius: 1 },
                        },
                      },
                      popper: { disablePortal: true },
                    }}
                  />
                </FormControl>

                <FormControl sx={{ width: { xs: "100%", md: 240 } }}>
                  <FormLabel>Time Range</FormLabel>
                  <TextField
                    {...FIELD_PROPS}
                    sx={fieldSx}
                    select
                    value={timePreset}
                    onChange={(e) => setTimePreset(e.target.value as any)}
                  >
                    <MenuItem value="all">ทั้งวัน (00:00–23:59)</MenuItem>
                    <MenuItem value="am">ช่วงเช้า (08:00–12:00)</MenuItem>
                    <MenuItem value="pm">ช่วงบ่าย (12:00–17:00)</MenuItem>
                    <MenuItem value="custom">กำหนดเอง</MenuItem>
                  </TextField>
                </FormControl>

                {timePreset === "custom" && (
                  <>
                    <FormControl sx={{ width: { xs: "100%", md: 140 } }}>
                      <FormLabel>เริ่ม</FormLabel>
                      <TextField
                        {...FIELD_PROPS}
                        sx={fieldSx}
                        type="time"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                      />
                    </FormControl>
                    <FormControl sx={{ width: { xs: "100%", md: 140 } }}>
                      <FormLabel>สิ้นสุด</FormLabel>
                      <TextField
                        {...FIELD_PROPS}
                        sx={fieldSx}
                        type="time"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                      />
                    </FormControl>
                  </>
                )}

                <FormControl sx={{ flex: 1, minWidth: 220 }}>
                  <FormLabel>Search</FormLabel>
                  <TextField
                    {...FIELD_PROPS}
                    sx={fieldSx}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="ค้นหา: Booking/ทะเบียน/Supplier"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                    onKeyDown={(e) => e.key === "Enter" && loadData()}
                  />
                </FormControl>

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={() => {
                      setQuery("");
                      setTimePreset("all");
                      setCustomStart("00:00");
                      setCustomEnd("23:59");
                      loadData();
                    }}
                    startIcon={<ReplayIcon />}
                    sx={{ borderRadius: RADIUS, height: 33 }}
                  >
                    ล้างตัวกรอง
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            {/* Table */}
            <Paper
              component={motion.div}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.05 }}
              variant="outlined"
              sx={{ p: 2, borderRadius: RADIUS }}
            >
              <TableContainer
                sx={{
                  borderRadius: RADIUS,
                  border: (t) => `1px solid ${t.palette.divider}`,
                }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Booking</TableCell>
                      <TableCell align="center">Queue</TableCell>
                      <TableCell>Time</TableCell>
                      <TableCell>Supplier</TableCell>
                      <TableCell>License Plate</TableCell>
                      <TableCell>Truck Type</TableCell>
                      <TableCell align="center" width={100}>
                        Rubber Type
                      </TableCell>
                      <TableCell align="center" width={80}>
                        Check In
                      </TableCell>
                      <TableCell align="center" width={80}>
                        Start Drain
                      </TableCell>
                      <TableCell align="center" width={80}>
                        Stop Drain
                      </TableCell>
                      <TableCell align="center" width={80}>
                        Total Drain
                      </TableCell>
                      <TableCell align="right" width={160}>
                        Weight In (kg)
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={`sk-${i}`}>
                          <TableCell colSpan={12}>
                            <Skeleton height={24} />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12}>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            align="center"
                          >
                            ไม่พบรายการเช็คอินแล้วตามเงื่อนไข
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r) => {
                        const trailer = isTrailer(r.truckType);
                        const openStartISO = latestOpenStartISO(r);

                        return (
                          <TableRow key={r.id || r.bookingCode} hover>
                            <TableCell>{r.bookingCode}</TableCell>
                            <TableCell align="center">
                              {r.sequence ?? "-"}
                            </TableCell>
                            <TableCell>
                              {r.startTime}
                              {r.endTime ? ` - ${r.endTime}` : ""}
                            </TableCell>
                            <TableCell sx={{ maxWidth: 320 }}>
                              <Typography
                                variant="body2"
                                noWrap
                                title={`${supplierText(r)}`}
                              >
                                {supplierText(r)}
                              </Typography>
                            </TableCell>
                            <TableCell>{r.truckRegister || "-"}</TableCell>
                            <TableCell>{r.truckType || "-"}</TableCell>
                            <TableCell align="center" width={100}>
                              {r.rubberTypeName ? (
                                <Chip
                                  size="small"
                                  label={r.rubberTypeName}
                                  sx={rubberChipSx(r.rubberTypeName)}
                                />
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell align="center" width={80}>
                              {r.checkInTime
                                ? dayjs(r.checkInTime).format("HH:mm")
                                : "-"}
                            </TableCell>

                            <TableCell align="center">
                              {r.drainStartTime ? (
                                formatDrainCellHHmm(r.drainStartTime)
                              ) : (
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() =>
                                    openTimeDialog(
                                      r,
                                      "drain_start_time",
                                      "ยืนยันเวลา Start Drain"
                                    )
                                  }
                                  title="Start Drain"
                                  disabled={!permsReady || !perms.update}
                                >
                                  <PlayArrowIcon fontSize="small" />
                                </IconButton>
                              )}
                            </TableCell>

                            <TableCell align="center">
                              {r.drainStopTime ? (
                                formatDrainCellHHmm(r.drainStopTime)
                              ) : (
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() =>
                                    openTimeDialog(
                                      r,
                                      "drain_stop_time",
                                      "ยืนยันเวลา Stop Drain"
                                    )
                                  }
                                  title="Stop Drain"
                                  disabled={!r.drainStartTime || !perms.update}
                                >
                                  <StopIcon fontSize="small" />
                                </IconButton>
                              )}
                            </TableCell>

                            <TableCell align="center">
                              <Stack
                                direction="row"
                                spacing={0.5}
                                alignItems="center"
                                justifyContent="center"
                              >
                                {openStartISO && !r.drainStopTime ? (
                                  <LiveTimer startISO={openStartISO} />
                                ) : (
                                  <Typography variant="body2">
                                    {fmtTotal(r)}
                                  </Typography>
                                )}
                              </Stack>
                            </TableCell>

                            <TableCell align="right">
                              <Stack
                                direction="row"
                                spacing={0.75}
                                alignItems="center"
                                justifyContent="flex-end"
                              >
                                <Typography variant="body2">
                                  {trailer
                                    ? `${r.weightInHead != null ? r.weightInHead.toLocaleString() : "-"} / ${
                                        r.weightInTrailer != null
                                          ? r.weightInTrailer.toLocaleString()
                                          : "-"
                                      }`
                                    : r.weightIn != null
                                      ? r.weightIn.toLocaleString()
                                      : "-"}
                                </Typography>
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => openWeightDialog(r)}
                                  title="บันทึก Weight In"
                                  disabled={!permsReady || !perms.update}
                                >
                                  <SaveIcon fontSize="small" />
                                </IconButton>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Divider sx={{ my: 2 }} />
              <Alert severity="info" sx={{ borderRadius: RADIUS }}>
                รวมทั้งหมด {rows.length.toLocaleString()} รายการ
              </Alert>
            </Paper>

            {/* Dialogs */}
            <TimeConfirmDialog
              open={timeDlgOpen}
              title={timeDlgTitle}
              defaultISO={new Date().toISOString()}
              onClose={() => setTimeDlgOpen(false)}
              onConfirm={handleTimeConfirm}
              disabled={!permsReady || !perms.update}
            />

            <WeightDialog
              open={weightDlgOpen}
              onClose={() => setWeightDlgOpen(false)}
              onSave={handleWeightSave}
              trailer={isTrailer(weightDlgRow?.truckType)}
              rubberTypes={rubberTypes}
              initial={{
                // น้ำหนักรวมใช้ได้ทั้งสองกรณี (รถพ่วง BE อาจไม่ใช้ค่านี้)
                weight_in: weightDlgRow?.weightIn ?? null,
                // ถ้าเป็นรถพ่วง ใส่เฉพาะคีย์ของพ่วง
                ...(isTrailer(weightDlgRow?.truckType)
                  ? {
                      weight_in_head: weightDlgRow?.weightInHead ?? null,
                      weight_in_trailer: weightDlgRow?.weightInTrailer ?? null,
                      rubber_type_head: weightDlgRow?.rubberTypeHeadId || "",
                      rubber_type_trailer:
                        weightDlgRow?.rubberTypeTrailerId || "",
                    }
                  : {
                      // รถเดี่ยว ใช้ rubber_type เดียว
                      // พยายามดึงจาก rubberTypeId (ถ้ามี) รองลงมาจาก rubberTypeHeadId (บาง BE reuse field เดียวกัน)
                      rubber_type:
                        (weightDlgRow?.rubberTypeId as string | undefined) ??
                        weightDlgRow?.rubberTypeHeadId ??
                        "",
                    }),
              }}
            />
            <Snackbar
              open={toast.open}
              autoHideDuration={2800}
              onClose={() => setToast((t) => ({ ...t, open: false }))}
              anchorOrigin={{ vertical: "top", horizontal: "right" }}
              sx={{ mt: 8, mr: 2, zIndex: (theme) => theme.zIndex.modal + 1 }}
            >
              <Alert
                severity={toast.sev}
                variant="filled"
                onClose={() => setToast((t) => ({ ...t, open: false }))}
                sx={{ color: "#fff", "& .MuiAlert-icon": { color: "#fff" } }}
              >
                {toast.msg}
              </Alert>
            </Snackbar>
          </Box>
        }
      />
    </LocalizationProvider>
  );
}
