// src/app/(control-panel)/cuplump-received/[id]/page.tsx
"use client";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckIcon from "@mui/icons-material/Check";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";

import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import Snackbar from "@mui/material/Snackbar";

import dayjs from "dayjs";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

/* ================= CONFIG & helpers ================= */
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://database-system.ytrc.co.th/api";

const QUALITY_API = (id: string) => `${API_BASE}/bookings/${id}/quality`;
const ENTRIES_API = (id: string) => `${API_BASE}/bookings/${id}/entries`;
const ENTRY_API = (id: string, entryId: string) =>
  `${API_BASE}/bookings/${id}/entries/${entryId}`;
const LOOKUP_API = (code: string) =>
  `${API_BASE}/bookings/lookup?booking_code=${encodeURIComponent(code)}`;
const BOOKING_API = (id: string) => `${API_BASE}/bookings/${id}`;

function getToken(): string {
  try {
    const fromLS =
      localStorage.getItem("access_token") ||
      localStorage.getItem("backend_access_token");
    const fromSS =
      sessionStorage.getItem("access_token") ||
      sessionStorage.getItem("backend_access_token");
    if (fromLS) return fromLS;
    if (fromSS) return fromSS;
    const ck = document.cookie
      ?.split(";")
      ?.map((s) => s.trim())
      ?.find((s) => /^(access_token|backend_access_token)=/.test(s));
    if (ck) return decodeURIComponent(ck.split("=")[1]);
    return "";
  } catch {
    return "";
  }
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(init?.headers as any),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...init, headers, cache: "no-store" });
  const raw = await res.text().catch(() => "");
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = raw ? JSON.parse(raw) : null;
      if (j?.message)
        msg = Array.isArray(j.message)
          ? j.message.join(", ")
          : String(j.message);
      else if (j?.error) msg = String(j.error);
      else if (raw) msg = raw;
    } catch {
      if (raw) msg = raw;
    }
    throw new Error(msg);
  }
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

