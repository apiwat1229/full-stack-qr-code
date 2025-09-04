// src/app/check-in/page.tsx
"use client";
import FusePageSimple from "@fuse/core/FusePageSimple";
import CheckIcon from "@mui/icons-material/CheckCircleOutline";
import EditIcon from "@mui/icons-material/Edit";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import ReplayIcon from "@mui/icons-material/Replay";
import SearchIcon from "@mui/icons-material/Search";
import dayjs, { Dayjs } from "dayjs";
import * as React from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormHelperText,
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
import { useSession } from "next-auth/react";

import FuseLoading from "@fuse/core/FuseLoading";
import { motion } from "framer-motion";

/* ================= CONFIG ================= */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "") || "";
const api = (path: string) =>
  `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

const LOOKUP_BOOKING_API = (code: string) =>
  api(`/api/bookings/lookup?booking_code=${encodeURIComponent(code)}`);
const CHECK_IN_API = api(`/api/bookings/check-in`);
const UPDATE_BOOKING_API = api(`/api/bookings`);
const EVENTS_API = (dateISO: string) =>
  api(`/api/bookings/events?date=${encodeURIComponent(dateISO)}`);
const ME_API = api(`/api/admin/users/me`);

/* ================= UI const ================= */
const RADIUS = 1;
const FIELD_PROPS = { size: "medium", variant: "outlined" } as const;
const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: RADIUS } };
const INPUT_HEIGHT = 56;

/* ================= Types ================= */
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
  recorder?: string;
  checkInTime?: string | null;
};

type Perms = {
  create?: boolean;
  read?: boolean;
  update?: boolean;
  delete?: boolean;
  approve?: boolean;
};

/* ================= Auth helpers ================= */
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

/** ===== Util: เอาค่าตัวแรกที่มีจริง ===== */
function firstDefined<T>(
  ...cands: Array<T | null | undefined | "">
): T | undefined {
  for (const c of cands) {
    if (c !== undefined && c !== null && c !== "") return c as T;
  }
  return undefined;
}

/** สร้าง ISO string พร้อม timezone offset ของเครื่องผู้ใช้ (เช่น +07:00) */
function buildLocalISO(dateStr: string, hhmm: string) {
  const [H, M] = (hhmm || "00:00").split(":").map((x) => parseInt(x, 10) || 0);
  const d = dayjs(dateStr).hour(H).minute(M).second(0).millisecond(0);

  const tzMin = -new Date().getTimezoneOffset(); // BKK => +420
  const sign = tzMin >= 0 ? "+" : "-";
  const abs = Math.abs(tzMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");

  return `${d.format("YYYY-MM-DDTHH:mm:ss")}${sign}${hh}:${mm}`;
}

/* ================= Helpers ================= */
async function fetchJSON<T>(
  url: string,
  init?: RequestInit,
  token?: string
): Promise<T> {
  const headers = new Headers(init?.headers || {});
  const bearer = token || getStoredToken();
  if (bearer && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${bearer}`);
  }
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

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
      if (/unauthorized|401/i.test(message)) {
        message = "Unauthorized (no credentials to call backend via proxy)";
      }
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

/** รวมชื่อ Supplier จากหลาย key */
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

/** แปลง event/raw → BookingView (รองรับหลาย key) */
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

  return {
    id: String(raw?.id ?? raw?._id ?? xp.booking_code ?? ""),
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
    rubberTypeName:
      firstDefined(
        xp?.rubber_type_name,
        xp?.rubber_type,
        raw?.rubberTypeName,
        raw?.rubber_type_name
      ) || "",
    recorder,
    checkInTime:
      firstDefined(xp?.check_in_time, raw?.checkInTime, raw?.check_in_time) ??
      null,
  };
}

/** อ่าน role / perms จาก session/me */
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
  if (r === "admin") {
    return {
      create: true,
      read: true,
      update: true,
      delete: true,
      approve: true,
    };
  }
  if (r === "staff") {
    return {
      create: base.create ?? true,
      read: base.read ?? true,
      update: true,
      delete: base.delete ?? false,
      approve: base.approve ?? false,
    };
  }
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

