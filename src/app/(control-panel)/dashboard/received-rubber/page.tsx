// src/app/(control-panel)/dashboard/received-rubber/page.tsx

"use client";

import dayjs, { Dayjs } from "dayjs";
import _ from "lodash";
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
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
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

/* ================= UI const ================= */
const RADIUS = 1;
const FIELD_PROPS = { size: "small", variant: "outlined" } as const;
const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: 1 } };

// ค่า default ของกราฟ (แก้ได้จาก selector ข้างหัวกราฟ)
const DEF_H_START = 8;
const DEF_H_END = 20;

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

  // weights
  weightIn?: number | null;
  weightInHead?: number | null;
  weightInTrailer?: number | null;
  weightOut?: number | null;
  weightOutHead?: number | null;
  weightOutTrailer?: number | null;
};

type TabKey = 0 | 1 | 2; // 0: Day, 1: Week, 2: Month/Range

type Summary = {
  totalBookings: number; // ทั้งหมดของช่วง
  inProgress: number; // เช็คอินแล้วแต่ยังไม่ออก
};

/* ===== Helpers ===== */
const fmtKg = (n?: number | null) => (n == null ? "-" : n.toLocaleString());
const isTrailer = (truckType?: string) =>
  (truckType || "").toLowerCase().includes("พ่วง") ||
  (truckType || "").toLowerCase().includes("trailer");

const showIn = (r: BookingView) =>
  isTrailer(r.truckType)
    ? `${fmtKg(r.weightInHead)} / ${fmtKg(r.weightInTrailer)}`
    : fmtKg(r.weightIn);

const showOut = (r: BookingView) =>
  isTrailer(r.truckType)
    ? `${fmtKg(r.weightOutHead)} / ${fmtKg(r.weightOutTrailer)}`
    : fmtKg(r.weightOut);

// Net จริง (อาจติดลบ) และ Net สำหรับแสดง (abs)
const calcNetRaw = (r: BookingView): number | null => {
  if (isTrailer(r.truckType)) {
    const inSum = (r.weightInHead ?? 0) + (r.weightInTrailer ?? 0) || null;
    const outSum = (r.weightOutHead ?? 0) + (r.weightOutTrailer ?? 0) || null;
    if (outSum == null) return null; // ยังไม่ออก
    return (outSum ?? 0) - (inSum ?? 0);
  }
  if (r.weightOut == null) return null;
  return (r.weightOut ?? 0) - (r.weightIn ?? 0);
};
const calcNetShown = (r: BookingView): number | null => {
  const v = calcNetRaw(r);
  return v == null ? null : Math.abs(v);
};

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
  });
  const txt = await res.text().catch(() => "");
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
  return txt ? (JSON.parse(txt) as T) : ({} as T);
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
  return `${xp?.title ?? ""}${xp?.firstName ?? raw?.firstName ?? ""} ${xp?.lastName ?? raw?.lastName ?? ""}`.trim();
}

function normalizeFromEvent(raw: any): BookingView {
  const xp = raw?.extendedProps ?? {};
  return {
    id: String(raw?.id ?? raw?._id ?? raw?.id_str ?? xp.booking_code ?? ""),
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
    date: String(raw?.start).slice(0, 10),
    startTime: dayjs(raw?.start).format("HH:mm"),
    endTime: raw?.end ? dayjs(raw?.end).format("HH:mm") : "",
    supCode: xp.supplier_code ?? "-",
    supplierName: xp.supplier_name ?? joinSupplierName(xp, raw),
    truckRegister: xp.truck_register ?? "",
    truckType: xp.truck_type ?? xp.truck_type_name ?? "",
    rubberTypeName: xp.rubber_type_name ?? xp.rubber_type ?? "",
    recorder: xp.recorded_by ?? "",
    checkInTime: xp.check_in_time ?? null,

    // weights
    weightIn: xp.weight_in ?? null,
    weightInHead: xp.weight_in_head ?? null,
    weightInTrailer: xp.weight_in_trailer ?? null,
    weightOut: xp.weight_out ?? null,
    weightOutHead: xp.weight_out_head ?? null,
    weightOutTrailer: xp.weight_out_trailer ?? null,
  };
}

