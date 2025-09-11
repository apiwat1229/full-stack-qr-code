// src/app/(control-panel)/check-out/page.tsx
"use client";

import dayjs, { Dayjs } from "dayjs";
import duration from "dayjs/plugin/duration";
dayjs.extend(duration);

import FusePageSimple from "@fuse/core/FusePageSimple";
import DownloadIcon from "@mui/icons-material/Download";
// ⬇️ เปลี่ยนเฉพาะไอคอน
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ReplayIcon from "@mui/icons-material/Replay";
import SaveAltIcon from "@mui/icons-material/SaveAlt";
import SearchIcon from "@mui/icons-material/Search";
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControl,
  FormLabel,
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
import * as React from "react";

import WeightOutDialog from "./checked/components/WeightOutDialog";

/* ================= CONFIG ================= */
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "/api";
const api = (path: string) =>
  `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

const EVENTS_API = (dateISO: string) =>
  api(`/bookings/events?date=${encodeURIComponent(dateISO)}`);
const UPDATE_WEIGHTS_API = (id: string) => api(`/bookings/${id}/weights`);

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

  // Check-in / Drain
  checkInTime?: string | null;
  drainStartTime?: string | null;
  drainStopTime?: string | null;

  // In
  weightIn?: number | null;
  weightInHead?: number | null;
  weightInTrailer?: number | null;

  // Out
  weightOut?: number | null;
  weightOutHead?: number | null;
  weightOutTrailer?: number | null;
};

const RADIUS = 1;
const FIELD_PROPS = { size: "medium", variant: "outlined" } as const;
const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: RADIUS } };

/* ===== helpers ===== */
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
  for (const c of cands)
    if (c !== undefined && c !== null && c !== "") return c as T;
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
  if (!headers.has("Content-Type") && !!init?.body)
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
      if (j?.message)
        message = Array.isArray(j.message) ? j.message.join(", ") : j.message;
    } catch {}
    throw new Error(message);
  }
  if (!txt) return {} as T;
  return ct.includes("application/json")
    ? (JSON.parse(txt) as T)
    : (JSON.parse(txt) as T);
}
function isTrailer(truckType?: string) {
  const t = (truckType || "").toLowerCase();
  return t.includes("พ่วง") || t.includes("trailer");
}
function supplierText(r: BookingView) {
  return r.supCode && r.supplierName
    ? `${r.supCode} : ${r.supplierName}`
    : r.supCode || r.supplierName || "-";
}
function normalizeFromEvent(raw: any): BookingView {
  const xp = raw?.extendedProps ?? {};
  const sup = firstDefined<any>(xp?.supplier, raw?.supplier);
  const supCode =
    firstDefined(
      xp?.supplier_code,
      xp?.supplierCode,
      sup?.code,
      raw?.supplier_code,
      raw?.supplierCode
    ) || "-";
  const supplierName =
    firstDefined(xp?.supplier_name, xp?.supplierName, sup?.name) || "";
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
    // flow times
    checkInTime:
      firstDefined(xp?.check_in_time, raw?.checkInTime, raw?.check_in_time) ??
      null,
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
    // weights in
    weightIn:
      firstDefined(xp?.weight_in, raw?.weightIn, raw?.weight_in) ?? null,
    weightInHead: firstDefined(xp?.weight_in_head, raw?.weightInHead) ?? null,
    weightInTrailer:
      firstDefined(xp?.weight_in_trailer, raw?.weightInTrailer) ?? null,
    // weights out (ถ้ามี)
    weightOut:
      firstDefined(xp?.weight_out, raw?.weightOut, raw?.weight_out) ?? null,
    weightOutHead:
      firstDefined(xp?.weight_out_head, raw?.weightOutHead) ?? null,
    weightOutTrailer:
      firstDefined(xp?.weight_out_trailer, raw?.weightOutTrailer) ?? null,
  };
}

/** พร้อมบันทึกน้ำหนักขาออกไหม (ใช้คำนวณสถิติ/ตัวกรองได้) */
function readyForWeightOut(r: BookingView): boolean {
  const hasTimes = !!r.checkInTime && !!r.drainStartTime && !!r.drainStopTime;
  if (!hasTimes) return false;

  const trailer = isTrailer(r.truckType);
  const hasIn = trailer
    ? r.weightInHead != null && r.weightInTrailer != null
    : r.weightIn != null;

  if (!hasIn) return false;

  const hasOutAlready = trailer
    ? r.weightOutHead != null && r.weightOutTrailer != null
    : r.weightOut != null;

  return !hasOutAlready;
}

/** ===== Page ===== */
export default function WeightOutListPage() {
  const { data: session } = useSession();
  const authToken = React.useMemo<string | undefined>(() => {
    return (session as any)?.accessToken || getStoredToken();
  }, [session]);

  const callApi = React.useCallback(
    async <T,>(url: string, init?: RequestInit) =>
      fetchJSON<T>(url, init, authToken),
    [authToken]
  );

  const [listDate, setListDate] = React.useState<Dayjs | null>(dayjs());
  const listDateISO = React.useMemo(
    () => (listDate?.isValid() ? listDate : dayjs()).format("YYYY-MM-DD"),
    [listDate]
  );
  const [timePreset, setTimePreset] = React.useState<"all" | "am" | "pm">(
    "all"
  );
  const [showMode, setShowMode] = React.useState<"all" | "pending" | "done">(
    "all"
  );
  const [query, setQuery] = React.useState("");

  const [rows, setRows] = React.useState<BookingView[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [toast, setToast] = React.useState<{
    open: boolean;
    msg: string;
    sev: "success" | "error" | "info";
  }>({
    open: false,
    msg: "",
    sev: "success",
  });

  const getWindow = React.useCallback(() => {
    if (timePreset === "all") return { s: "00:00", e: "23:59" };
    if (timePreset === "am") return { s: "08:00", e: "12:00" };
    return { s: "12:00", e: "17:00" };
  }, [timePreset]);

  const loadData = React.useCallback(async () => {
    const { s, e } = getWindow();
    setLoading(true);
    try {
      const events = await callApi<any[]>(EVENTS_API(listDateISO));
      const mapped = (events || []).map(normalizeFromEvent);

      const isAlreadyOut = (r: BookingView) =>
        isTrailer(r.truckType)
          ? r.weightOutHead != null && r.weightOutTrailer != null
          : r.weightOut != null;

      const passCommon = (r: BookingView) =>
        (timePreset === "all" || (r.startTime >= s && r.startTime <= e)) &&
        (query.trim() === "" ||
          [r.bookingCode, r.truckRegister, r.supCode, r.supplierName]
            .join(" ")
            .toLowerCase()
            .includes(query.trim().toLowerCase()));

      const pendingCount = mapped.filter(readyForWeightOut).length;
      const totalCount = mapped.length;

      const filtered = mapped
        .filter((r) => {
          if (!passCommon(r)) return false;
          if (showMode === "pending") return !isAlreadyOut(r);
          if (showMode === "done") return isAlreadyOut(r);
          return true;
        })
        .sort((a, b) => {
          // เรียง pending ก่อน done
          const ao = isAlreadyOut(a) ? 1 : 0;
          const bo = isAlreadyOut(b) ? 1 : 0;
          if (ao !== bo) return ao - bo;

          const qa = a.sequence || 0;
          const qb = b.sequence || 0;
          if (qa !== qb) return qa - qb;
          const ta = a.checkInTime ? dayjs(a.checkInTime).valueOf() : 0;
          const tb = b.checkInTime ? dayjs(b.checkInTime).valueOf() : 0;
          return ta - tb;
        }) as BookingView[] & { _pendingCount?: number; _totalCount?: number };

      filtered._pendingCount = pendingCount;
      filtered._totalCount = totalCount;

      setRows(filtered);
    } catch {
      setRows([]);
      setToast({
        open: true,
        msg: "ไม่สามารถโหลดรายการได้",
        sev: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [listDateISO, getWindow, timePreset, query, callApi, showMode]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // ----- บันทึก weight out -----
  async function saveWeightOut(id: string, payload: Record<string, any>) {
    await callApi(UPDATE_WEIGHTS_API(id), {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  const [dlgOpen, setDlgOpen] = React.useState(false);
  const [dlgRow, setDlgRow] = React.useState<BookingView | null>(null);

  const openDialog = (r: BookingView) => {
    setDlgRow(r);
    setDlgOpen(true);
  };

  const handleSave = async (payload: {
    weight_out?: number | null;
    weight_out_head?: number | null;
    weight_out_trailer?: number | null;
  }) => {
    if (!dlgRow) return;

    try {
      const trailer = isTrailer(dlgRow.truckType);

      // ส่งเฉพาะ field ที่มีค่า
      const clean: Record<string, number> = {};

      if (trailer) {
        const head = payload.weight_out_head;
        const tail = payload.weight_out_trailer;

        if (head == null && tail == null) {
          setToast({
            open: true,
            msg: "กรุณากรอกน้ำหนักอย่างน้อย 1 ช่อง (หัว/หาง)",
            sev: "error",
          });
          return;
        }

        if (head != null) clean.weight_out_head = head;
        if (tail != null) clean.weight_out_trailer = tail;
      } else {
        const out = payload.weight_out;
        if (out == null) {
          setToast({ open: true, msg: "กรุณากรอกน้ำหนักออก", sev: "error" });
          return;
        }
        clean.weight_out = out;
      }

      await saveWeightOut(dlgRow.id, clean);
      setToast({ open: true, msg: "บันทึก Weight Out แล้ว", sev: "success" });
      setDlgOpen(false);
      setDlgRow(null);
      await loadData();
    } catch (e: any) {
      setToast({ open: true, msg: `บันทึกไม่ได้: ${e.message}`, sev: "error" });
    }
  };

  const pendingCount =
    (rows as any)._pendingCount ?? rows.filter(readyForWeightOut).length;
  const totalCount = (rows as any)._totalCount ?? rows.length;

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
                  Weight Out
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  แสดงผล: {rows.length.toLocaleString()} รายการ • รอบันทึก{" "}
                  {pendingCount.toLocaleString()}/{totalCount.toLocaleString()}{" "}
                  ทั้งหมด
                </Typography>
              </Box>
              <Button
                variant="contained"
                onClick={() => {
                  const csv = ["Booking,Queue,Time,Supplier,License,TruckType"]
                    .concat(
                      rows.map((r) =>
                        [
                          r.bookingCode,
                          r.sequence ?? "",
                          r.endTime
                            ? `${r.startTime}-${r.endTime}`
                            : r.startTime,
                          `${r.supCode}:${r.supplierName}`.split(",").join(" "),
                          r.truckRegister,
                          r.truckType || "",
                        ].join(",")
                      )
                    )
                    .join("\n");
                  const blob = new Blob([csv + "\n"], {
                    type: "text/csv;charset=utf-8;",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `weight-out_${listDateISO}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                startIcon={<DownloadIcon />}
                sx={{ borderRadius: RADIUS, px: 2 }}
                disabled={rows.length === 0}
              >
                Export CSV
              </Button>
            </Stack>
          </Box>
        }
        content={
          <Box className="p-6">
            {/* Filters */}
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
                  </TextField>
                </FormControl>

                {/* โหมดแสดงผล */}
                <FormControl sx={{ width: { xs: "100%", md: 220 } }}>
                  <FormLabel>สถานะ</FormLabel>
                  <TextField
                    {...FIELD_PROPS}
                    sx={fieldSx}
                    select
                    value={showMode}
                    onChange={(e) =>
                      setShowMode(e.target.value as "all" | "pending" | "done")
                    }
                  >
                    <MenuItem value="all">ทั้งหมด</MenuItem>
                    <MenuItem value="pending">รอบันทึก</MenuItem>
                    <MenuItem value="done">บันทึกแล้ว</MenuItem>
                  </TextField>
                </FormControl>

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

                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={() => {
                    setQuery("");
                    setTimePreset("all");
                    setShowMode("all");
                    loadData();
                  }}
                  startIcon={<ReplayIcon />}
                  sx={{ borderRadius: RADIUS, height: 33 }}
                >
                  ล้างตัวกรอง
                </Button>
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
                      <TableCell width={140} align="right">
                        Weight In ( Kg. )
                      </TableCell>
                      <TableCell width={180} align="right">
                        Weight Out ( Kg. )
                      </TableCell>
                      <TableCell width={110} align="center">
                        Action
                      </TableCell>
                      {/* ✅ คอลัมน์ Status ต่อท้ายปุ่ม */}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={`sk-${i}`}>
                          <TableCell colSpan={10}>
                            <Skeleton height={24} />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10}>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            align="center"
                          >
                            ไม่มีรายการตามเงื่อนไข
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r) => {
                        const trailer = isTrailer(r.truckType);
                        const alreadyOut = trailer
                          ? r.weightOutHead != null &&
                            r.weightOutTrailer != null
                          : r.weightOut != null;

                        const weightInText = trailer
                          ? `${r.weightInHead?.toLocaleString() ?? "-"} / ${r.weightInTrailer?.toLocaleString() ?? "-"}`
                          : r.weightIn != null
                            ? r.weightIn.toLocaleString()
                            : "-";

                        const weightOutText = trailer
                          ? `${r.weightOutHead?.toLocaleString() ?? "-"} / ${r.weightOutTrailer?.toLocaleString() ?? "-"}`
                          : r.weightOut != null
                            ? r.weightOut.toLocaleString()
                            : "-";

                        return (
                          <TableRow key={r.id} hover>
                            <TableCell>{r.bookingCode}</TableCell>
                            <TableCell align="center">
                              {r.sequence ?? "-"}
                            </TableCell>
                            <TableCell>
                              {r.startTime}
                              {r.endTime ? ` - ${r.endTime}` : ""}
                            </TableCell>
                            <TableCell
                              sx={{ maxWidth: 300 }}
                              title={supplierText(r)}
                            >
                              <Typography variant="body2" noWrap>
                                {supplierText(r)}
                              </Typography>
                            </TableCell>
                            <TableCell>{r.truckRegister || "-"}</TableCell>
                            <TableCell>{r.truckType || "-"}</TableCell>

                            <TableCell align="right">{weightInText}</TableCell>
                            <TableCell align="right">{weightOutText}</TableCell>

                            <TableCell align="center">
                              {alreadyOut ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="inherit"
                                  startIcon={<EditOutlinedIcon />}
                                  onClick={() => openDialog(r)}
                                  sx={{ borderRadius: RADIUS }}
                                >
                                  แก้ไข
                                </Button>
                              ) : (
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="secondary"
                                  startIcon={<SaveAltIcon />}
                                  onClick={() => openDialog(r)}
                                  sx={{ borderRadius: RADIUS }}
                                >
                                  บันทึก
                                </Button>
                              )}
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
                รวม {rows.length.toLocaleString()} รายการ • รอบันทึก{" "}
                {pendingCount.toLocaleString()} / {totalCount.toLocaleString()}{" "}
                ทั้งหมด
              </Alert>
            </Paper>

            {/* Dialog */}
            <WeightOutDialog
              open={dlgOpen}
              onClose={() => setDlgOpen(false)}
              trailer={isTrailer(dlgRow?.truckType)}
              initial={
                dlgRow
                  ? {
                      weight_out: dlgRow.weightOut ?? null,
                      weight_out_head: dlgRow.weightOutHead ?? null,
                      weight_out_trailer: dlgRow.weightOutTrailer ?? null,
                    }
                  : { weight_out: null }
              }
              onSave={handleSave}
            />

            {/* Snackbar */}
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
