// src/app/cuplump-received/page.tsx
"use client";

import FusePageSimple from "@fuse/core/FusePageSimple";
import PrintIcon from "@mui/icons-material/Print";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveAltIcon from "@mui/icons-material/SaveAlt";
import {
  Box,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";
import { useRouter } from "next/navigation";
import * as React from "react";

/* ========== CONFIG ========== */
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://database-system.ytrc.co.th/api";

const api = (path: string) =>
  `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

const EVENTS_API = (dateISO: string) =>
  api(`/bookings/events?date=${encodeURIComponent(dateISO)}`);

const LOOKUP_API = (code: string) =>
  api(`/bookings/lookup?booking_code=${encodeURIComponent(code)}`);

const BOOKING_API = (id: string) => api(`/bookings/${id}`);
const RUBBER_TYPES_API = api("/bookings/rubber-types");

/* ========== TYPES ========== */
type EventRaw = any;

type Row = {
  id: string;
  dateISO: string;
  supplierLabel: string;
  date: string;
  rubberType: string; // แสดงผลแล้ว (รวมกรณีหัว/หาง)
  bookingCode?: string;

  grossWeight: string;
  netWeight: string;

  bookingId?: string | null;

  clLotNumber?: string | null;
  cpAvg?: number | null;
  drcEstimate?: number | null;
  drcRequested?: number | null;
  drcActual?: number | null;
};

type QualityBits = {
  clLotNumber: string | null;
  cpAvg: number | null;
  drcEstimate: number | null;
  drcRequested: number | null;
  drcActual: number | null;
};

type RubberTypeItem = { _id: string; name: string };

/* ========== UTILS ========== */
function getStoredToken(): string | undefined {
  try {
    if (typeof window !== "undefined") {
      const fromLS =
        window.localStorage.getItem("backend_access_token") ||
        window.localStorage.getItem("access_token");
      if (fromLS) return fromLS;
      const m = document.cookie
        ?.split(";")
        ?.map((s) => s.trim())
        ?.find(
          (s) =>
            s.startsWith("backend_access_token=") ||
            s.startsWith("access_token=")
        );
      if (m) return decodeURIComponent(m.split("=")[1]);
    }
  } catch {}
  return process.env.NEXT_PUBLIC_DEV_BACKEND_TOKEN || undefined;
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  const bearer = getStoredToken();
  if (bearer && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${bearer}`);
  }
  if (!headers.has("Content-Type") && !!init?.body) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
    headers,
  });
  const text = await res.text().catch(() => "");
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return ct.includes("application/json") ? (JSON.parse(text) as T) : ({} as T);
}

function firstDefined<T>(
  ...cands: Array<T | null | undefined | "">
): T | undefined {
  for (const c of cands)
    if (c !== undefined && c !== null && c !== "") return c as T;
  return undefined;
}
function asDayjs(v: unknown, fallback?: Dayjs | null) {
  const d = v ? dayjs(v as any) : null;
  if (d && d.isValid()) return d;
  return fallback ?? dayjs();
}
function numberOrNull(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function fmtPct2(v: number | null | undefined) {
  const n = numberOrNull(v as any);
  if (n == null) return "-";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  });
}
function coalesce<T>(...vals: Array<T | null | undefined>): T | null {
  for (const v of vals) if (v !== null && v !== undefined) return v as T;
  return null;
}

/* ========== QUALITY HELPERS ========== */
async function lookupBookingIdByCode(
  code?: string | null
): Promise<string | null> {
  if (!code) return null;
  try {
    const r = await fetchJSON<{ id?: string }>(LOOKUP_API(code));
    return r?.id || null;
  } catch {
    return null;
  }
}