/* =============== Page =============== */
export default function CheckInHistoryPage() {
  const theme = useTheme();

  // Tabs & date range (ย้ายมาไว้ใน Overview แล้ว)
  const [tab, setTab] = React.useState<TabKey>(2); // เริ่มที่ Month/Range ตามภาพ
  const [dateFrom, setDateFrom] = React.useState<Dayjs | null>(
    dayjs().startOf("month")
  );
  const [dateTo, setDateTo] = React.useState<Dayjs | null>(
    dayjs().endOf("month")
  );

  // Search
  const [q, setQ] = React.useState("");

  // Chart hour-range (เฉพาะกราฟ)
  const [hStart, setHStart] = React.useState<number>(DEF_H_START);
  const [hEnd, setHEnd] = React.useState<number>(DEF_H_END);

  // Data (ตามช่วง)
  const [loading, setLoading] = React.useState(false);
  const [rowsAll, setRowsAll] = React.useState<BookingView[]>([]);
  const [rowsCheckedIn, setRowsCheckedIn] = React.useState<BookingView[]>([]);

  const [toast, setToast] = React.useState<{
    open: boolean;
    msg: string;
    sev: "success" | "error" | "info";
  }>({ open: false, msg: "", sev: "success" });

  // Pagination
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  // Summary cards
  const [summary, setSummary] = React.useState<Summary>({
    totalBookings: 0,
    inProgress: 0,
  });

  // สร้าง labels ตามชั่วโมงที่เลือก
  const hourLabels = React.useMemo(
    () =>
      Array.from(
        { length: Math.max(0, hEnd - hStart + 1) },
        (_, i) => `${String(hStart + i).padStart(2, "0")}:00`
      ),
    [hStart, hEnd]
  );

  // Chart options: BAR + dataLabels อยู่กึ่งกลางแท่ง (แนวนอน)
  const chartOptions: ApexOptions = React.useMemo(
    () => ({
      chart: {
        fontFamily: "inherit",
        foreColor: "inherit",
        height: "100%",
        type: "bar",
        toolbar: { show: false },
        zoom: { enabled: false },
      },
      colors: [theme.palette.grey[800]],
      labels: hourLabels,
      dataLabels: {
        enabled: true,
        formatter: (val: number) => (val ? val.toLocaleString() : "0"),
        background: { enabled: false },
        style: { fontWeight: 700 }, // ตัวเลขหนา-ชัด
      },
      grid: { borderColor: theme.palette.divider },
      legend: { show: false },
      plotOptions: {
        bar: {
          columnWidth: "55%",
          dataLabels: {
            position: "center", // ให้อยู่กลางแท่ง และเป็นแนวนอน
          },
        },
      },
      states: { hover: { filter: { type: "darken" } } },
      tooltip: { followCursor: true, theme: theme.palette.mode },
      xaxis: {
        axisBorder: { show: false },
        axisTicks: { color: theme.palette.divider },
        labels: { style: { colors: theme.palette.text.secondary } },
        categories: hourLabels,
      },
      yaxis: {
        labels: { style: { colors: theme.palette.text.secondary } },
        title: { text: "Total Net (kg)" },
      },
    }),
    [theme, hourLabels]
  );
  const [chartSeries, setChartSeries] = React.useState<any[]>([
    { name: "Total Net (kg)", data: [] as number[] },
  ]);
  const [chartLoading, setChartLoading] = React.useState(false);

  /* ---------- คำนวณช่วงวันจาก tab ---------- */
  const rangeDays = React.useMemo(() => {
    if (!dateFrom) return [dayjs()];
    if (tab === 0) {
      return [dateFrom.startOf("day")];
    }
    if (tab === 1) {
      const start = dateFrom.startOf("week").add(1, "day"); // จันทร์
      return _.range(0, 7).map((i) => start.add(i, "day"));
    }
    // Month/Range
    const start = (dateFrom ?? dayjs()).startOf("day");
    const end = (dateTo ?? start.endOf("month")).endOf("day");
    const all: Dayjs[] = [];
    let cur = start.startOf("day");
    const last = end.startOf("day");
    while (cur.isBefore(last) || cur.isSame(last, "day")) {
      all.push(cur);
      cur = cur.add(1, "day");
    }
    return all;
  }, [tab, dateFrom, dateTo]);

  /* ---------- โหลดข้อมูล ---------- */
  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      // ยิงหลายวันแล้วรวม
      const allRows: BookingView[] = [];
      for (const d of rangeDays) {
        const ev = await fetchJSON<any[]>(EVENTS_API(d.format("YYYY-MM-DD")));
        allRows.push(...(ev || []).map(normalizeFromEvent));
      }

      // ค้นหา
      const term = q.trim().toLowerCase();
      const filtered = term
        ? allRows.filter(
            (r) =>
              r.bookingCode?.toLowerCase().includes(term) ||
              r.supplierName?.toLowerCase().includes(term) ||
              r.supCode?.toLowerCase().includes(term) ||
              r.truckRegister?.toLowerCase().includes(term)
          )
        : allRows;

      const onlyChecked = filtered
        .filter((r) => !!r.checkInTime)
        .sort((a, b) => {
          const at = a.checkInTime ? +new Date(a.checkInTime) : 0;
          const bt = b.checkInTime ? +new Date(b.checkInTime) : 0;
          return bt - at;
        });

      setRowsAll(filtered);
      setRowsCheckedIn(onlyChecked);
      setPage(0);

      // Summary
      const inProgress = onlyChecked.filter((r) => {
        const done = isTrailer(r.truckType)
          ? r.weightOutHead != null || r.weightOutTrailer != null
          : r.weightOut != null;
        return !done;
      }).length;

      setSummary({ totalBookings: filtered.length, inProgress });
    } catch (e: any) {
      setToast({
        open: true,
        msg: e?.message || "โหลดข้อมูลไม่สำเร็จ",
        sev: "error",
      });
      setRowsAll([]);
      setRowsCheckedIn([]);
      setSummary({ totalBookings: 0, inProgress: 0 });
    } finally {
      setLoading(false);
    }
  }, [rangeDays, q]);

  React.useEffect(() => {
    const t = setTimeout(loadData, 150);
    return () => clearTimeout(t);
  }, [loadData]);

  /* ---------- โหลดกราฟ (Bar) ตามช่วงชั่วโมง ---------- */
  const loadChart = React.useCallback(async () => {
    setChartLoading(true);
    try {
      const len = Math.max(0, hEnd - hStart + 1);
      const vals = Array(len).fill(0);
      for (const r of rowsAll) {
        if (!r.checkInTime) continue;
        const h = dayjs(r.checkInTime).hour();
        if (h < hStart || h > hEnd) continue;
        const net = calcNetShown(r);
        if (net == null) continue; // ยังไม่ออก
        vals[h - hStart] += net;
      }
      setChartSeries([{ name: "Total Net (kg)", data: vals }]);
    } finally {
      setChartLoading(false);
    }
  }, [rowsAll, hStart, hEnd]);

  React.useEffect(() => {
    loadChart();
  }, [loadChart]);

  /* ---------- สรุปตามประเภทยาง ---------- */
  const rubberSummary = React.useMemo(() => {
    // เฉพาะรายการที่มี Net แล้ว
    const done = rowsAll.filter((r) => calcNetShown(r) != null);
    const byType = _.groupBy(done, (r) => r.rubberTypeName || "Unknown");
    const items = Object.entries(byType).map(([name, list]) => {
      const sum = list.reduce((acc, it) => acc + (calcNetShown(it) || 0), 0);
      return { name, kg: sum };
    });
    const total = items.reduce((a, b) => a + b.kg, 0);
    return {
      total,
      items: items
        .sort((a, b) => b.kg - a.kg)
        .map((it) => ({
          ...it,
          pct: total ? Math.round((it.kg / total) * 100) : 0,
        })),
    };
  }, [rowsAll]);

  /* ---------- ตาราง + เพจิ้ง ---------- */
  const tableRows = rowsCheckedIn; // โชว์เฉพาะที่เช็คอินแล้ว
  const paged = React.useMemo(() => {
    const start = page * rowsPerPage;
    return tableRows.slice(start, start + rowsPerPage);
  }, [tableRows, page, rowsPerPage]);

  /* ---------- helpers UI ---------- */
  const hourOptions = React.useMemo(
    () =>
      Array.from({ length: 24 }, (_, h) => ({
        label: `${String(h).padStart(2, "0")}:00`,
        value: h,
      })),
    []
  );

  /* ---------- UI ---------- */
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <FusePageSimple
        header={
          <Box className="p-6">
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h5" fontWeight={800}>
                Rubber Receiving Dashboard
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <IconButton
                onClick={() => {
                  loadData();
                  loadChart();
                }}
                disabled={loading}
                title="Refresh"
              >
                <RefreshIcon />
              </IconButton>
            </Stack>
          </Box>
        }
        content={
          <Box className="p-6">
            {/* ===== Overview (ย้ายแถบควบคุมลงมาอยู่ด้านใน) ===== */}
            <Paper
              sx={{ p: 2.5, borderRadius: RADIUS, mb: 2 }}
              variant="outlined"
            >
              {/* แถบควบคุมด้านบนของ Overview */}
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.25}
                alignItems={{ xs: "stretch", md: "center" }}
              >
                <Tabs
                  value={tab}
                  onChange={(_e, v: TabKey) => {
                    setTab(v);
                    if (v === 0) {
                      setDateTo(dateFrom); // Day ใช้วันเดียว
                    } else if (v === 1) {
                      setDateTo(dateFrom); // Week ใช้ From ตัวเดียวเป็นสัปดาห์เดียวกัน
                    } else if (v === 2) {
                      const base = dateFrom ?? dayjs();
                      setDateFrom(base.startOf("month"));
                      setDateTo(base.endOf("month"));
                    }
                  }}
                  sx={{ minHeight: 40 }}
                >
                  <Tab label="This Day" value={0} />
                  <Tab label="This Week" value={1} />
                  <Tab label="This Month" value={2} />
                </Tabs>

                <Box sx={{ flexGrow: 1 }} />

                {/* From / To */}
                <Stack direction="row" spacing={1}>
                  <FormControl sx={{ width: 160 }}>
                    <FormLabel>From</FormLabel>
                    <DatePicker
                      value={dateFrom}
                      onChange={(v: Dayjs | null) => setDateFrom(v)}
                      format="DD-MMM-YYYY"
                      slotProps={{
                        textField: { size: "small", sx: fieldSx },
                        popper: { disablePortal: true },
                      }}
                    />
                  </FormControl>

                  <FormControl sx={{ width: 160 }}>
                    <FormLabel>To</FormLabel>
                    <DatePicker
                      value={tab === 2 ? dateTo : dateFrom}
                      onChange={(v: Dayjs | null) => {
                        if (tab === 2) setDateTo(v);
                        else setDateFrom(v);
                      }}
                      disabled={tab !== 2}
                      format="DD-MMM-YYYY"
                      slotProps={{
                        textField: { size: "small", sx: fieldSx },
                        popper: { disablePortal: true },
                      }}
                    />
                  </FormControl>
                </Stack>

                {/* Search */}
                <FormControl sx={{ minWidth: 260, flex: 1 }}>
                  <FormLabel>Search (Code / Supplier / Plate)</FormLabel>
                  <TextField
                    {...FIELD_PROPS}
                    sx={fieldSx}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="เช่น 2025082801 / สมหญิง / 1กก-1234"
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
              </Stack>

              {/* Cards */}
              <Box className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <Box
                  className="flex flex-col items-center justify-center rounded-xl border px-1 py-8"
                  sx={{
                    backgroundColor: "var(--mui-palette-background-default)",
                  }}
                >
                  <Typography
                    className="text-5xl leading-none font-semibold tracking-tight sm:text-6xl"
                    color="primary"
                  >
                    {summary.totalBookings.toLocaleString()}
                  </Typography>
                  <Typography
                    className="mt-1 text-sm sm:text-base"
                    color="text.secondary"
                  >
                    {tab === 0
                      ? "Bookings (Today)"
                      : tab === 1
                        ? "Bookings (This Week)"
                        : "Bookings (Range)"}
                  </Typography>
                </Box>

                <Box
                  className="flex flex-col items-center justify-center rounded-xl border px-1 py-8"
                  sx={{
                    backgroundColor: "var(--mui-palette-background-default)",
                  }}
                >
                  <Typography
                    className="text-5xl leading-none font-semibold tracking-tight sm:text-6xl"
                    color="secondary"
                  >
                    {summary.inProgress.toLocaleString()}
                  </Typography>
                  <Typography
                    className="mt-1 text-sm sm:text-base"
                    color="text.secondary"
                  >
                    In Progress
                  </Typography>
                </Box>
              </Box>

              <div className="mt-4 grid w-full grid-flow-row grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Left: BAR chart + hour range controls */}
                <div className="flex flex-auto flex-col">
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={1}
                  >
                    <Typography className="font-medium" color="text.secondary">
                      Total Net by hour (abs(Out − In))
                    </Typography>
                    {/* ตัวเลือกช่วงชั่วโมงของกราฟ */}
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        Hour Range
                      </Typography>
                      <Select
                        size="small"
                        value={hStart}
                        onChange={(e) => setHStart(Number(e.target.value))}
                      >
                        {hourOptions.map((o) => (
                          <MenuItem key={`hs-${o.value}`} value={o.value}>
                            {o.label}
                          </MenuItem>
                        ))}
                      </Select>
                      <Typography variant="caption">to</Typography>
                      <Select
                        size="small"
                        value={hEnd}
                        onChange={(e) => setHEnd(Number(e.target.value))}
                      >
                        {hourOptions.map((o) => (
                          <MenuItem
                            key={`he-${o.value}`}
                            value={o.value}
                            disabled={o.value < hStart}
                          >
                            {o.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </Stack>
                  </Stack>

                  <div className="flex flex-auto flex-col">
                    {chartLoading ? (
                      <Box sx={{ height: 320 }}>
                        <FuseLoading />
                      </Box>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <ReactApexChart
                          className="w-full flex-auto"
                          options={chartOptions}
                          series={chartSeries}
                          type="bar"
                          height={320}
                        />
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Right: Rubber type summary */}
                <div className="flex flex-col">
                  <Typography className="font-medium" color="text.secondary">
                    Rubber Types (weight & share)
                  </Typography>

                  <Paper
                    variant="outlined"
                    sx={{ mt: 2, p: 2, borderRadius: RADIUS }}
                  >
                    {rubberSummary.items.length === 0 ? (
                      <Typography color="text.secondary">
                        No completed records.
                      </Typography>
                    ) : (
                      <Stack spacing={1.25}>
                        {rubberSummary.items.map((it) => (
                          <Box key={it.name}>
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              mb={0.5}
                            >
                              <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                              >
                                <Chip
                                  size="small"
                                  label={it.name}
                                  sx={rubberChipSx(it.name)}
                                />
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {it.kg.toLocaleString()} kg
                                </Typography>
                              </Stack>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {it.pct}%
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={it.pct}
                              sx={{ height: 8, borderRadius: 999 }}
                            />
                          </Box>
                        ))}
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          pt={0.5}
                        >
                          <Typography fontWeight={700}>Total</Typography>
                          <Typography fontWeight={700}>
                            {rubberSummary.total.toLocaleString()} kg
                          </Typography>
                        </Stack>
                      </Stack>
                    )}
                  </Paper>
                </div>
              </div>
            </Paper>

            {/* หมายเหตุ */}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              แสดงเฉพาะรายการที่<strong>เช็คอินแล้ว</strong>{" "}
              {rowsCheckedIn.length} รายการ จากทั้งหมด {summary.totalBookings}{" "}
              รายการในช่วงที่เลือก
            </Typography>

            {/* ตาราง */}
            <Paper variant="outlined" sx={{ borderRadius: RADIUS }}>
              <TableContainer>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell align="center">No.</TableCell>
                      <TableCell>Check In</TableCell>
                      <TableCell>Booking Code</TableCell>
                      <TableCell align="center">Queue</TableCell>
                      <TableCell>Time Slot</TableCell>
                      <TableCell>Supplier</TableCell>
                      <TableCell>License Plate</TableCell>
                      <TableCell>Truck Type</TableCell>
                      <TableCell>Rubber Type</TableCell>
                      <TableCell align="right" width={140}>
                        In (kg)
                      </TableCell>
                      <TableCell align="right" width={140}>
                        Out (kg)
                      </TableCell>
                      <TableCell align="right" width={140}>
                        Net (kg)
                      </TableCell>
                      <TableCell align="center" width={110}>
                        Status
                      </TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {paged.map((r, idx) => {
                      const alreadyOut = isTrailer(r.truckType)
                        ? r.weightOutHead != null || r.weightOutTrailer != null
                        : r.weightOut != null;

                      const netShown = calcNetShown(r);

                      const statusColor = alreadyOut
                        ? "success"
                        : r.weightIn != null ||
                            r.weightInHead != null ||
                            r.weightInTrailer != null
                          ? "warning"
                          : "default";
                      const statusText = alreadyOut
                        ? "บันทึกออกแล้ว"
                        : r.weightIn != null ||
                            r.weightInHead != null ||
                            r.weightInTrailer != null
                          ? "บันทึกเข้าแล้ว"
                          : "-";

                      return (
                        <TableRow key={r.id || r.bookingCode} hover>
                          <TableCell align="center">
                            {page * rowsPerPage + idx + 1}.
                          </TableCell>

                          <TableCell>
                            <Chip
                              size="small"
                              label={
                                r.checkInTime
                                  ? dayjs(r.checkInTime).format("HH:mm")
                                  : "-"
                              }
                              variant="outlined"
                              sx={{
                                borderColor: "black",
                                color: "black",
                                bgcolor: "white",
                                fontWeight: 600,
                              }}
                            />
                          </TableCell>

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
                              title={`${r.supCode} : ${r.supplierName}`}
                            >
                              {r.supCode} : {r.supplierName}
                            </Typography>
                          </TableCell>

                          <TableCell>{r.truckRegister || "-"}</TableCell>
                          <TableCell>{r.truckType || "-"}</TableCell>

                          <TableCell>
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

                          <TableCell align="right">{showIn(r)}</TableCell>
                          <TableCell align="right">{showOut(r)}</TableCell>
                          <TableCell align="right">
                            {netShown == null ? "-" : netShown.toLocaleString()}
                          </TableCell>

                          <TableCell align="center">
                            <Chip
                              size="small"
                              label={statusText}
                              color={statusColor as any}
                              variant={alreadyOut ? "filled" : "outlined"}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>

                  <TableFooter>
                    <TableRow>
                      <TablePagination
                        count={tableRows.length}
                        page={page}
                        onPageChange={(_, p) => setPage(p)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(e) => {
                          setRowsPerPage(parseInt(e.target.value, 10));
                          setPage(0);
                        }}
                        rowsPerPageOptions={[10, 20, 50, 100]}
                      />
                    </TableRow>
                  </TableFooter>
                </Table>
              </TableContainer>
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