// quality
async function trySaveQuality(
  id: string,
  payload: {
    moisture?: number;
    cpAvg?: number;
    drcEstimate?: number;
    drcRequested?: number;
    drcActual?: number;
    grade?: string;
    cl_lotnumber?: string;
  }
) {
  const body: any = { ...payload };
  if ("cpPercent" in body) delete (body as any).cpPercent;
  return fetchJSON<any>(QUALITY_API(id), {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
async function fetchQuality(id: string) {
  try {
    return await fetchJSON<any>(QUALITY_API(id), { method: "GET" });
  } catch {
    return null as any;
  }
}
async function fetchBooking(id: string) {
  return fetchJSON<any>(BOOKING_API(id));
}

// entries
async function fetchEntries(id: string) {
  const r = await fetchJSON<{ items?: any[]; count?: number }>(ENTRIES_API(id));
  return Array.isArray(r?.items) ? r.items : [];
}
async function createEntry(id: string, payload: any) {
  return fetchJSON<any>(ENTRIES_API(id), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
async function updateEntry(id: string, entryId: string, payload: any) {
  return fetchJSON<any>(ENTRY_API(id, entryId), {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
async function deleteEntry(id: string, entryId: string) {
  return fetchJSON<any>(ENTRY_API(id, entryId), { method: "DELETE" });
}

/* ===== utils ===== */
const show = (v: any) =>
  v === null || v === undefined || v === "" ? "-" : String(v);

const toNum = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const clampPct = (v: any): number | null => {
  const n = toNum(v);
  if (n == null) return null;
  return Math.max(0, Math.min(100, n));
};

const fmtKg = (v: any) => {
  const n = toNum(v);
  return n === null ? "-" : n.toLocaleString();
};

function fmtFixed(v: any, digits: number): string {
  const n = toNum(v);
  if (n == null) return "-";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  });
}

const isTrailer = (truckType?: string) => {
  const t = (truckType || "").toLowerCase();
  return t.includes("พ่วง") || t.includes("trailer");
};

function weightBreakText({
  head,
  trailer,
  single,
}: {
  head?: number | null;
  trailer?: number | null;
  single?: number | null;
}) {
  const h = toNum(head);
  const t = toNum(trailer);
  const s = toNum(single);
  if (h != null || t != null) {
    return `${h != null ? h.toLocaleString() : "-"} / ${t != null ? t.toLocaleString() : "-"}`;
  }
  if (s != null) return s.toLocaleString();
  return "-";
}
function sumOut({
  head,
  trailer,
  single,
}: {
  head?: any;
  trailer?: any;
  single?: any;
}) {
  const h = toNum(head);
  const t = toNum(single);
  const s = toNum(trailer);
  if (t != null) return t;
  if (h != null || s != null) return (h ?? 0) + (s ?? 0);
  return null;
}
function parsePair(text?: string): { a: number | null; b: number | null } {
  const s = (text || "").trim();
  if (!s) return { a: null, b: null };
  const parts = s.split("/").map((x) => toNum(x));
  if (parts.length === 1) return { a: parts[0], b: null };
  return { a: parts[0], b: parts[1] };
}

/* ===== province map & helpers ===== */
const TH_PROVINCES: Record<number, string> = {
  10: "กรุงเทพมหานคร",
  11: "สมุทรปราการ",
  12: "นนทบุรี",
  13: "ปทุมธานี",
  14: "พระนครศรีอยุธยา",
  15: "อ่างทอง",
  16: "ลพบุรี",
  17: "สิงห์บุรี",
  18: "ชัยนาท",
  19: "สระบุรี",
  20: "ชลบุรี",
  21: "ระยอง",
  22: "จันทบุรี",
  23: "ตราด",
  24: "ฉะเชิงเทรา",
  25: "ปราจีนบุรี",
  26: "นครนายก",
  27: "สระแก้ว",
  30: "นครราชสีมา",
  31: "บุรีรัมย์",
  32: "สุรินทร์",
  33: "ศรีสะเกษ",
  34: "อุบลราชธานี",
  35: "ยโสธร",
  36: "ชัยภูมิ",
  37: "อำนาจเจริญ",
  38: "บึงกาฬ",
  39: "นครพนม",
  40: "ขอนแก่น",
  41: "อุดรธานี",
  42: "เลย",
  43: "หนองคาย",
  44: "มหาสารคาม",
  45: "ร้อยเอ็ด",
  46: "กาฬสินธุ์",
  47: "สกลนคร",
  49: "มุกดาหาร",
  50: "เชียงใหม่",
  51: "ลำพูน",
  52: "ลำปาง",
  53: "อุตรดิตถ์",
  54: "แพร่",
  55: "น่าน",
  56: "พะเยา",
  57: "เชียงราย",
  58: "แม่ฮ่องสอน",
  60: "นครสวรรค์",
  61: "อุทัยธานี",
  62: "กำแพงเพชร",
  63: "ตาก",
  64: "สุโขทัย",
  65: "พิษณุโลก",
  66: "พิจิตร",
  67: "เพชรบูรณ์",
  70: "ราชบุรี",
  71: "กาญจนบุรี",
  72: "สุพรรณบุรี",
  73: "นครปฐม",
  74: "สมุทรสาคร",
  75: "สมุทรสงคราม",
  76: "เพชรบุรี",
  77: "ประจวบคีรีขันธ์",
  80: "นครศรีธรรมราช",
  81: "กระบี่",
  82: "พังงา",
  83: "ภูเก็ต",
  84: "สุราษฎร์ธานี",
  85: "ระนอง",
  86: "ชุมพร",
  90: "สงขลา",
  91: "สตูล",
  92: "ตรัง",
  93: "พัทลุง",
  94: "ปัตตานี",
  95: "ยะลา",
  96: "นราธิวาส",
};
const provinceName = (code?: number | null) =>
  code == null ? undefined : TH_PROVINCES[code] || `จังหวัดรหัส ${code}`;
function pickProvinceCode(anyVal: any): number | null {
  if (anyVal == null || anyVal === "") return null;
  if (typeof anyVal === "number" && Number.isFinite(anyVal)) return anyVal;
  if (typeof anyVal === "string" && /^\d+$/.test(anyVal)) return Number(anyVal);
  if (typeof anyVal === "object") {
    const cand =
      anyVal.code ??
      anyVal.id ??
      anyVal.provinceCode ??
      anyVal.province_id ??
      anyVal.rubberSourceProvince ??
      anyVal.value;
    if (cand != null) return pickProvinceCode(cand);
  }
  return null;
}

/* Small UI helpers */
const KV = ({ label, value }: { label: string; value: React.ReactNode }) => {
  const isPrimitive =
    typeof value === "string" || typeof value === "number" || value == null;
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="baseline"
      sx={{ minWidth: 220 }}
    >
      <Typography variant="body2" color="text.secondary" component="span">
        {label} :
      </Typography>
      {isPrimitive ? (
        <Typography variant="body2" fontWeight={600} component="span">
          {value as any}
        </Typography>
      ) : (
        <Box sx={{ typography: "body2", fontWeight: 600 }}>{value}</Box>
      )}
    </Stack>
  );
};

const Section = ({
  title,
  children,
  dense,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  dense?: boolean;
}) => (
  <Paper variant="outlined" sx={{ p: dense ? 2 : 3, mb: 2.5, borderRadius: 2 }}>
    <Box sx={{ mb: dense ? 1.5 : 2 }}>{title}</Box>
    <Divider sx={{ mb: dense ? 1.5 : 2 }} />
    {children}
  </Paper>
);

/** การ์ดสรุป */
const StatCard = ({
  title,
  value,
  hint,
  highlight = false,
  highlightVariant = "success",
  height = 156,
  align = "right",
}: {
  title: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  highlight?: boolean;
  highlightVariant?: "success" | "neutral";
  height?: number;
  align?: "left" | "right";
}) => (
  <Grid size={{ xs: 12, sm: 4, md: 4 }}>
    <Paper
      variant="outlined"
      sx={(t) => {
        const isNeutral = highlight && highlightVariant === "neutral";
        const border = isNeutral ? t.palette.divider : t.palette.success.main;
        const bgNeutral =
          t.palette.mode === "dark" ? t.palette.grey[800] : t.palette.grey[200];
        const bgSuccess =
          t.palette.mode === "dark"
            ? t.palette.success.dark
            : t.palette.success.light;
        return {
          p: 2,
          minHeight: height,
          borderRadius: 2,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: align === "right" ? "flex-end" : "flex-start",
          textAlign: align === "right" ? "right" : "left",
          borderColor: highlight ? border : t.palette.divider,
          bgcolor: highlight
            ? isNeutral
              ? bgNeutral
              : bgSuccess
            : "transparent",
        };
      }}
    >
      <Typography
        variant="overline"
        sx={{ letterSpacing: 0.5, opacity: 0.8 }}
        display="block"
      >
        {title}
      </Typography>
      <Typography variant="h5" fontWeight={900} sx={{ lineHeight: 1.1 }}>
        {value}
      </Typography>
      {hint ? (
        <Typography
          variant="caption"
          sx={{ opacity: 0.8, whiteSpace: "pre-line" }}
        >
          {hint}
        </Typography>
      ) : (
        <Box sx={{ height: 18 }} />
      )}
    </Paper>
  </Grid>
);

/* ===== page ===== */
export default function CuplumpDetailPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const params = useParams();

  const [data, setData] = React.useState<any | null>(null);
  const [savingQuality, setSavingQuality] = React.useState(false);
  const [resolvedBookingId, setResolvedBookingId] = React.useState<string>("");
  const [quality, setQuality] = React.useState<any | null>(null);
  const [entries, setEntries] = React.useState<any[]>([]);
  const [loadingQuality, setLoadingQuality] = React.useState(false);
  const [loadingEntries, setLoadingEntries] = React.useState(false);
  const [hasLotSaved, setHasLotSaved] = React.useState(false);
  const [confirmLotOpen, setConfirmLotOpen] = React.useState(false);
  const [savingLot, setSavingLot] = React.useState(false);

  // ===== Quality form state =====
  const NUM_FIELDS = [
    "moisture",
    "drcEstimate",
    "drcRequested",
    "drcActual",
  ] as const;
  type FieldKeyNum = (typeof NUM_FIELDS)[number];

  const [formQuality, setFormQuality] = React.useState<
    Record<FieldKeyNum, number | null> & { grade: string }
  >({
    moisture: null,
    drcEstimate: null,
    drcRequested: null,
    drcActual: null,
    grade: "",
  });

  // ===== Entry form state (add) =====
  const [entryForm, setEntryForm] = React.useState<{
    beforePress: string;
    basket: string;
    cuplump: string; // readonly (calculated, 2 decimals)
    afterPress: string;
    cp: number | null;
    beforeBaking1: string;
    beforeBaking2: string;
    beforeBaking3: string;
    note?: string;
  }>({
    beforePress: "",
    basket: "",
    cuplump: "",
    afterPress: "",
    cp: null,
    beforeBaking1: "",
    beforeBaking2: "",
    beforeBaking3: "",
    note: "",
  });
  const [savingEntry, setSavingEntry] = React.useState(false);
  const [confirmAddOpen, setConfirmAddOpen] = React.useState(false);

  // ===== Edit/Delete dialog state =====
  const [editOpen, setEditOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<any | null>(null);
  const [editSaving, setEditSaving] = React.useState(false);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<any | null>(null);
  const [deleteSaving, setDeleteSaving] = React.useState(false);

  // มีข้อมูลเดิมจาก backend แล้วหรือยัง → ใช้ค่านี้กำหนดปุ่ม Edit/Save
  const hasExistingQuality = React.useMemo(() => {
    const q = quality || {};
    return [
      "moisture",
      "cpAvg",
      "drcEstimate",
      "drcRequested",
      "drcActual",
      "grade",
      "cl_lotnumber",
    ].some((k) => (q as any)?.[k] != null && (q as any)?.[k] !== "");
  }, [quality]);
  const actionLabel = hasExistingQuality ? "Edit" : "Save";
  const ActionIcon = hasExistingQuality ? EditIcon : SaveIcon;

  // Snackbar + Confirm (quality)
  type SnackSeverity = "success" | "error" | "info" | "warning";
  const [snack, setSnack] = React.useState<{
    open: boolean;
    msg: string;
    severity: SnackSeverity;
  }>({ open: false, msg: "", severity: "success" });
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const showSnack = (msg: string, severity: SnackSeverity = "success") =>
    setSnack({ open: true, msg, severity });

  // ====== Derived: cpAvg จาก entries (2 ตำแหน่ง) ======
  const cpAvgNumber = React.useMemo(() => {
    const nums = (entries || [])
      .map((e: any) => toNum(e?.cp))
      .filter((n): n is number => n != null && Number.isFinite(n));
    if (!nums.length) return null;
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    return Math.round(avg * 100) / 100; // 2 decimals
  }, [entries]);
  const cpAvgDisplay =
    cpAvgNumber == null
      ? ""
      : cpAvgNumber.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          useGrouping: false,
        });

  // เมื่อกด "ยืนยัน" คุณภาพ
  const handleConfirmSaveQuality = async () => {
    try {
      setSavingQuality(true);

      const payload: any = {
        moisture: clampPct(formQuality.moisture) ?? undefined,
        cpAvg: cpAvgNumber ?? undefined, // backend จะเมิน แต่ไม่เป็นไร
        drcEstimate: clampPct(formQuality.drcEstimate) ?? undefined,
        drcRequested: clampPct(formQuality.drcRequested) ?? undefined,
        drcActual: clampPct(formQuality.drcActual) ?? undefined,
        grade: formQuality.grade?.trim() ? formQuality.grade.trim() : undefined,
        cl_lotnumber: data?.lotNumber?.trim()
          ? data.lotNumber.trim()
          : undefined,
      };
      Object.keys(payload).forEach(
        (k) => payload[k] === undefined && delete payload[k]
      );

      if (!Object.keys(payload).length) {
        showSnack("กรุณากรอกค่าอย่างน้อย 1 ช่อง", "warning");
        return;
      }
      if (!bookingId || !resolvedBookingId) {
        showSnack("ไม่พบรหัสรายการ (bookingId)", "error");
        return;
      }

      const resp = await trySaveQuality(resolvedBookingId, payload);

      const nextForm = {
        moisture: resp?.moisture ?? formQuality.moisture,
        drcEstimate: resp?.drcEstimate ?? formQuality.drcEstimate,
        drcRequested: resp?.drcRequested ?? formQuality.drcRequested,
        drcActual: resp?.drcActual ?? formQuality.drcActual,
        grade: resp?.grade ?? formQuality.grade,
      };
      setFormQuality(nextForm);
      writeCache(resolvedBookingId, { ...nextForm, grade: nextForm.grade });

      setQuality((prev: any) => ({
        ...(prev || {}),
        ...resp,
        cpAvg: resp?.cpAvg ?? cpAvgNumber ?? null,
        cl_lotnumber: resp?.cl_lotnumber ?? data?.lotNumber ?? null,
        updatedAt: new Date().toISOString(),
      }));
      if (resp?.cl_lotnumber != null) {
        setData((p: any) => ({ ...(p || {}), lotNumber: resp.cl_lotnumber }));
        setHasLotSaved(!!resp.cl_lotnumber);
      }

      showSnack(
        hasExistingQuality ? "อัปเดตสำเร็จ" : "บันทึกสำเร็จ",
        "success"
      );
    } catch (e: any) {
      showSnack(e?.message || "Internal server error", "error");
    } finally {
      setSavingQuality(false);
      setConfirmOpen(false);
    }
  };

  // [ADD] Save CL Lot Number handler + confirm close
  const handleConfirmSaveLot = async () => {
    if (!resolvedBookingId) {
      showSnack("ไม่พบรหัสรายการ (bookingId)", "error");
      return;
    }
    try {
      setSavingLot(true);
      const body = {
        cl_lotnumber: (data?.lotNumber?.trim() || null) as string | null,
      };
      const resp = await fetchJSON<any>(QUALITY_API(resolvedBookingId), {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      // sync quality + data
      setQuality((prev: any) => ({
        ...(prev || {}),
        cl_lotnumber: resp?.cl_lotnumber ?? body.cl_lotnumber,
      }));
      if (resp?.cl_lotnumber != null) {
        setData((p: any) => ({ ...(p || {}), lotNumber: resp.cl_lotnumber }));
      }
      const saved = !!(resp?.cl_lotnumber ?? body.cl_lotnumber);
      setHasLotSaved(saved);
      showSnack(
        saved ? "บันทึก CL Lot Number สำเร็จ" : "อัปเดต CL Lot Number สำเร็จ",
        "success"
      );
    } catch (e: any) {
      showSnack(e?.message || "บันทึก CL Lot Number ไม่สำเร็จ", "error");
    } finally {
      setSavingLot(false);
      setConfirmLotOpen(false);
    }
  };

  /* ===== cache helpers ===== */
  const cacheKey = (id: string) => `quality_form_${id}`;
  const readCache = (id: string) => {
    try {
      const raw = localStorage.getItem(cacheKey(id));
      if (!raw) return null;
      const j = JSON.parse(raw);
      const obj: Record<FieldKeyNum, number | null> & { grade: string } = {
        moisture: j?.moisture ?? null,
        drcEstimate: j?.drcEstimate ?? null,
        drcRequested: j?.drcRequested ?? null,
        drcActual: j?.drcActual ?? null,
        grade: j?.grade ?? "",
      };
      return obj;
    } catch {
      return null;
    }
  };
  const writeCache = (
    id: string,
    val: Record<FieldKeyNum, number | null> & { grade: string }
  ) => {
    try {
      localStorage.setItem(cacheKey(id), JSON.stringify(val));
    } catch {}
  };

  React.useEffect(() => {
    // 1) จากหน้า List (sessionStorage)
    let fromSS: any = {};
    try {
      const ss = sessionStorage.getItem("cuplump_selected");
      if (ss) {
        const p = JSON.parse(ss);
        const g = parsePair(p.grossWeight);
        const n = parsePair(p.netWeight);

        let weightIn: number | null = null;
        let weightInHead: number | null = null;
        let weightInTrailer: number | null = null;
        let weightOut: number | null = null;
        let weightOutHead: number | null = null;
        let weightOutTrailer: number | null = null;

        if (g.b !== null || n.b !== null) {
          weightInHead = g.a ?? 0;
          weightInTrailer = g.b ?? 0;
          const netHead = n.a ?? 0;
          const netTrailer = n.b ?? 0;
          weightOutHead = (weightInHead ?? 0) - netHead;
          weightOutTrailer = (weightInTrailer ?? 0) - netTrailer;
          weightIn = (weightInHead ?? 0) + (weightInTrailer ?? 0);
          weightOut = (weightOutHead ?? 0) + (weightOutTrailer ?? 0);
        } else {
          const inSingle = g.a ?? 0;
          const netSingle = n.a ?? 0;
          weightIn = inSingle;
          weightOut = inSingle - netSingle;
        }

        fromSS = {
          dateISO: p.dateISO,
          dateText: p.dateText,
          supplier: p.supplier,
          rubberType: p.rubberType,
          truckRegister: p.truckRegisters?.[0] || "",
          truckType: p.truckTypes?.[0] || "",
          lotNumber: p.cl_lotnumber ?? p.lotNumber ?? "",
          bookingCode: p.bookingCode ?? p.booking_code ?? undefined,
          rubberSourceProvince:
            pickProvinceCode(
              p.rubberSourceProvince ??
                p.rubberSourceProvinceCode ??
                p.rubberSourceProvinceId ??
                p.sourceProvince ??
                p.province ??
                p.provinceCode ??
                p.rubberSource
            ) ?? null,
          source: p.source ?? "-",
          rubberSourceHeadProvince:
            pickProvinceCode(p.rubberSourceHeadProvince) ?? null,
          rubberSourceTrailerProvince:
            pickProvinceCode(p.rubberSourceTrailerProvince) ?? null,
          weightIn,
          weightInHead,
          weightInTrailer,
          weightOut,
          weightOutHead,
          weightOutTrailer,
          moisture: toNum(p.moisture),
          cpPercent: toNum(p.cpPercent),
          drcEstimate: toNum(p.drcEstimate),
          drcRequested: toNum(p.drcRequested),
          drcActual: toNum(p.drcActual),
          id: p.id ?? p.bookingId,
          bookingId: p.bookingId ?? p.id,
          grade: p.grade ?? "",
        };
      }
    } catch {}

    // 2) จาก URL (fallback)
    const q = (k: string) => sp.get(k);
    const fromSP = {
      dateISO: q("date"),
      dateText: q("date")
        ? dayjs(q("date") as string).format("DD-MMM-YYYY")
        : undefined,
      supplier: q("supplier")
        ? decodeURIComponent(q("supplier") as string)
        : undefined,
      rubberType: q("rubberType")
        ? decodeURIComponent(q("rubberType") as string)
        : undefined,
      truckRegister: q("truckRegister") || undefined,
      truckType: q("truckType") || undefined,
      bookingCode: q("bookingCode") || undefined,
      lotNumber: q("cl_lotnumber") || q("lotNumber") || "",
      rubberSourceProvince: (() => {
        const raw = q("rubberSourceProvince");
        if (!raw) return undefined;
        try {
          const obj = JSON.parse(raw);
          return pickProvinceCode(obj) ?? undefined;
        } catch {
          return pickProvinceCode(raw) ?? undefined;
        }
      })(),
      rubberSourceHeadProvince: (() => {
        const raw = q("rubberSourceHeadProvince");
        return raw ? (pickProvinceCode(raw) ?? undefined) : undefined;
      })(),
      rubberSourceTrailerProvince: (() => {
        const raw = q("rubberSourceTrailerProvince");
        return raw ? (pickProvinceCode(raw) ?? undefined) : undefined;
      })(),
      id: q("id") || undefined,
      bookingId: q("id") || undefined,
      grade: q("grade") || "",
    };

    // 3) ค่าพื้นฐาน
    const fallback = {
      dateISO: dayjs().format("YYYY-MM-DD"),
      dateText: dayjs().format("DD-MMM-YYYY"),
      supplier: "N/A",
      rubberType: "N/A",
      truckRegister: "N/A",
      truckType: "N/A",
      bookingCode: undefined as string | undefined,
      sequence: null as number | null,
      userName: "Apiwat",
      startTime: null as any,
      endTime: null as any,
      checkInTime: null as any,
      drainStartTime: null as any,
      drainStopTime: null as any,
      lotNumber: "",
      rubberSourceProvince: null as number | null,
      rubberSourceHeadProvince: null as number | null,
      rubberSourceTrailerProvince: null as number | null,
      source: "-",
      moisture: null as number | null,
      drcEstimate: null as number | null,
      drcRequested: null as number | null,
      drcActual: null as number | null,
      weightIn: null as number | null,
      weightInHead: null as number | null,
      weightInTrailer: null as number | null,
      weightOut: null as number | null,
      weightOutHead: null as number | null,
      weightOutTrailer: null as number | null,
      id: undefined as string | undefined,
      bookingId: undefined as string | undefined,
      grade: "",
    };

    const merged = { ...fallback, ...fromSP, ...fromSS };
    setData(merged);
  }, [sp, params?.id]);

  // helper: ตรวจว่าเป็น ObjectId ไหม
  const isObjectId = (v?: string) => !!v && /^[a-f\d]{24}$/i.test(v);

  React.useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      const paramId = (params?.id as string) || "";
      const codeFromQuery = sp.get("bookingCode") || "";
      const codeFromState = (data as any)?.bookingCode || "";
      const bookingCode = codeFromQuery || codeFromState || "";

      if (isObjectId(paramId)) {
        if (!cancelled) setResolvedBookingId(paramId);
        return;
      }

      if (bookingCode) {
        try {
          const r = await fetchJSON<{ id?: string }>(LOOKUP_API(bookingCode));
          if (!cancelled) setResolvedBookingId(r?.id || "");
        } catch {
          if (!cancelled) setResolvedBookingId("");
        }
        return;
      }

      if (!cancelled) setResolvedBookingId("");
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [params?.id, sp, (data as any)?.bookingCode]);

  // โหลด quality + booking (เพื่อ lot number)
  React.useEffect(() => {
    if (!resolvedBookingId) {
      setQuality(null);
      return;
    }
    (async () => {
      try {
        setLoadingQuality(true);
        setHasLotSaved(false); // reset ก่อนโหลด
        const cached = readCache(resolvedBookingId);
        if (cached) setFormQuality(cached);

        // ดึงข้อมูล booking หลัก (เอา cl_lotnumber และอื่น ๆ)
        try {
          const b = await fetchBooking(resolvedBookingId);
          if (b?.cl_lotnumber != null && b.cl_lotnumber !== "") {
            setData((p: any) => ({ ...(p || {}), lotNumber: b.cl_lotnumber }));
            setHasLotSaved(true);
          }
        } catch {}

        // ดึง quality (ถ้ามี endpoint) — ให้ override
        const q = await fetchQuality(resolvedBookingId);
        if (q) {
          setQuality(q || null);
          if (q?.cl_lotnumber != null && q.cl_lotnumber !== "") {
            setData((p: any) => ({ ...(p || {}), lotNumber: q.cl_lotnumber }));
            setHasLotSaved(true);
          }
        }

        const filled = {
          moisture: q?.moisture ?? cached?.moisture ?? null,
          drcEstimate: q?.drcEstimate ?? cached?.drcEstimate ?? null,
          drcRequested: q?.drcRequested ?? cached?.drcRequested ?? null,
          drcActual: q?.drcActual ?? cached?.drcActual ?? null,
          grade: q?.grade ?? cached?.grade ?? "",
        };
        setFormQuality(filled);
        writeCache(resolvedBookingId, filled);
      } catch (err) {
        console.warn("load quality error", err);
      } finally {
        setLoadingQuality(false);
      }
    })();
  }, [resolvedBookingId]);

  // โหลด entries + refresh hooks
  const refreshEntries = React.useCallback(async () => {
    if (!resolvedBookingId) return;
    setLoadingEntries(true);
    try {
      const items = await fetchEntries(resolvedBookingId);
      setEntries(items);
    } catch (e1) {
      await new Promise((r) => setTimeout(r, 250));
      try {
        const items2 = await fetchEntries(resolvedBookingId);
        setEntries(items2);
      } catch (e2) {
        console.warn("fetch entries failed", e1, e2);
        setEntries([]);
      }
    } finally {
      setLoadingEntries(false);
    }
  }, [resolvedBookingId]);

  React.useEffect(() => {
    if (!resolvedBookingId) return;
    refreshEntries();
    const onFocus = () => refreshEntries();
    const onVis = () => {
      if (document.visibilityState === "visible") refreshEntries();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [resolvedBookingId, refreshEntries]);

  // เขียน cache ทุกครั้งที่ผู้ใช้แก้ค่า
  React.useEffect(() => {
    if (!resolvedBookingId) return;
    writeCache(resolvedBookingId, formQuality);
  }, [resolvedBookingId, formQuality]);

  // หลังมี state แล้วค่อย derive bookingId ปลอดภัย
  const bookingId =
    (params?.id as string) ||
    sp.get("id") ||
    (data as any)?.bookingId ||
    (data as any)?.id ||
    "";

  const trailer = React.useMemo(() => isTrailer(data?.truckType), [data]);
  const headTrailerHint = React.useCallback((pair: string) => {
    if (!pair.includes("/")) return undefined;
    const [head, trailer] = pair.split("/").map((s) => s.trim());
    return `Head = ${head}\nTrailer = ${trailer}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kgs = React.useMemo(() => {
    if (!data) return null;
    const inPair = weightBreakText({
      head: data.weightInHead,
      trailer: data.weightInTrailer,
      single: data.weightIn,
    });
    const outPair = weightBreakText({
      head: data.weightOutHead,
      trailer: data.weightOutTrailer,
      single: data.weightOut,
    });
    const outSum = sumOut({
      head: data.weightOutHead,
      trailer: data.weightOutTrailer,
      single: data.weightOut,
    });
    const net =
      data.weightIn != null && outSum != null
        ? Math.max(0, data.weightIn - outSum)
        : null;
    return {
      inPair,
      outPair,
      outSum,
      net,
      inHint: trailer ? headTrailerHint(inPair) : undefined,
      outHint: trailer ? headTrailerHint(outPair) : undefined,
    };
  }, [data, trailer, headTrailerHint]);

  // ===== Auto-calc: Cuplump (add form, 2 decimals) =====
  React.useEffect(() => {
    const b = toNum(entryForm.beforePress);
    const k = toNum(entryForm.basket);
    const val = b == null || k == null ? "" : (b - k).toFixed(2); // 2 ตำแหน่ง
    setEntryForm((p) => (p.cuplump === val ? p : { ...p, cuplump: val }));
  }, [entryForm.beforePress, entryForm.basket]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || !kgs) {
    return (
      <Box className="p-6 flex justify-center items-center">
        <Stack direction="row" spacing={2} alignItems="center">
          <CircularProgress size={24} />
          <Typography>Loading details...</Typography>
        </Stack>
      </Box>
    );
  }

  // ========= handler เพิ่มรายการ =========
  const doAddEntry = async () => {
    if (!resolvedBookingId) {
      showSnack("ไม่พบรหัสรายการ (bookingId)", "error");
      return;
    }
    const hasAny =
      entryForm.beforePress ||
      entryForm.basket ||
      entryForm.cuplump ||
      entryForm.afterPress ||
      entryForm.beforeBaking1 ||
      entryForm.beforeBaking2 ||
      entryForm.beforeBaking3 ||
      (entryForm.cp != null && entryForm.cp !== undefined) ||
      entryForm.note;

    if (!hasAny) {
      showSnack("กรุณากรอกข้อมูลอย่างน้อย 1 ช่อง", "warning");
      return;
    }

    const computedCuplump = (() => {
      const b = toNum(entryForm.beforePress);
      const k = toNum(entryForm.basket);
      const v = b == null || k == null ? null : b - k;
      return Number.isFinite(v as number) ? (v as number) : null;
    })();

    const payload = {
      before_press: toNum(entryForm.beforePress),
      basket: toNum(entryForm.basket),
      cuplump: computedCuplump,
      after_press: toNum(entryForm.afterPress),
      cp: clampPct(entryForm.cp),
      before_baking_1: toNum(entryForm.beforeBaking1),
      before_baking_2: toNum(entryForm.beforeBaking2),
      before_baking_3: toNum(entryForm.beforeBaking3),
      note: entryForm.note || undefined,
      created_by: data?.userName || "System",
    };
    Object.keys(payload).forEach(
      (k) => (payload as any)[k] == null && delete (payload as any)[k]
    );

    try {
      setSavingEntry(true);
      await createEntry(resolvedBookingId, payload);
      await refreshEntries();
      setEntryForm({
        beforePress: "",
        basket: "",
        cuplump: "",
        afterPress: "",
        cp: null,
        beforeBaking1: "",
        beforeBaking2: "",
        beforeBaking3: "",
        note: "",
      });
      showSnack("บันทึกรายการสำเร็จ", "success");
    } catch (e: any) {
      showSnack(e?.message || "ไม่สามารถบันทึกรายการได้", "error");
    } finally {
      setSavingEntry(false);
      setConfirmAddOpen(false);
    }
  };

  // ========= handler แก้ไข =========
  const openEdit = (row: any) => {
    setEditTarget({
      id: row.id,
      beforePress: String(row.beforePress ?? ""),
      basket: String(row.basket ?? ""),
      cuplump: (() => {
        const bp = toNum(row.beforePress);
        const bk = toNum(row.basket);
        return bp == null || bk == null ? "" : (bp - bk).toFixed(2); // 2 ตำแหน่ง
      })(),
      afterPress: String(row.afterPress ?? ""),
      cp: row.cp ?? null,
      beforeBaking1: String(row.beforeBaking1 ?? ""),
      beforeBaking2: String(row.beforeBaking2 ?? ""),
      beforeBaking3: String(row.beforeBaking3 ?? ""),
      note: row.note ?? "",
      no: row.no ?? null,
    });
    setEditOpen(true);
  };

  const doSaveEdit = async () => {
    if (!editTarget?.id) return;

    const computedCuplump = (() => {
      const b = toNum(editTarget.beforePress);
      const k = toNum(editTarget.basket);
      const v = b == null || k == null ? null : b - k;
      return Number.isFinite(v as number) ? (v as number) : null;
    })();

    const payload = {
      before_press: toNum(editTarget.beforePress),
      basket: toNum(editTarget.basket),
      cuplump: computedCuplump,
      after_press: toNum(editTarget.afterPress),
      cp: clampPct(editTarget.cp),
      before_baking_1: toNum(editTarget.beforeBaking1),
      before_baking_2: toNum(editTarget.beforeBaking2),
      before_baking_3: toNum(editTarget.beforeBaking3),
      note: editTarget.note || undefined,
    };
    Object.keys(payload).forEach(
      (k) => (payload as any)[k] == null && delete (payload as any)[k]
    );

    try {
      setEditSaving(true);
      await updateEntry(resolvedBookingId, editTarget.id, payload);
      await refreshEntries();
      showSnack("อัปเดตรายการสำเร็จ", "success");
      setEditOpen(false);
    } catch (e: any) {
      showSnack(e?.message || "อัปเดตไม่สำเร็จ", "error");
    } finally {
      setEditSaving(false);
    }
  };

  // ========= handler ลบ =========
  const openDelete = (row: any) => {
    setDeleteTarget(row);
    setDeleteOpen(true);
  };
  const doDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      setDeleteSaving(true);
      await deleteEntry(resolvedBookingId, deleteTarget.id);
      await refreshEntries();
      showSnack("ลบรายการสำเร็จ", "success");
      setDeleteOpen(false);
    } catch (e: any) {
      showSnack(e?.message || "ลบไม่สำเร็จ", "error");
    } finally {
      setDeleteSaving(false);
    }
  };

  // ==== Rubber Source display (รองรับ head/trailer) ====
  const singleProvinceCode = pickProvinceCode(
    data.rubberSourceProvince ??
      data.sourceProvince ??
      data.province ??
      data.provinceCode ??
      data.rubberSource
  );
  const headProvinceCode = pickProvinceCode(data.rubberSourceHeadProvince);
  const trailerProvinceCode = pickProvinceCode(
    data.rubberSourceTrailerProvince
  );
  const rubberSourceIsSplit =
    trailer && (headProvinceCode || trailerProvinceCode);
  const rubberSourceDisplay = rubberSourceIsSplit
    ? "-"
    : (provinceName(singleProvinceCode ?? null) ?? show(data.source));

  const rubberSourceStack = rubberSourceIsSplit ? (
    <Stack spacing={0.25} alignItems="flex-start">
      <Typography variant="body2" fontWeight={700} component="span">
        Head: {provinceName(headProvinceCode ?? null) ?? "-"}
      </Typography>
      <Typography variant="body2" fontWeight={700} component="span">
        Trailer: {provinceName(trailerProvinceCode ?? null) ?? "-"}
      </Typography>
    </Stack>
  ) : (
    <Typography variant="body2" fontWeight={700} component="span">
      {rubberSourceDisplay}
    </Typography>
  );

  return (
    <Box className="p-6">
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
          color="inherit"
          variant="outlined"
        >
          Back
        </Button>
        <Typography variant="h5" fontWeight={800}>
          Cuplump Detail
        </Typography>
      </Stack>

      {/* ===== Overview ===== */}
      <Section
        title={
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            <Chip label={data.dateText} variant="outlined" />
            <Box sx={{ flexGrow: 1 }} />
            {/* <Stack direction="row" spacing={1}>
              <Chip
                label={`BookingCode: ${data?.bookingCode || "-"}`}
                variant="outlined"
              />
              <Chip
                label={`ResolvedId: ${resolvedBookingId || "-"}`}
                variant="outlined"
              />
            </Stack> */}

            {/* CL Lot Number (with confirm + toggle Save/Edit) */}
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                label="Lot Number"
                size="small"
                value={data.lotNumber ?? ""}
                onChange={(e) =>
                  setData((prev: any) => ({
                    ...prev,
                    lotNumber: e.target.value,
                  }))
                }
                sx={{ minWidth: 220 }}
              />
              <Button
                variant="contained"
                size="small"
                disabled={!resolvedBookingId}
                startIcon={hasLotSaved ? <EditIcon /> : <SaveIcon />}
                onClick={() => setConfirmLotOpen(true)}
              >
                {hasLotSaved ? "แก้ไข" : "บันทึก"}
              </Button>
            </Stack>
          </Box>
        }
      >
        <Grid container spacing={1}>
          {/* ผู้ขาย & รถ */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper
              variant="outlined"
              sx={{ p: 2, borderRadius: 2, height: "100%" }}
            >
              <Stack spacing={0.5}>
                <KV label="Supplier" value={show(data.supplier)} />
                <KV label="ทะเบียน" value={show(data.truckRegister)} />
                <KV label="ประเภท" value={show(data.truckType)} />
              </Stack>
            </Paper>
          </Grid>

          {/* ประเภทยาง + Rubber Source */}
          <Grid size={{ xs: 12, md: 3 }}>
            <Paper
              variant="outlined"
              sx={{ p: 2, borderRadius: 2, height: "100%" }}
            >
              <Stack spacing={0.75}>
                <KV
                  label="Rubber Type"
                  value={
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      component="span"
                    >
                      {show(data.rubberType)}
                    </Typography>
                  }
                />
                <KV
                  label="Rubber Source"
                  value={
                    <Stack alignItems="flex-start" spacing={0.25}>
                      {rubberSourceStack}
                    </Stack>
                  }
                />
              </Stack>
            </Paper>
          </Grid>

          {/* น้ำหนัก */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Grid container spacing={1}>
              <StatCard
                title="WEIGHT IN"
                value={fmtKg(data.weightIn)}
                height={156}
                hint="( KG. )"
                align="right"
              />
              <StatCard
                title="WEIGHT OUT"
                value={fmtKg(kgs.outSum)}
                height={156}
                hint="( KG. )"
                align="right"
              />
              <StatCard
                title="NET WEIGHT"
                value={fmtKg(kgs.net)}
                hint="( KG. )"
                highlight
                highlightVariant="neutral"
                height={156}
                align="right"
              />
            </Grid>
          </Grid>

          {/* Quality Input */}
          <Grid size={{ xs: 12 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography
                variant="subtitle2"
                sx={{ opacity: 0.7 }}
                gutterBottom
              >
                Quality Input
              </Typography>

              <Grid
                container
                columns={{ xs: 12, md: 14 }}
                spacing={1}
                alignItems="center"
              >
                {/* Moisture */}
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    label="Moisture"
                    variant="outlined"
                    size="small"
                    fullWidth
                    type="number"
                    inputProps={{ step: "0.01", min: 0, max: 100 }}
                    value={formQuality.moisture ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const v = raw === "" ? null : clampPct(raw);
                      setFormQuality((prev) => ({
                        ...prev,
                        moisture: v,
                      }));
                    }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">%</InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                {/* Avg.%CP (readonly + calculated, 2 ตำแหน่ง) */}
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    label="Avg.%CP"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={cpAvgDisplay}
                    InputProps={{
                      readOnly: true,
                      endAdornment: (
                        <InputAdornment position="end">%</InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                {/* DRCs */}
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    label="DRC Est."
                    variant="outlined"
                    size="small"
                    fullWidth
                    type="number"
                    inputProps={{ step: "0.01", min: 0, max: 100 }}
                    value={formQuality.drcEstimate ?? ""}
                    onChange={(e) => {
                      const v =
                        e.target.value === "" ? null : clampPct(e.target.value);
                      setFormQuality((p) => ({ ...p, drcEstimate: v }));
                    }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">%</InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    label="DRC Req."
                    variant="outlined"
                    size="small"
                    fullWidth
                    type="number"
                    inputProps={{ step: "0.01", min: 0, max: 100 }}
                    value={formQuality.drcRequested ?? ""}
                    onChange={(e) => {
                      const v =
                        e.target.value === "" ? null : clampPct(e.target.value);
                      setFormQuality((p) => ({ ...p, drcRequested: v }));
                    }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">%</InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    label="DRC Act."
                    variant="outlined"
                    size="small"
                    fullWidth
                    type="number"
                    inputProps={{ step: "0.01", min: 0, max: 100 }}
                    value={formQuality.drcActual ?? ""}
                    onChange={(e) => {
                      const v =
                        e.target.value === "" ? null : clampPct(e.target.value);
                      setFormQuality((p) => ({ ...p, drcActual: v }));
                    }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">%</InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                {/* Grade (string) */}
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    label="Grade"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={formQuality.grade}
                    onChange={(e) =>
                      setFormQuality((p) => ({ ...p, grade: e.target.value }))
                    }
                    placeholder="เช่น A / B / MIX"
                  />
                </Grid>

                {/* ปุ่มยืนยัน */}
                <Grid
                  size={{ xs: 12, md: 2 }}
                  display="flex"
                  justifyContent={{ xs: "flex-end", md: "flex-end" }}
                >
                  <Button
                    variant="contained"
                    startIcon={<ActionIcon />}
                    disabled={savingQuality}
                    onClick={() => setConfirmOpen(true)}
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    {savingQuality
                      ? hasExistingQuality
                        ? "Updating..."
                        : "Saving..."
                      : actionLabel}
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </Section>

      {/* ===== Saved list (entries) ===== */}
      <Section
        title={
          <Typography variant="subtitle1" fontWeight={700}>
            รายการที่บันทึกแล้ว
          </Typography>
        }
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>No</TableCell>
              <TableCell>Before Press</TableCell>
              <TableCell>Basket</TableCell>
              <TableCell>Cuplump</TableCell>
              <TableCell>After Press</TableCell>
              <TableCell>%CP</TableCell>
              <TableCell>Before Baking 1</TableCell>
              <TableCell>Before Baking 2</TableCell>
              <TableCell>Before Baking 3</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loadingEntries ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  กำลังโหลด…
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ opacity: 0.7 }}>
                  ยังไม่มีประวัติการบันทึก
                </TableCell>
              </TableRow>
            ) : (
              entries.map((r: any, idx: number) => (
                <TableRow key={r.id || idx}>
                  <TableCell>{r.no ?? idx + 1}</TableCell>
                  <TableCell>{r.beforePress ?? "-"}</TableCell>
                  <TableCell>{r.basket ?? "-"}</TableCell>
                  <TableCell>
                    {(() => {
                      const bp = toNum(r.beforePress);
                      const bk = toNum(r.basket);
                      if (bp == null || bk == null) return "-";
                      return (bp - bk).toFixed(2); // 2 ตำแหน่ง
                    })()}
                  </TableCell>
                  <TableCell>{r.afterPress ?? "-"}</TableCell>
                  <TableCell>
                    {r.cp == null
                      ? "-"
                      : Number(r.cp).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                          useGrouping: false,
                        })}
                  </TableCell>
                  <TableCell>{fmtFixed(r.beforeBaking1, 3)}</TableCell>
                  <TableCell>{fmtFixed(r.beforeBaking2, 3)}</TableCell>
                  <TableCell>{fmtFixed(r.beforeBaking3, 3)}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => openEdit(r)}
                      aria-label="edit"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => openDelete(r)}
                      aria-label="delete"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Section>

      {/* ===== Add form ===== */}
      <Section
        title={
          <Typography variant="subtitle1" fontWeight={700}>
            เพิ่มรายการรับเศษยาง
          </Typography>
        }
        dense
      >
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              label="Before Press"
              variant="outlined"
              size="small"
              fullWidth
              value={entryForm.beforePress}
              onChange={(e) =>
                setEntryForm((p) => ({ ...p, beforePress: e.target.value }))
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              label="Basket"
              variant="outlined"
              size="small"
              fullWidth
              value={entryForm.basket}
              onChange={(e) =>
                setEntryForm((p) => ({ ...p, basket: e.target.value }))
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              label="Cuplump (คำนวณอัตโนมัติ)"
              variant="outlined"
              size="small"
              fullWidth
              value={entryForm.cuplump}
              InputProps={{ readOnly: true }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              label="After Press"
              variant="outlined"
              size="small"
              fullWidth
              value={entryForm.afterPress}
              onChange={(e) =>
                setEntryForm((p) => ({ ...p, afterPress: e.target.value }))
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              label="%CP"
              variant="outlined"
              size="small"
              fullWidth
              type="number"
              inputProps={{ step: "0.01", min: 0, max: 100 }}
              value={entryForm.cp ?? ""}
              onChange={(e) =>
                setEntryForm((p) => ({
                  ...p,
                  cp: e.target.value === "" ? null : clampPct(e.target.value),
                }))
              }
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
            />
          </Grid>

          {/* --- FORCE LINE BREAK AFTER %CP --- */}
          <Grid size={{ xs: 12, md: 12 }} />

          {/* Baking 1-3 on new line */}
          <Grid size={{ xs: 12, sm: 4, md: 2 }}>
            <TextField
              label="Before Baking 1"
              variant="outlined"
              size="small"
              fullWidth
              value={entryForm.beforeBaking1}
              onChange={(e) =>
                setEntryForm((p) => ({ ...p, beforeBaking1: e.target.value }))
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 2 }}>
            <TextField
              label="Before Baking 2"
              variant="outlined"
              size="small"
              fullWidth
              value={entryForm.beforeBaking2}
              onChange={(e) =>
                setEntryForm((p) => ({ ...p, beforeBaking2: e.target.value }))
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 2 }}>
            <TextField
              label="Before Baking 3"
              variant="outlined"
              size="small"
              fullWidth
              value={entryForm.beforeBaking3}
              onChange={(e) =>
                setEntryForm((p) => ({ ...p, beforeBaking3: e.target.value }))
              }
            />
          </Grid>

          {/* หมายเหตุ + ปุ่มบันทึก */}
          <Grid size={{ xs: 12, md: 10 }}>
            <TextField
              label="หมายเหตุ"
              variant="outlined"
              size="small"
              fullWidth
              value={entryForm.note}
              onChange={(e) =>
                setEntryForm((p) => ({ ...p, note: e.target.value }))
              }
            />
          </Grid>
          <Grid
            size={{ xs: 12, md: 2 }}
            display="flex"
            alignItems="center"
            justifyContent={{ xs: "stretch", md: "flex-end" }}
          >
            <Button
              fullWidth={false}
              variant="contained"
              startIcon={<SaveIcon />}
              sx={{ mt: { xs: 2, md: 0 } }}
              disabled={!resolvedBookingId || savingEntry}
              onClick={() => setConfirmAddOpen(true)}
            >
              {savingEntry ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </Grid>
        </Grid>
      </Section>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>

      {/* Confirm Dialog (คุณภาพ) */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {hasExistingQuality ? "ยืนยันการแก้ไข" : "ยืนยันการบันทึก"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {hasExistingQuality
              ? "คุณต้องการอัปเดตข้อมูลคุณภาพใช่หรือไม่?"
              : "คุณต้องการบันทึกข้อมูลคุณภาพใช่หรือไม่?"}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} color="inherit">
            ยกเลิก
          </Button>
          <Button
            onClick={handleConfirmSaveQuality}
            variant="contained"
            disabled={savingQuality}
          >
            {savingQuality ? "กำลังยืนยัน..." : "ยืนยัน"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Dialog (CL Lot Number) */}
      <Dialog
        open={confirmLotOpen}
        onClose={() => setConfirmLotOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {hasLotSaved
            ? "ยืนยันการแก้ไข Lot Number"
            : "ยืนยันการบันทึก Lot Number"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {hasLotSaved
              ? `ต้องการอัปเดต Lot Number เป็น "${data?.lotNumber ?? ""}" ใช่หรือไม่?`
              : `ต้องการบันทึก Lot Number เป็น "${data?.lotNumber ?? ""}" ใช่หรือไม่?`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmLotOpen(false)} color="inherit">
            ยกเลิก
          </Button>
          <Button
            onClick={handleConfirmSaveLot}
            startIcon={<SaveIcon />}
            variant="contained"
            disabled={savingLot}
          >
            {savingLot ? "กำลังบันทึก..." : "ยืนยัน"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Dialog (เพิ่มรายการรับเศษยาง) */}
      <Dialog
        open={confirmAddOpen}
        onClose={() => setConfirmAddOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>ยืนยันการบันทึกรายการ</DialogTitle>
        <DialogContent>
          <DialogContentText>
            คุณต้องการบันทึกรายการรับเศษยางนี้ใช่หรือไม่?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAddOpen(false)} color="inherit">
            ยกเลิก
          </Button>
          <Button
            onClick={doAddEntry}
            startIcon={<CheckIcon />}
            variant="contained"
            disabled={savingEntry}
          >
            {savingEntry ? "กำลังบันทึก..." : "ยืนยัน"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>แก้ไขรายการ No. {editTarget?.no ?? "-"}</DialogTitle>
        <DialogContent dividers>
          {editTarget && (
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              {[
                { k: "beforePress", label: "Before Press" },
                { k: "basket", label: "Basket" },
              ].map((f) => (
                <Grid key={f.k} size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    label={f.label}
                    size="small"
                    fullWidth
                    value={editTarget[f.k] ?? ""}
                    onChange={(e) =>
                      setEditTarget((p: any) => ({
                        ...p,
                        [f.k]: e.target.value,
                        cuplump:
                          f.k === "beforePress" || f.k === "basket"
                            ? (() => {
                                const bp =
                                  f.k === "beforePress"
                                    ? toNum(e.target.value)
                                    : toNum(p.beforePress);
                                const bk =
                                  f.k === "basket"
                                    ? toNum(e.target.value)
                                    : toNum(p.basket);
                                return bp == null || bk == null
                                  ? ""
                                  : (bp - bk).toFixed(2); // 2 ตำแหน่ง
                              })()
                            : p.cuplump,
                      }))
                    }
                  />
                </Grid>
              ))}
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  label="Cuplump (BP - Basket)"
                  size="small"
                  fullWidth
                  value={editTarget.cuplump ?? ""}
                  InputProps={{ readOnly: true }}
                  helperText="คำนวณอัตโนมัติ"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  label="After Press"
                  size="small"
                  fullWidth
                  value={editTarget.afterPress ?? ""}
                  onChange={(e) =>
                    setEditTarget((p: any) => ({
                      ...p,
                      afterPress: e.target.value,
                    }))
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  label="%CP"
                  size="small"
                  fullWidth
                  type="number"
                  inputProps={{ step: "0.01", min: 0, max: 100 }}
                  value={editTarget.cp ?? ""}
                  onChange={(e) =>
                    setEditTarget((p: any) => ({
                      ...p,
                      cp:
                        e.target.value === "" ? null : clampPct(e.target.value),
                    }))
                  }
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">%</InputAdornment>
                    ),
                  }}
                />
              </Grid>
              {[
                { k: "beforeBaking1", label: "Before Baking 1" },
                { k: "beforeBaking2", label: "Before Baking 2" },
                { k: "beforeBaking3", label: "Before Baking 3" },
              ].map((f) => (
                <Grid key={f.k} size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    label={f.label}
                    size="small"
                    fullWidth
                    value={editTarget[f.k] ?? ""}
                    onChange={(e) =>
                      setEditTarget((p: any) => ({
                        ...p,
                        [f.k]: e.target.value,
                      }))
                    }
                  />
                </Grid>
              ))}
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="หมายเหตุ"
                  size="small"
                  fullWidth
                  value={editTarget.note ?? ""}
                  onChange={(e) =>
                    setEditTarget((p: any) => ({ ...p, note: e.target.value }))
                  }
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} color="inherit">
            ยกเลิก
          </Button>
          <Button
            onClick={doSaveEdit}
            variant="contained"
            disabled={editSaving}
          >
            {editSaving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>ยืนยันการลบ</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ต้องการลบรายการ No. {deleteTarget?.no ?? "-"} ใช่หรือไม่?
            การลบไม่สามารถย้อนกลับได้
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} color="inherit">
            ยกเลิก
          </Button>
          <Button
            onClick={doDelete}
            color="error"
            variant="contained"
            disabled={deleteSaving}
            startIcon={<DeleteIcon />}
          >
            {deleteSaving ? "กำลังลบ..." : "ลบ"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