function readQualityFromObj(obj: any): QualityBits {
  const empty: QualityBits = {
    clLotNumber: null,
    cpAvg: null,
    drcEstimate: null,
    drcRequested: null,
    drcActual: null,
  };
  if (!obj) return empty;
  const src = obj.quality ?? obj;
  return {
    clLotNumber:
      firstDefined<string>(
        src?.cl_lotnumber,
        src?.clLotNumber,
        src?.lotNumber
      ) ?? null,
    cpAvg:
      numberOrNull(firstDefined<number | string>(src?.cp_avg, src?.cpAvg)) ??
      null,
    drcEstimate:
      numberOrNull(
        firstDefined<number | string>(src?.drc_estimate, src?.drcEstimate)
      ) ?? null,
    drcRequested:
      numberOrNull(
        firstDefined<number | string>(src?.drc_requested, src?.drcRequested)
      ) ?? null,
    drcActual:
      numberOrNull(
        firstDefined<number | string>(src?.drc_actual, src?.drcActual)
      ) ?? null,
  };
}

async function fetchBookingQualityBits(
  id: string
): Promise<QualityBits | null> {
  try {
    const b = await fetchJSON<any>(BOOKING_API(id));
    const bits = readQualityFromObj(b);
    const hasAny =
      bits.clLotNumber != null ||
      bits.cpAvg != null ||
      bits.drcEstimate != null ||
      bits.drcRequested != null ||
      bits.drcActual != null;
    return hasAny ? bits : null;
  } catch {
    return null;
  }
}

/* ========== RUBBER TYPES (HEAD/TRAILER) ========== */
let RUBBER_MAP: Map<string, string> | null = null;
async function getRubberTypeMap(): Promise<Map<string, string>> {
  if (RUBBER_MAP) return RUBBER_MAP;
  try {
    const list = await fetchJSON<RubberTypeItem[]>(RUBBER_TYPES_API);
    RUBBER_MAP = new Map(
      (list || []).map((x) => [String(x._id), String(x.name)])
    );
  } catch {
    RUBBER_MAP = new Map();
  }
  return RUBBER_MAP!;
}

/* ========== NORMALIZE EVENT ========== */
function normalizeEvent(raw: EventRaw) {
  const xp = raw?.extendedProps ?? {};

  const bookingCode =
    firstDefined(xp?.booking_code, raw?.booking_code) || undefined;

  const supplierCode =
    firstDefined(xp?.supplier_code, raw?.supplier_code) || "";
  const supplierName =
    firstDefined(xp?.supplier_name, raw?.supplier_name) || "";
  const supplierLabel =
    supplierCode || supplierName
      ? `${supplierCode || "-"} : ${supplierName || "-"}`
      : "-";

  const rubberTypeName =
    firstDefined(
      xp?.rubber_type_name,
      raw?.rubber_type_name,
      raw?.rubber_type
    ) || "-";

  const startISO =
    firstDefined<string>(raw?.start, xp?.start, raw?.date, xp?.date) ||
    dayjs().toISOString();
  const dateISO = startISO.slice(0, 10);

  // น้ำหนัก
  const inSingle = firstDefined<number>(xp?.weight_in, raw?.weight_in);
  const inHead = firstDefined<number>(xp?.weight_in_head, raw?.weight_in_head);
  const inTrailer = firstDefined<number>(
    xp?.weight_in_trailer,
    raw?.weight_in_trailer
  );
  const outSingle = firstDefined<number>(xp?.weight_out, raw?.weight_out);
  const outHead = firstDefined<number>(
    xp?.weight_out_head,
    raw?.weight_out_head
  );
  const outTrailer = firstDefined<number>(
    xp?.weight_out_trailer,
    raw?.weight_out_trailer
  );

  // booking_id
  const bookingId =
    firstDefined(xp?.booking_id, raw?.booking_id, raw?.id) || null;

  // rubber type head/trailer (id)
  const rubberTypeHeadId = firstDefined<string>(
    xp?.rubber_type_head,
    raw?.rubber_type_head
  );
  const rubberTypeTrailerId = firstDefined<string>(
    xp?.rubber_type_trailer,
    raw?.rubber_type_trailer
  );

  // คุณภาพ (ถ้า BE ใส่มา)
  const clLotNumber = firstDefined(xp?.cl_lotnumber, raw?.cl_lotnumber) ?? null;
  const cpAvg = numberOrNull(firstDefined(xp?.cp_avg, raw?.cp_avg)) ?? null;
  const drcEstimate =
    numberOrNull(firstDefined(xp?.drc_estimate, raw?.drc_estimate)) ?? null;
  const drcRequested =
    numberOrNull(firstDefined(xp?.drc_requested, raw?.drc_requested)) ?? null;
  const drcActual =
    numberOrNull(firstDefined(xp?.drc_actual, raw?.drc_actual)) ?? null;

  return {
    supplierLabel,
    dateISO,
    rubberTypeName,

    rubberTypeHeadId: rubberTypeHeadId || null,
    rubberTypeTrailerId: rubberTypeTrailerId || null,

    inSingle,
    inHead,
    inTrailer,
    outSingle,
    outHead,
    outTrailer,

    bookingCode,
    bookingId,

    clLotNumber,
    cpAvg,
    drcEstimate,
    drcRequested,
    drcActual,
  };
}

