// src/app/(control-panel)/cuplump-received/[id]/page.tsx
"use client";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";

import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
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
const LOOKUP_API = (code: string) =>
  `${API_BASE}/bookings/lookup?booking_code=${encodeURIComponent(code)}`;

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

// Quality
async function trySaveQuality(
  id: string,
  payload: {
    moisture?: number;
    cpAvg?: number;
    drcEstimate?: number;
    drcRequested?: number;
    drcActual?: number;
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
  return fetchJSON<any>(QUALITY_API(id), { method: "GET" });
}

// Entries
async function fetchEntries(id: string) {
  const r = await fetchJSON<{ items?: any[]; count?: number }>(
    ENTRIES_API(id),
    {
      method: "GET",
    }
  );
  return Array.isArray(r?.items) ? r.items : [];
}
async function createEntry(id: string, payload: any) {
  // API ต้องการ snake_case
  return fetchJSON<any>(ENTRIES_API(id), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ===== small helpers ===== */
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

  // --- form state for Quality inputs ---
  const FIELDS = [
    "moisture",
    "cpAvg",
    "drcEstimate",
    "drcRequested",
    "drcActual",
  ] as const;
  type FieldKey = (typeof FIELDS)[number];

  const [formQuality, setFormQuality] = React.useState<
    Record<FieldKey, number | null>
  >({
    moisture: null,
    cpAvg: null,
    drcEstimate: null,
    drcRequested: null,
    drcActual: null,
  });

  // --- form state for Cuplump Entries ---
  const [entryForm, setEntryForm] = React.useState<{
    beforePress: string;
    basket: string;
    cuplump: string;
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

  // มีข้อมูลเดิมจาก backend แล้วหรือยัง → ใช้ค่านี้กำหนดปุ่ม Edit/Save
  const hasExistingQuality = React.useMemo(() => {
    const q = quality || {};
    return [
      "moisture",
      "cpAvg",
      "drcEstimate",
      "drcRequested",
      "drcActual",
    ].some((k) => (q as any)?.[k] != null);
  }, [quality]);
  const actionLabel = hasExistingQuality ? "Edit" : "Save";
  const ActionIcon = hasExistingQuality ? EditIcon : SaveIcon;

  // Snackbar + Confirm dialog
  type SnackSeverity = "success" | "error" | "info" | "warning";
  const [snack, setSnack] = React.useState<{
    open: boolean;
    msg: string;
    severity: SnackSeverity;
  }>({ open: false, msg: "", severity: "success" });
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const showSnack = (msg: string, severity: SnackSeverity = "success") =>
    setSnack({ open: true, msg, severity });

  // เมื่อกด "ยืนยัน" ใน Dialog (บันทึกคุณภาพ)
  const handleConfirmSave = async () => {
    try {
      setSavingQuality(true);

      const payload: any = {
        moisture: clampPct(formQuality.moisture) ?? undefined,
        cpAvg: clampPct(formQuality.cpAvg) ?? undefined,
        drcEstimate: clampPct(formQuality.drcEstimate) ?? undefined,
        drcRequested: clampPct(formQuality.drcRequested) ?? undefined,
        drcActual: clampPct(formQuality.drcActual) ?? undefined,
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

      const nextForm: Record<FieldKey, number | null> = {
        moisture: resp?.moisture ?? formQuality.moisture,
        cpAvg: resp?.cpAvg ?? formQuality.cpAvg,
        drcEstimate: resp?.drcEstimate ?? formQuality.drcEstimate,
        drcRequested: resp?.drcRequested ?? formQuality.drcRequested,
        drcActual: resp?.drcActual ?? formQuality.drcActual,
      };
      setFormQuality(nextForm);
      writeCache(resolvedBookingId, nextForm);

      setQuality((prev: any) => ({
        ...(prev || {}),
        ...resp,
        updatedAt: new Date().toISOString(),
      }));

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

  /* ===== cache helpers ===== */
  const cacheKey = (id: string) => `quality_form_${id}`;
  const readCache = (id: string) => {
    try {
      const raw = localStorage.getItem(cacheKey(id));
      if (!raw) return null;
      const j = JSON.parse(raw);
      const obj: Record<FieldKey, number | null> = {
        moisture: j?.moisture ?? null,
        cpAvg: j?.cpAvg ?? null,
        drcEstimate: j?.drcEstimate ?? null,
        drcRequested: j?.drcRequested ?? null,
        drcActual: j?.drcActual ?? null,
      };
      return obj;
    } catch {
      return null;
    }
  };
  const writeCache = (id: string, val: Record<FieldKey, number | null>) => {
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
          // พ่วง (หัว/หาง)
          weightInHead = g.a ?? 0;
          weightInTrailer = g.b ?? 0;
          const netHead = n.a ?? 0;
          const netTrailer = n.b ?? 0;
          weightOutHead = (weightInHead ?? 0) - netHead;
          weightOutTrailer = (weightInTrailer ?? 0) - netTrailer;
          weightIn = (weightInHead ?? 0) + (weightInTrailer ?? 0);
          weightOut = (weightOutHead ?? 0) + (weightOutTrailer ?? 0);
        } else {
          // คันเดี่ยว
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
          lotNumber: p.lotNumber ?? "-",
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
      lotNumber: "-",
      rubberSourceProvince: null as number | null,
      rubberSourceHeadProvince: null as number | null,
      rubberSourceTrailerProvince: null as number | null,
      source: "-",
      moisture: null as number | null,
      cpAvg: null as number | null,
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
    };

    const merged = { ...fallback, ...fromSP, ...fromSS };
    if (merged.cpAvg == null && (merged as any).cpPercent != null) {
      merged.cpAvg = (merged as any).cpPercent;
    }
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

  // โหลด quality ครั้งแรก
  React.useEffect(() => {
    if (!resolvedBookingId) {
      setQuality(null);
      return;
    }
    (async () => {
      try {
        setLoadingQuality(true);
        const cached = readCache(resolvedBookingId);
        if (cached) setFormQuality(cached);

        const q = await fetchQuality(resolvedBookingId);
        setQuality(q || null);

        const filled: Record<FieldKey, number | null> = {
          moisture: q?.moisture ?? cached?.moisture ?? null,
          cpAvg: q?.cpAvg ?? cached?.cpAvg ?? null,
          drcEstimate: q?.drcEstimate ?? cached?.drcEstimate ?? null,
          drcRequested: q?.drcRequested ?? cached?.drcRequested ?? null,
          drcActual: q?.drcActual ?? cached?.drcActual ?? null,
        };
        setFormQuality(filled);
        writeCache(resolvedBookingId, filled);
      } catch (err) {
        // เงียบไว้ แต่ไม่ลบค่าที่มี
        console.warn("load quality error", err);
      } finally {
        setLoadingQuality(false);
      }
    })();
  }, [resolvedBookingId]);

  // ฟังก์ชันรีเฟรช entries พร้อม retry เบา ๆ 1 ครั้ง
  const refreshEntries = React.useCallback(async () => {
    if (!resolvedBookingId) return;
    setLoadingEntries(true);
    try {
      const items = await fetchEntries(resolvedBookingId);
      setEntries(items);
    } catch (e1) {
      // ลองอีกครั้งหลังดีเลย์สั้น ๆ (กันเคส token เพิ่งมา)
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

  // โหลด entries เมื่อมี bookingId แล้ว + เมื่อกลับมาโฟกัสหน้า
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

  // ========= handler บันทึก entry =========
  const handleSaveEntry = async () => {
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

    // payload เป็น snake_case ตามตัวอย่าง curl
    const payload = {
      before_press: toNum(entryForm.beforePress),
      basket: toNum(entryForm.basket),
      cuplump: toNum(entryForm.cuplump),
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
      await refreshEntries(); // รีเฟรชจากเซิร์ฟเวอร์ทุกครั้งหลังบันทึก

      // ล้างฟอร์ม
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
    }
  };

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
            <Stack direction="row" spacing={1}>
              <Chip
                label={`BookingCode: ${data?.bookingCode || "-"}`}
                variant="outlined"
              />
              <Chip
                label={`ResolvedId: ${resolvedBookingId || "-"}`}
                variant="outlined"
              />
            </Stack>
            <TextField
              label="Create Lot Number"
              size="small"
              value={data.lotNumber ?? ""}
              onChange={(e) =>
                setData((prev: any) => ({ ...prev, lotNumber: e.target.value }))
              }
              sx={{ minWidth: 220 }}
            />
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
                title="WEIGHT IN (KG.)"
                value={fmtKg(data.weightIn)}
                height={156}
                align="right"
              />
              <StatCard
                title="WEIGHT OUT (KG.)"
                value={fmtKg(kgs.outSum)}
                height={156}
                align="right"
              />
              <StatCard
                title="NET WEIGHT (KG.)"
                value={fmtKg(kgs.net)}
                hint="Total In - Total Out"
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

              <Grid container spacing={2} alignItems="center">
                {[
                  { key: "moisture", label: "Moisture" },
                  { key: "cpAvg", label: "Avg.%CP" },
                  { key: "drcEstimate", label: "DRC Estimate" },
                  { key: "drcRequested", label: "DRC Requested" },
                  { key: "drcActual", label: "DRC Actual" },
                ].map((f) => (
                  <Grid key={f.key} size={{ xs: 12, sm: 6, md: 2 }}>
                    <TextField
                      label={f.label}
                      variant="outlined"
                      size="small"
                      fullWidth
                      type="number"
                      inputProps={{ step: "0.01", min: 0, max: 100 }}
                      value={formQuality[f.key as FieldKey] ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const v = raw === "" ? null : clampPct(raw);
                        setFormQuality((prev) => ({
                          ...prev,
                          [f.key as FieldKey]: v,
                        }));
                      }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">%</InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                ))}

                <Grid
                  size={{ xs: 12, sm: 6, md: 2 }}
                  display="flex"
                  justifyContent="flex-end"
                >
                  <Button
                    variant="contained"
                    startIcon={<ActionIcon />}
                    disabled={savingQuality}
                    onClick={() => setConfirmOpen(true)}
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
            </TableRow>
          </TableHead>
          <TableBody>
            {loadingEntries ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  กำลังโหลด…
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ opacity: 0.7 }}>
                  ยังไม่มีประวัติการบันทึก
                </TableCell>
              </TableRow>
            ) : (
              entries.map((r: any, idx: number) => (
                <TableRow key={r.id || idx}>
                  <TableCell>{r.no ?? idx + 1}</TableCell>
                  <TableCell>{r.beforePress ?? "-"}</TableCell>
                  <TableCell>{r.basket ?? "-"}</TableCell>
                  <TableCell>{r.cuplump ?? "-"}</TableCell>
                  <TableCell>{r.afterPress ?? "-"}</TableCell>
                  <TableCell>{r.cp ?? "-"}</TableCell>
                  <TableCell>{r.beforeBaking1 ?? "-"}</TableCell>
                  <TableCell>{r.beforeBaking2 ?? "-"}</TableCell>
                  <TableCell>{r.beforeBaking3 ?? "-"}</TableCell>
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
              label="Cuplump"
              variant="outlined"
              size="small"
              fullWidth
              value={entryForm.cuplump}
              onChange={(e) =>
                setEntryForm((p) => ({ ...p, cuplump: e.target.value }))
              }
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
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
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
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
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
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
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
          <Grid size={{ xs: 12 }}>
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
        </Grid>

        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          sx={{ mt: 2 }}
          disabled={!resolvedBookingId || savingEntry}
          onClick={handleSaveEntry}
        >
          {savingEntry ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
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

      {/* Confirm Dialog (สำหรับบันทึกคุณภาพ) */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        aria-labelledby="confirm-save-title"
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id="confirm-save-title">
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
            onClick={handleConfirmSave}
            variant="contained"
            disabled={savingQuality}
          >
            {savingQuality ? "กำลังยืนยัน..." : "ยืนยัน"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
