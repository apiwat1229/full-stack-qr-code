// src/app/(control-panel)/dashboard/received-rubber/page.tsx
"use client";

import dayjs, { Dayjs } from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
dayjs.extend(isoWeek);

import { motion } from "motion/react";
import * as React from "react";

import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import {
  Alert,
  Box,
  Chip,
  Divider,
  FormControl,
  FormLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

import type { ApexOptions } from "apexcharts";
import ReactApexChart from "react-apexcharts";

import FuseLoading from "@fuse/core/FuseLoading";
import FusePageSimple from "@fuse/core/FusePageSimple";

/* ================= CONFIG ================= */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "") || "";
const api = (p: string) => `${API_BASE}${p.startsWith("/") ? p : `/${p}`}`;
const EVENTS_API = (dateISO: string) =>
  api(`/api/bookings/events?date=${encodeURIComponent(dateISO)}`);

/* ===== สีโทนสดใส (ปรับได้ง่าย) ===== */
const VIBRANT_PALETTE = [
  "#00C853",
  "#2979FF",
  "#FF6D00",
  "#AA00FF",
  "#00B8D4",
  "#C51162",
  "#FFD600",
  "#64DD17",
  "#2962FF",
  "#00E5FF",
  "#FF1744",
  "#00E676",
];
const NAMED_COLORS: Record<string, string> = {
  "regular cl": "#2979FF",
  "fsc cl": "#00C853",
  "eudr cl": "#FF6D00",
  "fsc uss": "#64DD17",
  "eudr uss": "#AA00FF",
  uss: "#00B8D4",
  "cup lump": "#FF1744",
};
const colorForType = (name: string) => {
  const key = (name || "").trim().toLowerCase();
  if (NAMED_COLORS[key]) return NAMED_COLORS[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return VIBRANT_PALETTE[h % VIBRANT_PALETTE.length];
};

/* ===== Provinces & helpers (สำหรับ Rubber Source) ===== */
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
/** ดึงรหัสจังหวัดจากค่ารูปแบบต่าง ๆ */
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

/* =============== Types & utils =============== */
type BookingRow = {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  bookingCode: string;
  sequence?: number | null;
  supCode: string;
  supplierName: string;
  truckRegister: string;
  truckType?: string;
  rubberTypeName?: string;
  checkInTime?: string | null;

  // weights
  weightIn?: number | null;
  weightInHead?: number | null;
  weightInTrailer?: number | null;
  weightOut?: number | null;
  weightOutHead?: number | null;
  weightOutTrailer?: number | null;

  // ✅ Rubber Source
  rubberSourceProvince?: number | null;
  rubberSourceText?: string | null;
};
type RangeTab = 0 | 1 | 2;

const HOUR_CHOICES = Array.from(
  { length: 24 },
  (_, h) => `${String(h).padStart(2, "0")}:00`
);
const fmtNum = (n?: number | null) => (n == null ? "-" : n.toLocaleString());
const supplierText = (r: BookingRow) =>
  [r.supCode || "-", r.supplierName || ""].filter(Boolean).join(" : ");

/** map event → BookingRow (รองรับ Rubber Source หลายคีย์) */
function normalizeFromEvent(raw: any): BookingRow {
  const xp = raw?.extendedProps ?? {};

  // ลองหยิบ code จากหลายชื่อคีย์
  const provinceCodeFromAny =
    pickProvinceCode(
      xp.rubber_source_province ??
        xp.rubberSourceProvince ??
        xp.sourceProvince ??
        xp.source_province ??
        xp.province ??
        xp.provinceCode ??
        xp.rubber_source // บางระบบอาจยัด code/string ไว้ตรงนี้
    ) ?? null;

  // ถ้ามี code → ชื่อจาก TH_PROVINCES, ไม่มีก็ลองเอาชื่อ string ตรง ๆ
  const rubberSourceTextGuess =
    provinceName(provinceCodeFromAny) ||
    xp.rubber_source_name ||
    xp.sourceProvinceName ||
    xp.rubber_source ||
    null;

  return {
    id: String(raw?.id ?? raw?._id ?? xp.booking_code ?? ""),
    date: String(raw?.start ?? "").slice(0, 10),
    startTime: dayjs(raw?.start).format("HH:mm"),
    endTime: raw?.end ? dayjs(raw?.end).format("HH:mm") : "",
    bookingCode: xp.booking_code ?? "",
    sequence:
      Number(
        xp.sequence ??
          xp.queue ??
          raw?.sequence ??
          raw?.queue ??
          raw?.order ??
          NaN
      ) || null,
    supCode: xp.supplier_code ?? "-",
    supplierName: xp.supplier_name ?? "",
    truckRegister: xp.truck_register ?? "",
    truckType: xp.truck_type ?? xp.truck_type_name ?? "",
    rubberTypeName: xp.rubber_type_name ?? xp.rubber_type ?? "",
    checkInTime: xp.check_in_time ?? null,

    weightIn: xp.weight_in ?? null,
    weightInHead: xp.weight_in_head ?? null,
    weightInTrailer: xp.weight_in_trailer ?? null,

    weightOut: xp.weight_out ?? null,
    weightOutHead: xp.weight_out_head ?? null,
    weightOutTrailer: xp.weight_out_trailer ?? null,

    // ✅ Rubber Source
    rubberSourceProvince: provinceCodeFromAny,
    rubberSourceText: rubberSourceTextGuess,
  };
}

const isTrailer = (tt?: string) =>
  (tt || "").toLowerCase().includes("พ่วง") ||
  (tt || "").toLowerCase().includes("trailer");

const rowInSum = (r: BookingRow) =>
  isTrailer(r.truckType)
    ? (r.weightInHead ?? 0) + (r.weightInTrailer ?? 0)
    : (r.weightIn ?? 0);

const rowOutSum = (r: BookingRow) =>
  isTrailer(r.truckType)
    ? (r.weightOutHead ?? 0) + (r.weightOutTrailer ?? 0)
    : (r.weightOut ?? 0);

/** สำหรับกราฟ/สัดส่วน: มี Out ใช้ Out ไม่งั้นใช้ In */
const rowUseWeight = (r: BookingRow) => rowOutSum(r) || rowInSum(r) || 0;
/** Net แบบ |Out − In| */
const rowAbsNet = (r: BookingRow) =>
  Math.abs((rowOutSum(r) || 0) - (rowInSum(r) || 0));

/* ================= Page ================= */
export default function DashboardSummaryPage() {
  const theme = useTheme();

  // Tabs / Date range
  const [tab, setTab] = React.useState<RangeTab>(0);
  const todayRef = React.useRef(dayjs().startOf("day"));
  const [from, setFrom] = React.useState<Dayjs | null>(todayRef.current);
  const [to, setTo] = React.useState<Dayjs | null>(todayRef.current);

  const alignFromForTab = React.useCallback((base: Dayjs, which: RangeTab) => {
    if (which === 0) return base.startOf("day");
    if (which === 1) return base.startOf("isoWeek");
    return base.startOf("month");
  }, []);
  const computeTo = React.useCallback((baseFrom: Dayjs, which: RangeTab) => {
    if (which === 0) return baseFrom;
    if (which === 1) return baseFrom.add(6, "day");
    return baseFrom.endOf("month").startOf("day");
  }, []);

  // กลับมาแท็บ This Day ให้รีเซ็ตเป็นวันนี้อัตโนมัติ
  const onChangeTab = (_: any, v: RangeTab) => {
    setTab(v);
    const base =
      v === 0
        ? dayjs().startOf("day")
        : (from ?? todayRef.current).startOf("day");
    const nf = alignFromForTab(base, v);
    setFrom(nf);
    setTo(computeTo(nf, v));
  };

  const handleFromChange = React.useCallback(
    (v: Dayjs | null) => {
      if (!v) return setFrom(null);
      const f = alignFromForTab(v.startOf("day"), tab);
      setFrom(f);
      setTo(computeTo(f, tab));
    },
    [tab, alignFromForTab, computeTo]
  );
  const handleToChange = React.useCallback(
    (v: Dayjs | null) => {
      if (!v) return setTo(null);
      const t = v.startOf("day");
      setTo(from && t.isBefore(from, "day") ? from : t);
    },
    [from]
  );

  // Filters
  const [q, setQ] = React.useState("");
  const [hourStart, setHourStart] = React.useState("08:00");
  const [hourEnd, setHourEnd] = React.useState("20:00");

  // Data
  const [loading, setLoading] = React.useState(false);
  const [rows, setRows] = React.useState<BookingRow[]>([]);
  const [toast, setToast] = React.useState<{
    open: boolean;
    msg: string;
    sev: "success" | "error" | "info";
  }>({ open: false, msg: "", sev: "success" });

  // ===== KPIs =====
  const bookingsTotal = rows.length;
  const inProgress = rows.filter((r) => {
    const out = isTrailer(r.truckType)
      ? r.weightOutHead != null || r.weightOutTrailer != null
      : r.weightOut != null;
    return !!r.checkInTime && !out;
  }).length;

  // Fetch
  async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { cache: "no-store", ...init });
    const txt = await res.text().catch(() => "");
    if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
    return txt ? (JSON.parse(txt) as T) : ({} as T);
  }
  const loadRange = React.useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const start = from.startOf("day");
      const end = to.startOf("day");
      const days = end.diff(start, "day");
      const all: BookingRow[] = [];
      for (let i = 0; i <= days; i++) {
        const d = start.add(i, "day");
        const ev = await fetchJSON<any[]>(EVENTS_API(d.format("YYYY-MM-DD")));
        all.push(...(ev || []).map(normalizeFromEvent));
      }
      const term = q.trim().toLowerCase();
      setRows(
        term
          ? all.filter(
              (r) =>
                r.bookingCode?.toLowerCase().includes(term) ||
                r.supplierName?.toLowerCase().includes(term) ||
                r.supCode?.toLowerCase().includes(term) ||
                r.truckRegister?.toLowerCase().includes(term)
            )
          : all
      );
    } catch (e: any) {
      setRows([]);
      setToast({
        open: true,
        msg: e?.message || "โหลดข้อมูลไม่สำเร็จ",
        sev: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [from, to, q]);

  React.useEffect(() => {
    const t = setTimeout(loadRange, 120);
    return () => clearTimeout(t);
  }, [loadRange]);
  React.useEffect(() => {
    const t = setTimeout(loadRange, 10);
    return () => clearTimeout(t);
  }, [tab]); // ok

  /* ----------------- Aggregation (stacked) ----------------- */
  const hourLabels = React.useMemo(() => {
    const sH = parseInt(hourStart.slice(0, 2), 10);
    const eH = parseInt(hourEnd.slice(0, 2), 10);
    const list: string[] = [];
    for (let h = sH; h <= eH; h++)
      list.push(`${String(h).padStart(2, "0")}:00`);
    return list;
  }, [hourStart, hourEnd]);
  const weekLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayIndexMonSun = (d: Dayjs) => (d.day() === 0 ? 6 : d.day() - 1);
  const monthLabels = React.useMemo(() => {
    if (!from) return [];
    const s = from.startOf("month");
    const e = s.endOf("month");
    const n = e.diff(s, "day") + 1;
    return Array.from({ length: n }, (_, i) => String(i + 1));
  }, [from]);

  type Series = {
    name: string;
    data: number[];
    type?: "line";
    color?: string;
    showInLegend?: boolean;
  };
  const { chartLabels, seriesForChart } = React.useMemo(() => {
    const labels =
      tab === 0 ? hourLabels : tab === 1 ? weekLabels : monthLabels;
    const len = labels.length;

    const byType = new Map<string, number[]>();
    const ensure = (name: string) => {
      const k = (name || "—").trim();
      if (!byType.has(k)) byType.set(k, Array(len).fill(0));
      return byType.get(k)!;
    };

    for (const r of rows) {
      const name = (r.rubberTypeName || "—").trim();
      const w = rowUseWeight(r);
      if (w <= 0) continue;
      const cin = r.checkInTime ? dayjs(r.checkInTime) : null;
      if (!cin) continue;

      let idx = -1;
      if (tab === 0) {
        const hh = `${String(cin.hour()).padStart(2, "0")}:00`;
        idx = hourLabels.indexOf(hh);
      } else if (tab === 1) {
        idx = dayIndexMonSun(cin);
      } else {
        idx = cin.date() - 1;
      }
      if (idx < 0 || idx >= len) continue;
      ensure(name)[idx] += w;
    }

    const order = Array.from(byType.entries())
      .map(([name, data]) => ({ name, sum: data.reduce((s, v) => s + v, 0) }))
      .sort((a, b) => b.sum - a.sum)
      .map((x) => x.name);

    const stacked: Series[] = order.map((name) => ({
      name,
      data: byType.get(name)!,
    }));

    // รวมยอดต่อ bucket → ทำ label “ลอยเหนือแท่ง”
    const totals = Array(len).fill(0);
    for (let i = 0; i < len; i++) {
      let s = 0;
      order.forEach((name) => (s += byType.get(name)![i]));
      totals[i] = s;
    }
    const totalLabelSeries: Series = {
      name: "__totals__",
      type: "line",
      data: totals,
      color: "transparent",
      showInLegend: false,
    };

    return {
      chartLabels: labels,
      seriesForChart: [...stacked, totalLabelSeries],
    };
  }, [rows, tab, hourLabels, weekLabels, monthLabels]);

  /* ---------------- Chart options ---------------- */
  const totalLabelSeriesIndex = Math.max(0, seriesForChart.length - 1);

  const chartOptions: ApexOptions = React.useMemo(
    () => ({
      chart: {
        type: "bar",
        stacked: true,
        height: "100%",
        toolbar: { show: false },
        fontFamily: "inherit",
        foreColor: "inherit",
        animations: { enabled: true },
      },
      plotOptions: {
        bar: { columnWidth: tab === 0 ? "60%" : "55%" },
      },
      dataLabels: {
        enabled: true,
        enabledOnSeries: [totalLabelSeriesIndex],
        formatter: (val: number) => (val ? val.toLocaleString() : ""),
        offsetY: -22,
        style: { colors: [theme.palette.text.primary], fontWeight: "800" },
        background: { enabled: false },
      },
      stroke: { show: true, width: [0] },
      markers: { size: 0 },
      grid: { borderColor: theme.palette.divider },
      xaxis: {
        categories: chartLabels,
        axisBorder: { show: false },
        labels: { style: { colors: theme.palette.text.secondary } },
      },
      yaxis: {
        title: { text: "Total Net ( Kg )" },
        labels: { style: { colors: theme.palette.text.secondary } },
      },
      tooltip: {
        shared: true,
        intersect: false,
        theme: theme.palette.mode,
        y: { formatter: (v) => (v ? `${v.toLocaleString()} Kg.` : "0 Kg.") },
      },
      colors: seriesForChart.slice(0, -1).map((s) => colorForType(s.name)),
      legend: {
        show: true,
        formatter: (name) => (name === "__totals__" ? "" : name),
      },
    }),
    [theme, chartLabels, tab, seriesForChart, totalLabelSeriesIndex]
  );

  const headerRangeText =
    from && to
      ? `${from.format("DD-MMM-YYYY")} → ${to.format("DD-MMM-YYYY")}`
      : "";

  /* ===================== UI ===================== */
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <FusePageSimple
        header={
          <Box className="p-6">
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h5" fontWeight={800}>
                Summary of Received Cuplump
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <IconButton onClick={() => loadRange()} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Stack>
          </Box>
        }
        content={
          <Box className="p-6">
            {/* Filters */}
            <Paper
              variant="outlined"
              sx={{ p: 2, borderRadius: 1, mb: 2 }}
              component={motion.div}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.25}
                alignItems={{ xs: "stretch", md: "center" }}
              >
                <Tabs value={tab} onChange={onChangeTab} sx={{ minHeight: 36 }}>
                  <Tab label="This Day" value={0} />
                  <Tab label="This Week" value={1} />
                  <Tab label="This Month" value={2} />
                </Tabs>
                <Box sx={{ flexGrow: 1 }} />
                <FormControl sx={{ width: 180 }}>
                  <FormLabel>From</FormLabel>
                  <DatePicker
                    value={from}
                    onChange={handleFromChange}
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
                <FormControl sx={{ width: 180 }}>
                  <FormLabel>To</FormLabel>
                  <DatePicker
                    value={to}
                    onChange={handleToChange}
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
                <FormControl sx={{ minWidth: 260, flex: 1 }}>
                  <FormLabel>Search (Code / Supplier / Plate)</FormLabel>
                  <TextField
                    size="small"
                    placeholder="Ex: 2025082801 / 1กก-1234"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
                  />
                </FormControl>

                {tab === 0 && (
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Hour Range
                    </Typography>
                    <Select
                      size="small"
                      value={hourStart}
                      onChange={(e) => setHourStart(e.target.value)}
                    >
                      {HOUR_CHOICES.map((h) => (
                        <MenuItem key={h} value={h}>
                          {h}
                        </MenuItem>
                      ))}
                    </Select>
                    <Typography variant="body2" color="text.secondary">
                      to
                    </Typography>
                    <Select
                      size="small"
                      value={hourEnd}
                      onChange={(e) => setHourEnd(e.target.value)}
                    >
                      {HOUR_CHOICES.map((h) => (
                        <MenuItem key={h} value={h}>
                          {h}
                        </MenuItem>
                      ))}
                    </Select>
                  </Stack>
                )}
              </Stack>
            </Paper>

            {/* ====== KPI + Rubber Types (บนแถวเดียวกัน) ====== */}
            <div className="grid grid-cols-12 gap-3 mb-2">
              {/* KPI 1 */}
              <Paper
                className="col-span-12 sm:col-span-6 lg:col-span-2"
                variant="outlined"
                sx={{ p: 2, borderRadius: 1 }}
              >
                <Box className="px-1 py-6 flex flex-col items-center justify-center">
                  <Typography
                    className="text-5xl font-semibold"
                    color="secondary"
                  >
                    {bookingsTotal.toLocaleString()}
                  </Typography>
                  <Typography
                    className="mt-1 text-sm font-medium"
                    color="secondary"
                  >
                    Total Bookings
                  </Typography>
                </Box>
              </Paper>

              {/* KPI 2 */}
              <Paper
                className="col-span-12 sm:col-span-6 lg:col-span-2"
                variant="outlined"
                sx={{ p: 2, borderRadius: 1 }}
              >
                <Box className="px-1 py-6 flex flex-col items-center justify-center">
                  <Typography
                    className="text-5xl font-semibold"
                    color="primary"
                  >
                    {inProgress.toLocaleString()}
                  </Typography>
                  <Typography
                    className="mt-1 text-sm font-medium"
                    color="primary"
                  >
                    In Progress
                  </Typography>
                </Box>
              </Paper>

              {/* Rubber Types panel */}
              <Paper
                className="col-span-12 lg:col-span-8"
                variant="outlined"
                sx={{ p: 2, borderRadius: 1 }}
              >
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Rubber Types ( Weight & Share )
                </Typography>
                <Stack spacing={1.25}>
                  {(() => {
                    const byType = new Map<string, number>();
                    for (const r of rows) {
                      const name = (r.rubberTypeName || "—").trim();
                      const w = rowUseWeight(r);
                      if (w <= 0) continue;
                      byType.set(name, (byType.get(name) || 0) + w);
                    }
                    const list = Array.from(byType.entries())
                      .map(([name, weight]) => ({ name, weight }))
                      .sort((a, b) => b.weight - a.weight);
                    const total = list.reduce((s, x) => s + x.weight, 0);

                    return (
                      <>
                        {list.map((it) => {
                          const pct = total
                            ? Math.round((it.weight / total) * 100)
                            : 0;
                          const barColor = colorForType(it.name);
                          return (
                            <Box key={it.name}>
                              <Stack
                                direction="row"
                                alignItems="center"
                                spacing={1}
                                sx={{ mb: 0.5 }}
                              >
                                <Chip
                                  size="small"
                                  label={it.name || "—"}
                                  sx={{
                                    bgcolor: barColor,
                                    color: "#fff",
                                    fontWeight: 700,
                                  }}
                                />
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {fmtNum(it.weight)} Kg.
                                </Typography>
                                <Box sx={{ flexGrow: 1 }} />
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {pct}%
                                </Typography>
                              </Stack>
                              <Box
                                sx={{
                                  height: 8,
                                  borderRadius: 5,
                                  bgcolor: "divider",
                                  overflow: "hidden",
                                }}
                              >
                                <Box
                                  sx={{
                                    width: `${pct}%`,
                                    height: "100%",
                                    bgcolor: barColor,
                                  }}
                                />
                              </Box>
                            </Box>
                          );
                        })}
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          sx={{ mt: 1 }}
                        >
                          <Typography variant="body2" fontWeight={700}>
                            Total
                          </Typography>
                          <Typography variant="body2" fontWeight={700}>
                            {fmtNum(total)} Kg.
                          </Typography>
                        </Stack>
                      </>
                    );
                  })()}
                </Stack>
              </Paper>
            </div>

            {/* ===== Bar chart ===== */}
            <Paper variant="outlined" sx={{ borderRadius: 1, p: 1, mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, px: 1.5, pt: 1 }}>
                {tab === 0
                  ? "Total Net Weight by hour"
                  : tab === 1
                    ? "Total Net Weight by day (Mon–Sun)"
                    : "Total Net Weight by day (Current Month)"}
              </Typography>
              {loading ? (
                <Box sx={{ height: 400 }}>
                  <FuseLoading />
                </Box>
              ) : (
                <ReactApexChart
                  options={chartOptions}
                  series={seriesForChart}
                  type="bar"
                  height={400}
                />
              )}
            </Paper>

            {/* ===== ตารางรายละเอียด ===== */}
            <Paper
              sx={{ p: 2, borderRadius: 1 }}
              variant="outlined"
              component={motion.div}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                Details (range {headerRangeText})
              </Typography>
              <TableContainer
                sx={{
                  borderRadius: 1,
                  border: (t) => `1px solid ${t.palette.divider}`,
                }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Supplier</TableCell>
                      <TableCell>License Plate</TableCell>
                      <TableCell>Truck Type</TableCell>
                      <TableCell>Rubber</TableCell>
                      {/* ✅ คอลัมน์ใหม่ */}
                      <TableCell>Rubber Source</TableCell>
                      <TableCell align="right">Weight In ( Kg. )</TableCell>
                      <TableCell align="right">Weight Out ( Kg. )</TableCell>
                      <TableCell align="right">Net Weight ( Kg. )</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={`sk-${i}`}>
                          <TableCell colSpan={9}>
                            <Skeleton height={24} />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center">
                          <Typography variant="body2" color="text.secondary">
                            ไม่มีข้อมูลในช่วงที่เลือก
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows
                        .slice()
                        .sort(
                          (a, b) =>
                            dayjs(a.date).valueOf() - dayjs(b.date).valueOf()
                        )
                        .map((r) => {
                          const trailer = isTrailer(r.truckType);
                          const inText = trailer
                            ? `${r.weightInHead != null ? r.weightInHead.toLocaleString() : "-"} / ${r.weightInTrailer != null ? r.weightInTrailer.toLocaleString() : "-"}`
                            : `${fmtNum(r.weightIn)}`;
                          const outText = trailer
                            ? `${r.weightOutHead != null ? r.weightOutHead.toLocaleString() : "-"} / ${r.weightOutTrailer != null ? r.weightOutTrailer.toLocaleString() : "-"}`
                            : `${fmtNum(r.weightOut)}`;
                          const net = rowAbsNet(r);

                          const rubberSourceDisplay =
                            provinceName(r.rubberSourceProvince ?? null) ||
                            r.rubberSourceText ||
                            "-";

                          return (
                            <TableRow key={r.id || r.bookingCode} hover>
                              <TableCell>
                                {dayjs(r.date).format("DD-MMM-YYYY")}
                              </TableCell>
                              <TableCell sx={{ maxWidth: 320 }}>
                                <Typography
                                  variant="body2"
                                  noWrap
                                  title={supplierText(r)}
                                >
                                  {supplierText(r)}
                                </Typography>
                              </TableCell>
                              <TableCell>{r.truckRegister || "-"}</TableCell>
                              <TableCell>{r.truckType || "-"}</TableCell>
                              <TableCell>
                                {r.rubberTypeName ? (
                                  <Chip
                                    size="small"
                                    label={r.rubberTypeName}
                                    sx={{
                                      bgcolor: colorForType(r.rubberTypeName),
                                      color: "#fff",
                                      fontWeight: 700,
                                    }}
                                  />
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              {/* ✅ แสดง Rubber Source */}
                              <TableCell>{rubberSourceDisplay}</TableCell>

                              <TableCell align="right">{inText}</TableCell>
                              <TableCell align="right">{outText}</TableCell>
                              <TableCell align="right">{fmtNum(net)}</TableCell>
                            </TableRow>
                          );
                        })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Divider sx={{ my: 1.5 }} />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  {rows.length.toLocaleString()} items
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sum Net: {fmtNum(rows.reduce((s, r) => s + rowAbsNet(r), 0))}{" "}
                  Kg.
                </Typography>
              </Stack>
            </Paper>

            {/* Toast */}
            <Snackbar
              open={toast.open}
              autoHideDuration={2600}
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