/* ========== AGGREGATE (resolve rubber type display) ========== */
function aggregateRows(
  items: ReturnType<typeof normalizeEvent>[],
  typeMap: Map<string, string>
): Row[] {
  const rows: Row[] = [];

  for (const it of items) {
    let gross: string;
    let net: string;

    const hasTrailer =
      it.inHead != null ||
      it.inTrailer != null ||
      it.outHead != null ||
      it.outTrailer != null ||
      it.rubberTypeHeadId != null ||
      it.rubberTypeTrailerId != null;

    if (hasTrailer) {
      const inHead = it.inHead ?? 0;
      const inTrailer = it.inTrailer ?? 0;
      const outHead = it.outHead ?? 0;
      const outTrailer = it.outTrailer ?? 0;

      gross = `${inHead.toLocaleString()}/${inTrailer.toLocaleString()}`;
      net = `${(inHead - outHead).toLocaleString()}/${(
        inTrailer - outTrailer
      ).toLocaleString()}`;
    } else {
      const inSum = typeof it.inSingle === "number" ? it.inSingle : 0;
      const outSum = typeof it.outSingle === "number" ? it.outSingle : null;

      gross = inSum.toLocaleString();
      net =
        typeof outSum === "number"
          ? Math.max(0, inSum - outSum).toLocaleString()
          : "0";
    }

    // ---- Resolve rubber type label ----
    let rubberTypeDisplay = it.rubberTypeName || "-";
    const headName =
      (it as any).rubberTypeHeadId &&
      typeMap.get(String((it as any).rubberTypeHeadId));
    const trailerName =
      (it as any).rubberTypeTrailerId &&
      typeMap.get(String((it as any).rubberTypeTrailerId));

    if (headName || trailerName) {
      rubberTypeDisplay = `${headName || "-"} / ${trailerName || "-"}`;
    }

    rows.push({
      id: encodeURIComponent(
        `${it.supplierLabel}__${it.dateISO}__${rubberTypeDisplay}`
      ),
      dateISO: it.dateISO,
      supplierLabel: it.supplierLabel,
      date: dayjs(it.dateISO).format("DD-MMM-YYYY"),
      rubberType: rubberTypeDisplay,
      bookingCode: it.bookingCode,
      grossWeight: gross,
      netWeight: net,
      bookingId: it.bookingId ?? null,

      clLotNumber: it.clLotNumber,
      cpAvg: it.cpAvg,
      drcEstimate: it.drcEstimate,
      drcRequested: it.drcRequested,
      drcActual: it.drcActual,
    });
  }

  return rows;
}

