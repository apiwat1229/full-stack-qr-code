// src/app/check-in/history/page.tsx
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
  Button,
  Chip,
  FormControl,
  FormLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
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

// ช่วงเวลา 08:00–20:00
const H_START = 8;
const H_END = 20; // inclusive
const H_LEN = H_END - H_START + 1;

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

type TimePreset = "all" | "am" | "pm" | "custom";

type Summary = {
  totalBookings: number;
  checkedIn: number;
  pending: number;
  uniqueSupAll: number;
  uniqueSupChecked: number;
  completion: number; // %
};

/* ================= Helpers ================= */
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
  };
}

/* =============== Page =============== */
export default function CheckInHistoryPage() {
  const theme = useTheme();

  // Filters
  const [date, setDate] = React.useState<Dayjs | null>(dayjs());
  const [timePreset, setTimePreset] = React.useState<TimePreset>("all");
  const [customStart, setCustomStart] = React.useState("08:00");
  const [customEnd, setCustomEnd] = React.useState("17:00");
  const [q, setQ] = React.useState("");

  // Data (รายวันสำหรับตารางเดิม)
  const [loading, setLoading] = React.useState(false);
  const [rowsCheckedIn, setRowsCheckedIn] = React.useState<BookingView[]>([]);
  const [allFiltered, setAllFiltered] = React.useState<BookingView[]>([]);

  // Data (รายสัปดาห์สำหรับตาราง)
  const [weekRowsCheckedIn, setWeekRowsCheckedIn] = React.useState<
    BookingView[]
  >([]);

  const [toast, setToast] = React.useState<{
    open: boolean;
    msg: string;
    sev: "success" | "error" | "info";
  }>({ open: false, msg: "", sev: "success" });

  // Pagination
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  // Tabs (Chart mode)
  const [chartTab, setChartTab] = React.useState<0 | 1>(0); // 0: Day, 1: Week
  const [chartLoading, setChartLoading] = React.useState(false);

  // Summary (ใช้แสดงใน Overview)
  const [summary, setSummary] = React.useState<Summary>({
    totalBookings: 0,
    checkedIn: 0,
    pending: 0,
    uniqueSupAll: 0,
    uniqueSupChecked: 0,
    completion: 0,
  });

  // Derived
  const dateISO = React.useMemo(
    () => (date ? date.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD")),
    [date]
  );
  const windowRange = React.useMemo(() => {
    if (timePreset === "all") return { s: "00:00", e: "23:59" };
    if (timePreset === "am") return { s: "08:00", e: "12:00" };
    if (timePreset === "pm") return { s: "12:00", e: "17:00" };
    return { s: customStart, e: customEnd };
  }, [timePreset, customStart, customEnd]);

  /* ---------- โหลดตาราง: รายวัน ---------- */
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const events = await fetchJSON<any[]>(EVENTS_API(dateISO));
      const all = (events || []).map(normalizeFromEvent);

      const inWindow =
        timePreset === "all"
          ? all
          : all.filter(
              (r) =>
                r.startTime &&
                r.startTime >= windowRange.s &&
                r.startTime <= windowRange.e
            );

      const term = q.trim().toLowerCase();
      const filtered = term
        ? inWindow.filter(
            (r) =>
              r.bookingCode?.toLowerCase().includes(term) ||
              r.supplierName?.toLowerCase().includes(term) ||
              r.supCode?.toLowerCase().includes(term) ||
              r.truckRegister?.toLowerCase().includes(term)
          )
        : inWindow;

      const onlyChecked = filtered
        .filter((r) => !!r.checkInTime)
        .sort((a, b) => {
          const at = a.checkInTime ? +new Date(a.checkInTime) : 0;
          const bt = b.checkInTime ? +new Date(b.checkInTime) : 0;
          return bt - at;
        });

      setAllFiltered(filtered);
      setRowsCheckedIn(onlyChecked);
      setPage(0);

      // สรุปรายวันสำหรับ Overview เมื่ออยู่แท็บ Day
      const dayTotal = filtered.length;
      const dayChecked = onlyChecked.length;
      const dayUniqueAll = new Set(
        filtered.map((r) => `${r.supCode}|${r.supplierName}`)
      ).size;
      const dayUniqueChecked = new Set(
        onlyChecked.map((r) => `${r.supCode}|${r.supplierName}`)
      ).size;

      setSummary({
        totalBookings: dayTotal,
        checkedIn: dayChecked,
        pending: Math.max(0, dayTotal - dayChecked),
        uniqueSupAll: dayUniqueAll,
        uniqueSupChecked: dayUniqueChecked,
        completion: dayTotal ? Math.round((dayChecked / dayTotal) * 100) : 0,
      });
    } catch (e: any) {
      setToast({
        open: true,
        msg: e?.message || "โหลดไม่สำเร็จ",
        sev: "error",
      });
      setAllFiltered([]);
      setRowsCheckedIn([]);
    } finally {
      setLoading(false);
    }
  }, [dateISO, timePreset, windowRange.s, windowRange.e, q]);

  React.useEffect(() => {
    const t = setTimeout(() => {
      if (chartTab === 0) load();
    }, 200);
    return () => clearTimeout(t);
  }, [load, chartTab]);

  /* ---------- โหลดตาราง: รายสัปดาห์ ---------- */
  const loadWeekTable = React.useCallback(async () => {
    setLoading(true);
    try {
      const base = dayjs(dateISO);
      const startOfWeek = base.startOf("week").add(1, "day"); // จันทร์
      const weekDays = _.range(0, 7).map((i) => startOfWeek.add(i, "day"));

      const allRows: BookingView[] = [];
      for (const d of weekDays) {
        const ev = await fetchJSON<any[]>(EVENTS_API(d.format("YYYY-MM-DD")));
        allRows.push(...(ev || []).map(normalizeFromEvent));
      }

      // ค้นหาด้วย q เช่นเดิม
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

      setWeekRowsCheckedIn(onlyChecked);
      setPage(0);
    } catch (e: any) {
      setToast({
        open: true,
        msg: e?.message || "โหลดสัปดาห์ไม่สำเร็จ",
        sev: "error",
      });
      setWeekRowsCheckedIn([]);
    } finally {
      setLoading(false);
    }
  }, [dateISO, q]);

  // เมื่อสลับเป็น Week หรือเปลี่ยนวันที่/ค้นหา ให้โหลดตารางสัปดาห์
  React.useEffect(() => {
    if (chartTab === 1) {
      const t = setTimeout(loadWeekTable, 200);
      return () => clearTimeout(t);
    }
  }, [chartTab, dateISO, q, loadWeekTable]);

  /* ---------- Chart helpers ---------- */
  const hourLabels = React.useMemo(
    () =>
      Array.from(
        { length: H_LEN },
        (_, i) => `${String(H_START + i).padStart(2, "0")}:00`
      ),
    []
  );
  function checkedCountByHour(rows: BookingView[]) {
    const vals = Array(H_LEN).fill(0);
    for (const r of rows) {
      if (!r.checkInTime) continue;
      const h = dayjs(r.checkInTime).hour();
      if (h < H_START || h > H_END) continue;
      vals[h - H_START]++;
    }
    return vals;
  }
  const labelsMonSun = () => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  function dayIndexMonSun(d: Dayjs) {
    const js = d.day();
    return js === 0 ? 6 : js - 1;
  }

  /* ---------- Chart state ---------- */
  const [chartLabels, setChartLabels] = React.useState<string[]>(hourLabels);
  const [chartSeries, setChartSeries] = React.useState<any[]>([
    { name: "Checked-in (line)", type: "line", data: Array(H_LEN).fill(0) },
    { name: "Checked-in (bar)", type: "column", data: Array(H_LEN).fill(0) },
  ]);

  const chartOptions: ApexOptions = React.useMemo(
    () => ({
      chart: {
        fontFamily: "inherit",
        foreColor: "inherit",
        height: "100%",
        type: "line",
        toolbar: { show: false },
        zoom: { enabled: false },
      },
      colors: [theme.palette.primary.main, theme.palette.secondary.main],
      labels: chartLabels,
      dataLabels: {
        enabled: true,
        enabledOnSeries: [0],
        background: { borderWidth: 0 },
      },
      grid: { borderColor: theme.palette.divider },
      legend: { show: false },
      plotOptions: { bar: { columnWidth: "50%" } },
      states: { hover: { filter: { type: "darken" } } },
      stroke: { width: [3, 0], curve: "straight" },
      markers: { size: 4, strokeWidth: 2, strokeColors: "#fff" },
      tooltip: { followCursor: true, theme: theme.palette.mode },
      xaxis: {
        axisBorder: { show: false },
        axisTicks: { color: theme.palette.divider },
        labels: { style: { colors: theme.palette.text.secondary } },
        tooltip: { enabled: false },
      },
      yaxis: {
        labels: { style: { colors: theme.palette.text.secondary } },
      },
    }),
    [theme, chartLabels]
  );

  /* ---------- โหลดกราฟ + อัปเดตสรุปสัปดาห์ ---------- */
  const loadChart = React.useCallback(async () => {
    try {
      setChartLoading(true);

      if (chartTab === 0) {
        const events = await fetchJSON<any[]>(EVENTS_API(dateISO));
        const rows = (events || []).map(normalizeFromEvent);
        const checked = checkedCountByHour(rows);

        setChartLabels(hourLabels);
        setChartSeries([
          { name: "Checked-in (line)", type: "line", data: checked },
          { name: "Checked-in (bar)", type: "column", data: checked },
        ]);
      } else {
        const base = dayjs(dateISO);
        const startOfWeek = base.startOf("week").add(1, "day"); // Mon
        const weekDays = _.range(0, 7).map((i) => startOfWeek.add(i, "day"));

        const allRows: BookingView[] = [];
        for (const d of weekDays) {
          const ev = await fetchJSON<any[]>(EVENTS_API(d.format("YYYY-MM-DD")));
          allRows.push(...(ev || []).map(normalizeFromEvent));
        }
        const counts = Array(7).fill(0);
        for (const r of allRows) {
          if (!r.checkInTime) continue;
          const idx = dayIndexMonSun(dayjs(r.checkInTime));
          counts[idx]++;
        }

        setChartLabels(labelsMonSun());
        setChartSeries([
          { name: "Checked-in (line)", type: "line", data: counts },
          { name: "Checked-in (bar)", type: "column", data: counts },
        ]);

        // สรุปสัปดาห์ (Overview)
        const weekTotal = allRows.length;
        const weekCheckedRows = allRows.filter((r) => !!r.checkInTime);
        const weekChecked = weekCheckedRows.length;
        const weekUniqueAll = new Set(
          allRows.map((r) => `${r.supCode}|${r.supplierName}`)
        ).size;
        const weekUniqueChecked = new Set(
          weekCheckedRows.map((r) => `${r.supCode}|${r.supplierName}`)
        ).size;

        setSummary({
          totalBookings: weekTotal,
          checkedIn: weekChecked,
          pending: Math.max(0, weekTotal - weekChecked),
          uniqueSupAll: weekUniqueAll,
          uniqueSupChecked: weekUniqueChecked,
          completion: weekTotal
            ? Math.round((weekChecked / weekTotal) * 100)
            : 0,
        });
      }
    } catch {
      if (chartTab === 0) {
        setChartLabels(hourLabels);
        setChartSeries([
          {
            name: "Checked-in (line)",
            type: "line",
            data: Array(H_LEN).fill(0),
          },
          {
            name: "Checked-in (bar)",
            type: "column",
            data: Array(H_LEN).fill(0),
          },
        ]);
      } else {
        setChartLabels(labelsMonSun());
        setChartSeries([
          { name: "Checked-in (line)", type: "line", data: Array(7).fill(0) },
          { name: "Checked-in (bar)", type: "column", data: Array(7).fill(0) },
        ]);
      }
    } finally {
      setChartLoading(false);
    }
  }, [chartTab, dateISO, hourLabels]);

  React.useEffect(() => {
    loadChart();
  }, [loadChart]);

  // เมื่อสลับกลับ Day ให้สรุปมาจากข้อมูลรายวัน
  React.useEffect(() => {
    if (chartTab === 0) {
      const dayTotal = allFiltered.length;
      const dayChecked = rowsCheckedIn.length;
      const dayUniqueAll = new Set(
        allFiltered.map((r) => `${r.supCode}|${r.supplierName}`)
      ).size;
      const dayUniqueChecked = new Set(
        rowsCheckedIn.map((r) => `${r.supCode}|${r.supplierName}`)
      ).size;

      setSummary({
        totalBookings: dayTotal,
        checkedIn: dayChecked,
        pending: Math.max(0, dayTotal - dayChecked),
        uniqueSupAll: dayUniqueAll,
        uniqueSupChecked: dayUniqueChecked,
        completion: dayTotal ? Math.round((dayChecked / dayTotal) * 100) : 0,
      });
    }
  }, [chartTab, allFiltered, rowsCheckedIn]);

  /* ---------- ตาราง: ใช้แหล่งข้อมูลตามแท็บ ---------- */
  const tableRows = chartTab === 0 ? rowsCheckedIn : weekRowsCheckedIn;

  const paged = React.useMemo(() => {
    const start = page * rowsPerPage;
    return tableRows.slice(start, start + rowsPerPage);
  }, [tableRows, page, rowsPerPage]);

  /* ---------- UI: ใช้ FusePageSimple แบบหน้า Example ---------- */
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <FusePageSimple
        header={
          <Box className="p-6">
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h5" fontWeight={800}>
                Summary of Checked-in
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <IconButton
                onClick={() =>
                  chartTab === 1 ? (loadWeekTable(), loadChart()) : load()
                }
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
            {/* Filters */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, mb: 2 }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.25}
                alignItems="flex-end"
              >
                <FormControl sx={{ flex: 1 }}>
                  <FormLabel>Date</FormLabel>
                  <DatePicker
                    value={date}
                    onChange={(v: Dayjs | null) => setDate(v)}
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

                <FormControl sx={{ flex: 1 }}>
                  <FormLabel>Time Range</FormLabel>
                  <TextField
                    {...FIELD_PROPS}
                    sx={fieldSx}
                    select
                    value={timePreset}
                    onChange={(e) =>
                      setTimePreset(e.target.value as TimePreset)
                    }
                  >
                    <MenuItem value="all">ทั้งวัน (00:00–23:59)</MenuItem>
                    <MenuItem value="am">ช่วงเช้า (08:00–12:00)</MenuItem>
                    <MenuItem value="pm">ช่วงบ่าย (12:00–17:00)</MenuItem>
                    <MenuItem value="custom">กำหนดเอง</MenuItem>
                  </TextField>
                </FormControl>

                <FormControl sx={{ flex: 2 }}>
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
                  />
                </FormControl>

                <Box sx={{ flex: 1 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() =>
                      chartTab === 1 ? (loadWeekTable(), loadChart()) : load()
                    }
                    disabled={loading}
                    sx={{ borderRadius: 1, height: 33 }}
                  >
                    {loading ? "Loading..." : "Load data"}
                  </Button>
                </Box>
              </Stack>
            </Paper>

            {/* ===== Chart + Overview ===== */}
            <Paper
              sx={{ p: 2.5, borderRadius: RADIUS, mb: 2 }}
              variant="outlined"
            >
              <div className="flex flex-col items-start justify-between sm:flex-row">
                <Typography className="truncate text-xl leading-6 font-medium tracking-tight">
                  Booking Summary
                </Typography>
                <div className="mt-3 sm:mt-0">
                  <Tabs
                    value={chartTab}
                    onChange={(_e, v: 0 | 1) => setChartTab(v)}
                  >
                    <Tab label="This Day" value={0} />
                    <Tab label="This Week" value={1} />
                  </Tabs>
                </div>
              </div>

              <div className="mt-4 grid w-full grid-flow-row grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Left: chart */}
                <div className="flex flex-auto flex-col">
                  <Typography className="font-medium" color="text.secondary">
                    {chartTab === 0
                      ? "Checked-in (hourly · 08:00–20:00)"
                      : "Checked-in per day (Mon–Sun)"}
                  </Typography>

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
                          height={320}
                        />
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Right: overview */}
                <div className="flex flex-col">
                  <Typography className="font-medium" color="text.secondary">
                    Overview
                  </Typography>
                  <div className="mt-6 grid flex-auto grid-cols-4 gap-3">
                    <Box
                      className="col-span-2 flex flex-col items-center justify-center rounded-xl border px-1 py-8"
                      sx={{
                        backgroundColor:
                          "var(--mui-palette-background-default)",
                      }}
                    >
                      <Typography
                        className="text-5xl leading-none font-semibold tracking-tight sm:text-7xl"
                        color="secondary"
                      >
                        {summary.checkedIn}
                      </Typography>
                      <Typography
                        className="mt-1 text-sm font-medium sm:text-lg"
                        color="secondary"
                      >
                        Checked-in
                      </Typography>
                    </Box>

                    <Box
                      className="col-span-2 flex flex-col items-center justify-center rounded-xl border px-1 py-8"
                      sx={{
                        backgroundColor:
                          "var(--mui-palette-background-default)",
                      }}
                    >
                      <Typography
                        className="text-5xl leading-none font-semibold tracking-tight sm:text-7xl"
                        color="secondary"
                      >
                        {summary.totalBookings}
                      </Typography>
                      <Typography
                        className="mt-1 text-sm font-medium sm:text-lg"
                        color="secondary"
                      >
                        Bookings
                      </Typography>
                    </Box>

                    <Box
                      className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center rounded-xl border px-1 py-8"
                      sx={{
                        backgroundColor:
                          "var(--mui-palette-background-default)",
                      }}
                    >
                      <Typography
                        className="text-5xl leading-none font-semibold tracking-tight"
                        color="text.secondary"
                      >
                        {summary.pending}
                      </Typography>
                      <Typography
                        className="mt-1 text-center text-sm font-medium"
                        color="text.secondary"
                      >
                        Pending
                      </Typography>
                    </Box>

                    <Box
                      className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center rounded-xl border px-1 py-8"
                      sx={{
                        backgroundColor:
                          "var(--mui-palette-background-default)",
                      }}
                    >
                      <Typography
                        className="text-5xl leading-none font-semibold tracking-tight"
                        color="text.secondary"
                      >
                        {summary.uniqueSupAll}
                      </Typography>
                      <Typography
                        className="mt-1 text-center text-sm font-medium"
                        color="text.secondary"
                      >
                        Suppliers
                      </Typography>
                    </Box>

                    <Box
                      className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center rounded-xl border px-1 py-8"
                      sx={{
                        backgroundColor:
                          "var(--mui-palette-background-default)",
                      }}
                    >
                      <Typography
                        className="text-5xl leading-none font-semibold tracking-tight"
                        color="text.secondary"
                      >
                        {summary.uniqueSupChecked}
                      </Typography>
                      <Typography
                        className="mt-1 text-center text-sm font-medium"
                        color="text.secondary"
                      >
                        Sup. Checked
                      </Typography>
                    </Box>

                    <Box
                      className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center rounded-xl border px-1 py-8"
                      sx={{
                        backgroundColor:
                          "var(--mui-palette-background-default)",
                      }}
                    >
                      <Typography
                        className="text-5xl leading-none font-semibold tracking-tight"
                        color="text.secondary"
                      >
                        {summary.completion}%
                      </Typography>
                      <Typography
                        className="mt-1 text-center text-sm font-medium"
                        color="text.secondary"
                      >
                        Completion
                      </Typography>
                    </Box>
                  </div>
                </div>
              </div>
            </Paper>

            {/* หมายเหตุ (ใช้ summary) */}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              แสดงเฉพาะรายการที่<strong>เช็คอินแล้ว</strong> {summary.checkedIn}{" "}
              จาก {summary.totalBookings} รายการ
            </Typography>

            {/* ตาราง: แสดงตามแท็บที่เลือก */}
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
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {paged.map((r, idx) => (
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
                      </TableRow>
                    ))}
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