/* ================= Tiny UI ================= */
function Row({
  left,
  right,
  dense,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  dense?: boolean;
}) {
  return (
    <Stack
      direction="row"
      alignItems={dense ? "center" : "flex-start"}
      sx={{ py: dense ? 0.5 : 1 }}
    >
      <Box sx={{ minWidth: 120 }}>
        <Typography variant="body2" color="text.secondary">
          {left}
        </Typography>
      </Box>
      <Box sx={{ flexGrow: 1 }} />
      <Box sx={{ maxWidth: "60%", textAlign: "right" }}>
        <Typography variant="body2" fontWeight={600}>
          {right}
        </Typography>
      </Box>
    </Stack>
  );
}

/* ===== Dialog: ยืนยัน Check-In ===== */
function ConfirmCheckInDialog({
  open,
  onClose,
  onConfirm,
  defaultPlate,
  defaultTimeISO,
  defaultDate,
  disabled,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (args: { plate: string; checkInISO?: string }) => void;
  defaultPlate: string;
  defaultTimeISO?: string | null;
  defaultDate: string; // YYYY-MM-DD
  disabled?: boolean;
}) {
  const [plate, setPlate] = React.useState(defaultPlate || "");
  const [hhmm, setHhmm] = React.useState(
    dayjs(defaultTimeISO || new Date()).format("HH:mm")
  );

  React.useEffect(() => {
    if (open) {
      setPlate(defaultPlate || "");
      setHhmm(dayjs(defaultTimeISO || new Date()).format("HH:mm"));
    }
  }, [open, defaultPlate, defaultTimeISO]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>ยืนยัน Check-In</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <FormControl>
            <FormLabel>ทะเบียนรถ</FormLabel>
            <TextField
              size="small"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              disabled={disabled}
            />
          </FormControl>
          <FormControl>
            <FormLabel>เวลาเช็คอิน</FormLabel>
            <TextField
              size="small"
              type="time"
              value={hhmm}
              onChange={(e) => setHhmm(e.target.value)}
              inputProps={{ step: 60 }}
              disabled={disabled}
            />
            <FormHelperText>
              สามารถแก้ไขเวลาได้ (ค่าเริ่มต้น: ตอนนี้)
            </FormHelperText>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>ยกเลิก</Button>
        <Button
          variant="contained"
          onClick={() => {
            const iso = buildLocalISO(defaultDate, hhmm);
            onConfirm({ plate, checkInISO: iso });
          }}
          disabled={disabled}
        >
          ยืนยัน
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ===== Dialog: แก้ไขทะเบียน + เวลาเช็คอิน ===== */
function EditBookingDialog({
  open,
  onClose,
  onSave,
  row,
  disabled,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (payload: { plate: string; checkInISO?: string | null }) => void;
  row: BookingView | null;
  disabled?: boolean;
}) {
  const [plate, setPlate] = React.useState("");
  const [hhmm, setHhmm] = React.useState("");

  React.useEffect(() => {
    if (open && row) {
      setPlate(row.truckRegister || "");
      setHhmm(row.checkInTime ? dayjs(row.checkInTime).format("HH:mm") : "");
    }
  }, [open, row]);

  const handleSave = () => {
    const originalTime = row?.checkInTime
      ? dayjs(row.checkInTime).format("HH:mm")
      : "";
    const isTimeChanged = hhmm !== originalTime;

    let checkInISO: string | null | undefined = undefined;
    if (isTimeChanged) {
      if (hhmm) {
        const dateStr = row?.date || dayjs().format("YYYY-MM-DD");
        checkInISO = buildLocalISO(dateStr, hhmm);
      } else {
        checkInISO = null; // ลบเวลา
      }
    }

    onSave({ plate, checkInISO });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>แก้ไขข้อมูลคิว</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="Booking Code"
            size="small"
            value={row?.bookingCode || ""}
            InputProps={{ readOnly: true }}
          />
          <TextField
            label="ทะเบียนรถ"
            size="small"
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            disabled={disabled}
          />
          <FormControl>
            <FormLabel>เวลาเช็คอิน (แก้ไขได้)</FormLabel>
            <TextField
              size="small"
              type="time"
              value={hhmm}
              onChange={(e) => setHhmm(e.target.value)}
              inputProps={{ step: 60 }}
              disabled={disabled}
            />
            <FormHelperText>
              {row?.checkInTime
                ? `เวลาเดิม: ${dayjs(row.checkInTime).format("HH:mm:ss")}`
                : "ยังไม่เคยเช็คอิน"}{" "}
              · เว้นว่างเพื่อไม่แก้เวลา / ลบเวลาเพื่อยกเลิกสถานะ
            </FormHelperText>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>ยกเลิก</Button>
        <Button variant="contained" onClick={handleSave} disabled={disabled}>
          บันทึก
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* =============== Page =============== */
export default function CheckInPage() {
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
      } catch (e) {
        console.error("Failed to fetch user permissions:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, callApi]);

  /* check-in pane state */
  const [bookCode, setBookCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [globalLoading, setGlobalLoading] = React.useState(false);
  const [result, setResult] = React.useState<BookingView | null>(null);
  const [licensePlate, setLicensePlate] = React.useState("");
  const [toast, setToast] = React.useState<{
    open: boolean;
    msg: string;
    sev: "success" | "error" | "info";
  }>({ open: false, msg: "", sev: "success" });

  /* dialogs */
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editingRow, setEditingRow] = React.useState<BookingView | null>(null);

  /* list state */
  const [listDate, setListDate] = React.useState<Dayjs | null>(dayjs());
  const [timePreset, setTimePreset] = React.useState<
    "all" | "am" | "pm" | "custom"
  >("all");
  const [customStart, setCustomStart] = React.useState("08:00");
  const [customEnd, setCustomEnd] = React.useState("17:00");
  const [listLoading, setListLoading] = React.useState(false);
  const [rows, setRows] = React.useState<BookingView[]>([]);

  const canCheckIn =
    permsReady && !!result && !result.checkInTime && !loading && !!perms.update;
  const isLocked = !!result?.checkInTime || loading;

  const listDateISO = React.useMemo(
    () => (listDate?.isValid() ? listDate : dayjs()).format("YYYY-MM-DD"),
    [listDate]
  );

  const getWindow = React.useCallback(() => {
    if (timePreset === "all") return { s: "00:00", e: "23:59" };
    if (timePreset === "am") return { s: "08:00", e: "12:00" };
    if (timePreset === "pm") return { s: "12:00", e: "17:00" };
    return { s: customStart, e: customEnd };
  }, [timePreset, customStart, customEnd]);

  const loadList = React.useCallback(async () => {
    const { s, e } = getWindow();
    setListLoading(true);
    try {
      const events = await callApi<any[]>(EVENTS_API(listDateISO));
      const normalized = (events || [])
        .map(normalizeFromEvent)
        .filter(
          (r) => timePreset === "all" || (r.startTime >= s && r.startTime <= e)
        )
        .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
      setRows(normalized);
    } catch (error: any) {
      console.error("Failed to load list:", error);
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
      setListLoading(false);
    }
  }, [listDateISO, getWindow, timePreset, callApi, authToken]);

  React.useEffect(() => {
    loadList();
  }, [loadList]);

  /* ===== Search / Check-in ===== */
  const handleSearch = async () => {
    const code = bookCode.trim();
    if (!code) {
      setToast({ open: true, msg: "กรุณากรอก Booking Code", sev: "error" });
      return;
    }
    setLoading(true);
    try {
      const data = await callApi<any>(LOOKUP_BOOKING_API(code));
      const view = normalizeFromEvent({
        ...data,
        id: data.id ?? data._id ?? data.booking_code ?? code,
        start:
          data.start ??
          `${data.date ?? listDateISO}T${data.startTime ?? data.start_time ?? "08:00"}:00`,
        end:
          data.end ??
          (data.endTime || data.end_time
            ? `${data.date ?? listDateISO}T${data.endTime ?? data.end_time}:00`
            : undefined),
        extendedProps: {
          ...data,
          booking_code: data.bookingCode ?? data.booking_code ?? code,
          check_in_time: data.checkInTime ?? data.check_in_time,
        },
      });
      setResult(view);
      setLicensePlate(view.truckRegister || "");
    } catch (e: any) {
      setResult(null);
      const msg = String(e?.message || "");
      setToast({
        open: true,
        msg: /not_found|404|ไม่พบ/i.test(msg)
          ? "ไม่พบ Booking Code นี้"
          : /Unauthorized/i.test(msg) && !authToken
            ? "ยังไม่ได้แนบ token ไปยัง backend (โปรด login และเก็บ token เป็น backend_access_token)"
            : "ค้นหาไม่สำเร็จ",
        sev: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCheckIn = async ({
    plate,
    checkInISO,
  }: {
    plate: string;
    checkInISO?: string;
  }) => {
    if (!result) return;
    setGlobalLoading(true);
    try {
      await callApi(CHECK_IN_API, {
        method: "POST",
        body: JSON.stringify({
          booking_code: result.bookingCode,
          newTruckRegister: plate,
          check_in_time: checkInISO,
        }),
      });
      setResult((r) =>
        r
          ? {
              ...r,
              truckRegister: plate,
              checkInTime: checkInISO || new Date().toISOString(),
            }
          : null
      );
      setLicensePlate(plate);
      setToast({ open: true, msg: "เช็คอินสำเร็จ", sev: "success" });
      loadList();
    } catch (e: any) {
      setToast({
        open: true,
        msg: `เช็คอินไม่สำเร็จ: ${e.message}`,
        sev: "error",
      });
    } finally {
      setConfirmOpen(false);
      setGlobalLoading(false);
    }
  };

  /* ===== UI Helpers ===== */
  const supplierDisplay = React.useMemo(() => {
    const code = result?.supCode?.trim();
    const name = result?.supplierName?.trim();
    if (!code && !name) return "-";
    if (code && name) return `${code} : ${name}`;
    return code || name || "-";
  }, [result?.supCode, result?.supplierName]);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <FusePageSimple
        header={
          <Box className="p-6" sx={{ position: "relative" }}>
            {/* Global loading overlay (คงไว้เหมือนเดิม) */}
            {globalLoading && (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  bgcolor: "rgba(255,255,255,0.6)",
                  zIndex: (t) => t.zIndex.modal + 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backdropFilter: "blur(1px)",
                }}
              >
                <FuseLoading />
              </Box>
            )}

            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "flex-start", sm: "center" }}
              justifyContent="space-between"
              spacing={2}
            >
              <Box>
                <Typography variant="h5" fontWeight={800}>
                  Check-In
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {rows.length.toLocaleString()} Items
                </Typography>
              </Box>

              {/* ปุ่มเผื่ออนาคต (ถ้าอยากมี action ที่ header) */}
              {/* <Stack direction="row" spacing={1}>
              <Button variant="outlined" sx={{ borderRadius: RADIUS }}>
                Action
              </Button>
            </Stack> */}
            </Stack>
          </Box>
        }
        content={
          <Box className="p-6">
            {/* ===== Search row (เหมือนเดิม) ===== */}
            <Paper
              component={motion.div}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              variant="outlined"
              sx={{ p: 2, borderRadius: RADIUS, mb: 2.5 }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.25}
                alignItems={{ xs: "stretch", sm: "center" }}
              >
                <FormControl sx={{ flex: 1 }}>
                  <FormLabel>Booking Code</FormLabel>
                  <TextField
                    {...FIELD_PROPS}
                    sx={fieldSx}
                    value={bookCode}
                    onChange={(e) => setBookCode(e.target.value)}
                    placeholder="เช่น 2409010800-01"
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            edge="end"
                            size="small"
                            aria-label="scan-qr"
                            disabled
                            title="เร็วๆ นี้: สแกน QR"
                          >
                            <QrCodeScannerIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </FormControl>

                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="flex-end"
                  sx={{ height: 56 }}
                >
                  <Button
                    variant="contained"
                    onClick={handleSearch}
                    disabled={loading}
                    sx={{
                      borderRadius: RADIUS,
                      px: 2,
                      textTransform: "none",
                      minWidth: 80,
                      height: 33,
                    }}
                  >
                    {loading ? "กำลังค้นหา..." : "ค้นหา"}
                  </Button>
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={() => {
                      setBookCode("");
                      setResult(null);
                      setLicensePlate("");
                    }}
                    startIcon={<ReplayIcon />}
                    disabled={loading}
                    sx={{
                      borderRadius: RADIUS,
                      textTransform: "none",
                      minWidth: 80,
                      height: 33,
                    }}
                  >
                    ล้าง
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            {/* ===== Content row: summary + form (เหมือนเดิม) ===== */}
            <Stack direction={{ xs: "column", md: "row" }} spacing={2.5}>
              {/* Left: summary */}
              <Card
                component={motion.div}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.05 }}
                variant="outlined"
                sx={{ borderRadius: RADIUS, flex: 1 }}
              >
                <CardHeader
                  sx={{ pb: 0.5 }}
                  title={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="h6" fontWeight={800}>
                        {`Booking Code : ${result?.bookingCode || bookCode || "-"}`}
                      </Typography>
                      <Box sx={{ flexGrow: 1 }} />
                      {result?.rubberTypeName ? (
                        <Chip
                          label={result.rubberTypeName}
                          size="small"
                          sx={rubberChipSx(result.rubberTypeName)}
                        />
                      ) : null}
                    </Stack>
                  }
                />
                <CardContent>
                  {!result ? (
                    <Stack spacing={1.5} sx={{ p: 2 }}>
                      {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} height={18} />
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          กรุณากรอกรหัส Booking แล้วกด “ค้นหา”
                        </Typography>
                      )}
                    </Stack>
                  ) : (
                    <Paper
                      variant="outlined"
                      sx={{ borderRadius: RADIUS, p: 2 }}
                    >
                      <Row left="Queue" right={result.sequence ?? "-"} dense />
                      <Divider sx={{ my: 1 }} />
                      <Stack direction="row" sx={{ py: 1 }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            Date
                          </Typography>
                          <Typography variant="body2" fontWeight={700}>
                            {dayjs(result.date).format("DD-MMM-YYYY")}
                          </Typography>
                        </Box>
                        <Box sx={{ flex: 1, textAlign: "right" }}>
                          <Typography variant="body2" color="text.secondary">
                            Time
                          </Typography>
                          <Typography variant="body2" fontWeight={700}>
                            {result.startTime}
                            {result.endTime ? ` - ${result.endTime}` : ""}
                          </Typography>
                        </Box>
                      </Stack>
                      <Divider sx={{ my: 1 }} />
                      <Row
                        left="Supplier"
                        right={(() => {
                          const code = result?.supCode?.trim();
                          const name = result?.supplierName?.trim();
                          if (!code && !name) return "-";
                          if (code && name) return `${code} : ${name}`;
                          return code || name || "-";
                        })()}
                      />
                      <Divider sx={{ my: 1 }} />
                      <Row
                        left="Recorder"
                        right={result?.recorder || "-"}
                        dense
                      />
                    </Paper>
                  )}
                </CardContent>
              </Card>

              {/* Right: form */}
              <Card
                component={motion.div}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.1 }}
                variant="outlined"
                sx={{ borderRadius: RADIUS, width: { md: 420 }, flexShrink: 0 }}
              >
                <CardContent>
                  <Stack spacing={2}>
                    <FormControl>
                      <FormLabel>License Plate *</FormLabel>
                      <TextField
                        {...FIELD_PROPS}
                        sx={fieldSx}
                        value={licensePlate}
                        onChange={(e) => setLicensePlate(e.target.value)}
                        disabled={isLocked || !result}
                        placeholder="เช่น กก-1234"
                      />
                      <FormHelperText>
                        {result?.checkInTime
                          ? "เช็คอินแล้ว ไม่สามารถแก้ไขทะเบียนได้"
                          : "แก้ไขได้ก่อนเช็คอิน"}
                      </FormHelperText>
                    </FormControl>

                    <FormControl>
                      <FormLabel>Truck Type</FormLabel>
                      <TextField
                        {...FIELD_PROPS}
                        sx={fieldSx}
                        value={result?.truckType || ""}
                        InputProps={{ readOnly: true }}
                      />
                    </FormControl>

                    <Box>
                      <Button
                        variant="contained"
                        onClick={() => setConfirmOpen(true)}
                        disabled={!canCheckIn}
                        startIcon={<CheckIcon />}
                        sx={{ borderRadius: RADIUS, textTransform: "none" }}
                      >
                        ยืนยัน Check-In
                      </Button>
                      {permsReady && !perms.update && (
                        <FormHelperText sx={{ color: "error.main" }}>
                          คุณไม่มีสิทธิ์ Check-In
                        </FormHelperText>
                      )}
                    </Box>

                    {result?.checkInTime && (
                      <Alert
                        severity="success"
                        sx={{ borderRadius: RADIUS, textAlign: "center" }}
                      >
                        เช็คอินแล้วเวลา{" "}
                        {dayjs(result.checkInTime).format("HH:mm")}
                      </Alert>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>

            {/* ===== Booking list (เหมือนเดิม) ===== */}
            <Paper
              component={motion.div}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.15 }}
              variant="outlined"
              sx={{ mt: 3, p: 2, borderRadius: RADIUS }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.25}
                alignItems={{ xs: "stretch", md: "flex-end" }}
              >
                <FormControl sx={{ width: { xs: "100%", md: 240 } }}>
                  <FormLabel>Date</FormLabel>
                  <DatePicker
                    value={listDate}
                    onChange={(v: Dayjs | null) => setListDate(v)}
                    format="DD-MMM-YYYY"
                    slotProps={{
                      textField: {
                        size: "small",
                        sx: { "& .MuiOutlinedInput-root": { borderRadius: 1 } },
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

                <Box sx={{ flexGrow: 1 }} />
              </Stack>

              <TableContainer
                sx={{
                  mt: 2,
                  borderRadius: RADIUS,
                  border: (t) => `1px solid ${t.palette.divider}`,
                }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Code</TableCell>
                      <TableCell align="center">Queue</TableCell>
                      <TableCell>Time</TableCell>
                      <TableCell>Supplier</TableCell>
                      <TableCell>License Plate</TableCell>
                      <TableCell>Truck Type</TableCell>
                      <TableCell align="center">Status</TableCell>
                      <TableCell align="center" width={80}>
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {listLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={`sk-${i}`}>
                          <TableCell colSpan={8}>
                            <Skeleton height={24} />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            align="center"
                          >
                            ไม่พบรายการตามเงื่อนไข
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r) => {
                        const supplierText = (() => {
                          const code = r.supCode?.trim();
                          const name = r.supplierName?.trim();
                          if (!code && !name) return "-";
                          if (code && name) return `${code} : ${name}`;
                          return code || name || "-";
                        })();
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
                                title={supplierText}
                              >
                                {supplierText}
                              </Typography>
                            </TableCell>
                            <TableCell>{r.truckRegister || "-"}</TableCell>
                            <TableCell>{r.truckType || ""}</TableCell>
                            <TableCell align="center">
                              {r.checkInTime ? (
                                <Chip
                                  size="small"
                                  label={`เช็คอิน ${dayjs(r.checkInTime).format("HH:mm")}`}
                                  color="success"
                                />
                              ) : (
                                <Chip
                                  size="small"
                                  label="ยังไม่เช็คอิน"
                                  color="warning"
                                />
                              )}
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                color="primary"
                                disabled={!perms.update}
                                onClick={() => {
                                  setEditingRow(r);
                                  setEditOpen(true);
                                }}
                                title={
                                  perms.update
                                    ? "แก้ไขทะเบียน/เวลาเช็คอิน"
                                    : "ไม่มีสิทธิ์แก้ไข (ต้องมีสิทธิ์ Update)"
                                }
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {/* ===== Dialogs & Snackbar (เหมือนเดิม) ===== */}
            <ConfirmCheckInDialog
              open={confirmOpen}
              onClose={() => setConfirmOpen(false)}
              onConfirm={handleConfirmCheckIn}
              defaultPlate={licensePlate}
              defaultTimeISO={new Date().toISOString()}
              defaultDate={result?.date || dayjs().format("YYYY-MM-DD")}
              disabled={!perms.update}
            />

            <EditBookingDialog
              open={editOpen}
              onClose={() => setEditOpen(false)}
              row={editingRow}
              disabled={!perms.update}
              onSave={async (payload) => {
                if (!editingRow) return;
                setGlobalLoading(true);
                try {
                  const url = `${UPDATE_BOOKING_API}?id=${encodeURIComponent(editingRow.id)}`;
                  const body: any = { truck_register: payload.plate };
                  if (payload.checkInISO !== undefined)
                    body.check_in_time = payload.checkInISO;
                  await callApi(url, {
                    method: "PUT",
                    body: JSON.stringify(body),
                  });

                  setToast({ open: true, msg: "บันทึกสำเร็จ", sev: "success" });
                  setEditOpen(false);
                  loadList();
                } catch (e: any) {
                  setToast({
                    open: true,
                    msg: `แก้ไขไม่สำเร็จ: ${e.message}`,
                    sev: "error",
                  });
                } finally {
                  setGlobalLoading(false);
                }
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