/* ========== ENRICH (fallback: ถ้าไม่มีคุณภาพใน event ให้ดึง /bookings/:id) ========== */
async function enrichRowsWithQuality(base: Row[]): Promise<Row[]> {
  const out = [...base];

  const idCache = new Map<string, string>(); // bookingCode -> bookingId
  const qCache = new Map<string, QualityBits | null>(); // bookingId -> bits|null

  const CONCURRENCY = 5;
  let running = 0;
  const queue: Array<() => Promise<void>> = [];

  function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const exec = async () => {
        running++;
        try {
          const r = await fn();
          resolve(r);
        } catch (e) {
          reject(e);
        } finally {
          running--;
          next();
        }
      };
      queue.push(exec);
      next();
    });
  }
  function next() {
    while (running < CONCURRENCY && queue.length) queue.shift()!();
  }

  await Promise.all(
    out.map((row, idx) =>
      run(async () => {
        const haveAny =
          row.clLotNumber != null ||
          row.cpAvg != null ||
          row.drcEstimate != null ||
          row.drcRequested != null ||
          row.drcActual != null;

        if (haveAny) return;

        // หา bookingId
        let bookingId = row.bookingId ?? null;
        if (!bookingId) {
          const code = row.bookingCode ?? null;
          if (code) {
            if (idCache.has(code)) bookingId = idCache.get(code)!;
            else {
              const found = await lookupBookingIdByCode(code);
              if (found) {
                idCache.set(code, found);
                bookingId = found;
              }
            }
          }
        }
        if (!bookingId) return;

        let bits = qCache.get(bookingId);
        if (bits === undefined) {
          bits = await fetchBookingQualityBits(bookingId);
          qCache.set(bookingId, bits ?? null);
        }
        if (!bits) return;

        out[idx] = {
          ...row,
          clLotNumber: coalesce(row.clLotNumber, bits.clLotNumber),
          cpAvg: coalesce(row.cpAvg, bits.cpAvg),
          drcEstimate: coalesce(row.drcEstimate, bits.drcEstimate),
          drcRequested: coalesce(row.drcRequested, bits.drcRequested),
          drcActual: coalesce(row.drcActual, bits.drcActual),
        };
      })
    )
  );

  return out;
}

/* ========== MOCK (fallback manual) ========== */
const MOCK_EVENTS: EventRaw[] = [
  {
    date: "2025-09-11",
    extendedProps: {
      supplier_code: "0021",
      supplier_name: "นางสาวอุดม แก้วมณี",
      rubber_type_name: "EUDR CL",
      rubber_type_head: "HEAD_ID_1",
      rubber_type_trailer: "TRAIL_ID_1",
      weight_in_head: 25120,
      weight_in_trailer: 12422,
      weight_out_head: 1112,
      weight_out_trailer: 1023,
      booking_code: "MOCK-001",
      booking_id: "000000000000000000000001",
    },
  },
  {
    date: "2025-09-11",
    extendedProps: {
      supplier_code: "0078",
      supplier_name: "นายไชยคี มะทะ",
      rubber_type_name: "Regular CL",
      weight_in: 15000,
      weight_out: 14000,
      booking_code: "MOCK-002",
      cl_lotnumber: "C2025091102",
      cp_avg: 29.5,
      booking_id: "000000000000000000000002",
    },
  },
];

/* ========== PAGE ========== */
const LOCAL_STORAGE_DATE_KEY = "cuplump_received_list_date";

