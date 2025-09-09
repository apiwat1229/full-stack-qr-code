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
  FormControl,
  FormLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Tab,
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
const api = (path: string) =>
  `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
const EVENTS_API = (dateISO: string) =>
  api(`/api/bookings/events?date=${encodeURIComponent(dateISO)}`);

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

  weightIn?: number | null;
  weightInHead?: number | null;
  weightInTrailer?: number | null;

  weightOut?: number | null;
  weightOutHead?: number | null;
  weightOutTrailer?: number | null;
};

type RangeTab = 0 | 1 | 2; // 0: Day, 1: Week, 2: Month

const HOUR_CHOICES = Array.from(
  { length: 24 },
  (_, h) => `${String(h).padStart(2, "0")}:00`
);

const fmt = (n?: number | null) => (n == null ? "-" : n.toLocaleString());

function normalizeFromEvent(raw: any): BookingRow {
  const xp = raw?.extendedProps ?? {};
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
  };
}

const isTrailer = (tt?: string) =>
  (tt || "").toLowerCase().includes("พ่วง") ||
  (tt || "").toLowerCase().includes("trailer");

function rowInSum(r: BookingRow) {
  if (isTrailer(r.truckType))
    return (r.weightInHead ?? 0) + (r.weightInTrailer ?? 0);
  return r.weightIn ?? 0;
}
function rowOutSum(r: BookingRow) {
  if (isTrailer(r.truckType))
    return (r.weightOutHead ?? 0) + (r.weightOutTrailer ?? 0);
  return r.weightOut ?? 0;
}
function rowAbsNet(r: BookingRow) {
  const diff = Math.abs((rowOutSum(r) || 0) - (rowInSum(r) || 0));
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return diff;
}

/* ================= Page ================= */
export default function DashboardSummaryPage() {
  const theme = useTheme();

  // ---- Tabs / Range ----
  const [tab, setTab] = React.useState<RangeTab>(0); // Day
  const todayRef = React.useRef(dayjs().startOf("day"));

  // เริ่มต้น: วันนี้ → วันนี้
  const [from, setFrom] = React.useState<Dayjs | null>(todayRef.current);
  const [to, setTo] = React.useState<Dayjs | null>(todayRef.current);

  const alignFromForTab = React.useCallback((base: Dayjs, which: RangeTab) => {
    if (which === 0) return base.startOf("day");
    if (which === 1) return base.startOf("isoWeek"); // Monday
    return base.startOf("month");
  }, []);
  const computeTo = React.useCallback((baseFrom: Dayjs, which: RangeTab) => {
    if (which === 0) return baseFrom;
    if (which === 1) return baseFrom.add(6, "day");
    return baseFrom.endOf("month").startOf("day");
  }, []);

  // ✅ เปลี่ยนแท็บ: รีเซ็ตฐานเป็น "วันนี้" เสมอ แล้ว align ให้ตรงช่วง
  const onChangeTab = (_: React.SyntheticEvent, newValue: RangeTab) => {
    setTab(newValue);
    const base = todayRef.current; // ← ใช้วันนี้เป็นฐานทุกครั้ง
    const nf = alignFromForTab(base, newValue);
    const nt = computeTo(nf, newValue);
    setFrom(nf);
    setTo(nt);
  };

  // === handlers ที่ “ปิดลูป” ===
  const handleFromChange = React.useCallback(
    (v: Dayjs | null) => {
      if (!v) {
        setFrom(null);
        return;
      }
      const aligned = alignFromForTab(v.startOf("day"), tab);
      setFrom(aligned);
      setTo(computeTo(aligned, tab));
    },
    [tab, alignFromForTab, computeTo]
  );

  const handleToChange = React.useCallback(
    (v: Dayjs | null) => {
      if (!v) {
        setTo(null);
        return;
      }
      const next = v.startOf("day");
      setTo(from && next.isBefore(from, "day") ? from : next);
    },
    [from]
  );

  // ---- Filters ----
  const [q, setQ] = React.useState("");
  const [hourStart, setHourStart] = React.useState("08:00");
  const [hourEnd, setHourEnd] = React.useState("20:00");

  // ---- Data ----
  const [loading, setLoading] = React.useState(false);
  const [rows, setRows] = React.useState<BookingRow[]>([]);
  const [toast, setToast] = React.useState<{
    open: boolean;
    msg: string;
    sev: "success" | "error" | "info";
  }>({ open: false, msg: "", sev: "success" });

  const bookingsTotal = rows.length;
  const inProgress = rows.filter((r) => {
    const out = isTrailer(r.truckType)
      ? r.weightOutHead != null || r.weightOutTrailer != null
      : r.weightOut != null;
    return !!r.checkInTime && !out;
  }).length;

  /* ---------------- Load data for range ---------------- */
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
      const filtered = term
        ? all.filter(
            (r) =>
              r.bookingCode?.toLowerCase().includes(term) ||
              r.supplierName?.toLowerCase().includes(term) ||
              r.supCode?.toLowerCase().includes(term) ||
              r.truckRegister?.toLowerCase().includes(term)
          )
        : all;

      setRows(filtered);
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

  // โหลดเมื่อช่วง / คำค้น เปลี่ยน
  React.useEffect(() => {
    const t = setTimeout(loadRange, 120);
    return () => clearTimeout(t);
  }, [loadRange]);

  // ยิงโหลดทันทีเมื่อเปลี่ยนแท็บ
  React.useEffect(() => {
    const t = setTimeout(loadRange, 10);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  /* ---------------- Chart buckets ---------------- */
  const hourLabels = React.useMemo(() => {
    const sH = parseInt(hourStart.slice(0, 2), 10);
    const eH = parseInt(hourEnd.slice(0, 2), 10);
    const list: string[] = [];
    for (let h = sH; h <= eH; h++)
      list.push(`${String(h).padStart(2, "0")}:00`);
    return list;
  }, [hourStart, hourEnd]);

  const weekLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayIndexMonSun = (d: Dayjs) => {
    const js = d.day(); // 0=Sun
    return js === 0 ? 6 : js - 1;
  };

  const monthLabels = React.useMemo(() => {
    if (!from) return [];
    const start = from.startOf("month");
    const end = start.endOf("month");
    const days = end.diff(start, "day") + 1;
    return Array.from({ length: days }, (_, i) => String(i + 1));
  }, [from]);

  const { chartLabels, chartSeries } = React.useMemo(() => {
    if (tab === 0) {
      const vals = hourLabels.map(() => 0);
      for (const r of rows) {
        const cin = r.checkInTime ? dayjs(r.checkInTime) : null;
        if (!cin) continue;
        const hh = `${String(cin.hour()).padStart(2, "0")}:00`;
        const idx = hourLabels.indexOf(hh);
        if (idx >= 0) vals[idx] += rowAbsNet(r);
      }
      return {
        chartLabels: hourLabels,
        chartSeries: [{ name: "Net", data: vals }],
      };
    }
    if (tab === 1) {
      const vals = Array(7).fill(0);
      for (const r of rows) {
        const cin = r.checkInTime ? dayjs(r.checkInTime) : null;
        if (!cin) continue;
        const idx = dayIndexMonSun(cin);
        vals[idx] += rowAbsNet(r);
      }
      return {
        chartLabels: weekLabels,
        chartSeries: [{ name: "Net", data: vals }],
      };
    }
    const labels = monthLabels;
    const vals = labels.map(() => 0);
    for (const r of rows) {
      const cin = r.checkInTime ? dayjs(r.checkInTime) : null;
      if (!cin) continue;
      const idx = cin.date() - 1;
      if (idx >= 0 && idx < vals.length) vals[idx] += rowAbsNet(r);
    }
    return { chartLabels: labels, chartSeries: [{ name: "Net", data: vals }] };
  }, [tab, rows, hourLabels, weekLabels, monthLabels]);

  /* ---------------- Chart options (Bar) ---------------- */
  const chartOptions: ApexOptions = React.useMemo(
    () => ({
      chart: {
        type: "bar",
        height: "100%",
        toolbar: { show: false },
        fontFamily: "inherit",
        foreColor: "inherit",
        animations: { enabled: true },
      },
      plotOptions: {
        bar: {
          columnWidth: tab === 0 ? "55%" : "45%",
          dataLabels: { position: "top" },
        },
      },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => (val ? val.toLocaleString() : ""),
        offsetY: -34,
        style: { colors: [theme.palette.text.primary], fontWeight: "700" },
      },
      stroke: { show: false },
      grid: { borderColor: theme.palette.divider },
      xaxis: {
        categories: chartLabels,
        axisBorder: { show: false },
        labels: { style: { colors: theme.palette.text.secondary } },
      },
      yaxis: {
        title: { text: "Total Net (kg)" },
        labels: { style: { colors: theme.palette.text.secondary } },
      },
      tooltip: { theme: theme.palette.mode },
      colors: [theme.palette.grey[800]],
    }),
    [theme, chartLabels, tab]
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
                    placeholder="เช่น 2025082801 / สมหญิง / 1กก-1234"
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
              </Stack>
            </Paper>

            {/* Overview */}
            <Paper
              sx={{ p: 2.5, borderRadius: 1, mb: 2 }}
              variant="outlined"
              component={motion.div}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Typography className="font-medium" color="text.secondary">
                Overview • {headerRangeText}
              </Typography>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Box className="rounded-xl border px-1 py-8 flex flex-col items-center justify-center">
                  <Typography
                    className="text-5xl leading-none font-semibold tracking-tight"
                    color="secondary"
                  >
                    {bookingsTotal.toLocaleString()}
                  </Typography>
                  <Typography
                    className="mt-1 text-sm font-medium sm:text-lg"
                    color="secondary"
                  >
                    Bookings (Range)
                  </Typography>
                </Box>

                <Box className="rounded-xl border px-1 py-8 flex flex-col items-center justify-center">
                  <Typography
                    className="text-5xl leading-none font-semibold tracking-tight"
                    color="primary"
                  >
                    {inProgress.toLocaleString()}
                  </Typography>
                  <Typography
                    className="mt-1 text-sm font-medium sm:text-lg"
                    color="primary"
                  >
                    In Progress
                  </Typography>
                </Box>
              </div>
            </Paper>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              <div>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mb: 1 }}
                >
                  <Typography variant="subtitle2">
                    {tab === 0
                      ? "Total Net by hour (abs(Out − In))"
                      : tab === 1
                        ? "Total Net by day (Mon–Sun)"
                        : "Total Net by day (this month)"}
                  </Typography>

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

                <Paper variant="outlined" sx={{ borderRadius: 1, p: 1 }}>
                  {loading ? (
                    <Box sx={{ height: 320 }}>
                      <FuseLoading />
                    </Box>
                  ) : (
                    <ReactApexChart
                      options={chartOptions}
                      series={chartSeries}
                      type="bar"
                      height={320}
                    />
                  )}
                </Paper>
              </div>

              <div>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Rubber Types (weight & share)
                </Typography>
                <Paper variant="outlined" sx={{ borderRadius: 1, p: 2 }}>
                  <Stack spacing={1.25}>
                    {(() => {
                      const byType = new Map<string, number>();
                      for (const r of rows) {
                        const name = (r.rubberTypeName || "—").trim();
                        const w = rowOutSum(r) || rowInSum(r) || 0;
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
                                      bgcolor:
                                        it.name.toLowerCase().includes("fsc") ||
                                        it.name.toLowerCase().includes("cl")
                                          ? "#1b5e20"
                                          : "#263238",
                                      color: "#fff",
                                      fontWeight: 700,
                                    }}
                                  />
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    {fmt(it.weight)} kg
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
                                      bgcolor: "text.primary",
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
                              {fmt(total)} kg
                            </Typography>
                          </Stack>
                        </>
                      );
                    })()}
                  </Stack>
                </Paper>
              </div>
            </div>

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