export default function CuplumpReceivedPage() {
  const router = useRouter();

  const [listDate, setListDate] = React.useState<Dayjs | null>(() => {
    if (typeof window === "undefined") return dayjs();
    try {
      const saved = window.localStorage.getItem(LOCAL_STORAGE_DATE_KEY);
      return saved ? asDayjs(saved, dayjs()) : dayjs();
    } catch {
      return dayjs();
    }
  });

  const listDateISO = React.useMemo(
    () => (listDate?.isValid() ? listDate : dayjs()).format("YYYY-MM-DD"),
    [listDate]
  );
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(false);

  const handleDateChange = (d: Dayjs | null) => {
    const v = asDayjs(d, listDate);
    setListDate(v);
    try {
      window.localStorage.setItem(LOCAL_STORAGE_DATE_KEY, v.toISOString());
    } catch {}
  };

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      // โหลด rubber type map ก่อน แล้วค่อย map event → row
      const typeMap = await getRubberTypeMap();

      const data = await fetchJSON<EventRaw[]>(EVENTS_API(listDateISO));
      const norm = (data || []).map(normalizeEvent);
      const base = aggregateRows(norm, typeMap);
      const enriched = await enrichRowsWithQuality(base);
      setRows(enriched);
    } catch {
      const typeMap = await getRubberTypeMap();
      const norm = MOCK_EVENTS.map(normalizeEvent);
      setRows(aggregateRows(norm, typeMap));
    } finally {
      setLoading(false);
    }
  }, [listDateISO]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <FusePageSimple
        header={
          <Box className="p-6">
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h5" fontWeight={800}>
                Cuplump Received List
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <DatePicker
                label="Date"
                value={listDate}
                onChange={handleDateChange}
                format="DD-MMM-YYYY"
              />
              <Tooltip title="Reload">
                <Button
                  startIcon={<RefreshIcon />}
                  variant="outlined"
                  onClick={loadData}
                  disabled={loading}
                >
                  Reload
                </Button>
              </Tooltip>
              <Tooltip title="Export CSV">
                <Button startIcon={<SaveAltIcon />} variant="contained">
                  Export
                </Button>
              </Tooltip>
              <Tooltip title="Print">
                <Button
                  startIcon={<PrintIcon />}
                  color="inherit"
                  variant="outlined"
                >
                  Print
                </Button>
              </Tooltip>
            </Stack>
          </Box>
        }
        content={
          <Box className="p-6">
            <Paper variant="outlined" sx={{ p: 2 }}>
              <TableContainer>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow
                      sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}
                    >
                      <TableCell>Date</TableCell>
                      <TableCell>CL Lotnumber</TableCell>
                      <TableCell>Supplier</TableCell>
                      <TableCell>Rubber Type</TableCell>
                      <TableCell align="right">Gross Weight ( Kg. )</TableCell>
                      <TableCell align="right">Net Weight ( Kg. )</TableCell>
                      <TableCell align="right">Avg.%CP</TableCell>
                      <TableCell align="right">DRC Estimate</TableCell>
                      <TableCell align="right">DRC Requested</TableCell>
                      <TableCell align="right">DRC Actual</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={10} align="center">
                          กำลังโหลด…
                        </TableCell>
                      </TableRow>
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={10}
                          align="center"
                          sx={{ opacity: 0.7 }}
                        >
                          ไม่มีข้อมูล
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r) => (
                        <TableRow
                          key={r.id}
                          hover
                          sx={{ cursor: "pointer" }}
                          onClick={() => {
                            const payload = {
                              dateISO: r.dateISO,
                              dateText: r.date,
                              supplier: r.supplierLabel,
                              rubberType: r.rubberType,
                              grossWeight: r.grossWeight,
                              netWeight: r.netWeight,
                              bookingCode: r.bookingCode,
                              cl_lotnumber: r.clLotNumber ?? "",
                              lotNumber: r.clLotNumber ?? "",
                              cpAvg: r.cpAvg ?? null,
                              drcEstimate: r.drcEstimate ?? null,
                              drcRequested: r.drcRequested ?? null,
                              drcActual: r.drcActual ?? null,
                            };
                            try {
                              sessionStorage.setItem(
                                "cuplump_selected",
                                JSON.stringify(payload)
                              );
                            } catch {}

                            const qs = new URLSearchParams({
                              date: r.dateISO,
                              supplier: r.supplierLabel,
                              rubberType: r.rubberType,
                            });
                            if (r.bookingCode)
                              qs.set("bookingCode", r.bookingCode);

                            // ใช้ router.push ตามเดิม
                            router.push(`/cuplump-received/${r.id}?${qs}`);
                          }}
                        >
                          <TableCell>{r.date}</TableCell>
                          <TableCell>{r.clLotNumber || "-"}</TableCell>
                          <TableCell>
                            <Typography color="primary">
                              {r.supplierLabel}
                            </Typography>
                          </TableCell>
                          <TableCell>{r.rubberType}</TableCell>
                          <TableCell align="right">{r.grossWeight}</TableCell>
                          <TableCell align="right">{r.netWeight}</TableCell>
                          <TableCell align="right">
                            {fmtPct2(r.cpAvg)}
                          </TableCell>
                          <TableCell align="right">
                            {fmtPct2(r.drcEstimate)}
                          </TableCell>
                          <TableCell align="right">
                            {fmtPct2(r.drcRequested)}
                          </TableCell>
                          <TableCell align="right">
                            {fmtPct2(r.drcActual)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>
        }
      />
    </LocalizationProvider>
  );
}
