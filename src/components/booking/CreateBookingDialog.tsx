"use client";

import {
  Alert,
  AlertTitle,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormLabel,
  MenuItem,
  TextField,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs, { Dayjs } from "dayjs";
import { useSession } from "next-auth/react";
import * as React from "react";

/* ===== API base ===== */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "") || "";
const api = (path: string) =>
  `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

/* ===== Types ===== */
export type Supplier = {
  _id: string;
  supCode: string;
  title?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  licensePlate?: string;
};

export type CreateBookingPayload = {
  supplier: Supplier | null;
  bookingCode: string;
  queue: number | "";
  licensePlate: string;
  truckType: string;
  rubberType: string;
  rubberTypeName?: string;
  recorderName: string;
  startTime: Date | null;
  endTime: Date | null;
  date: Date | null;
};

type RubberTypeItem = { _id: string; name: string };

/* ===== Constants ===== */
const TRUCK_TYPES = [
  "รถกระบะ",
  "6 ล้อ",
  "10 ล้อ",
  "10 ล้อ (พ่วง)",
  "รถเทรลเลอร์",
] as const;

/* ===== small utils ===== */
const normalize = (s?: string) => (s || "").trim().toLowerCase();

function toISO(d: Date | null) {
  return d ? dayjs(d).format("YYYY-MM-DD") : null;
}
function parseSlotToDates(slot: string, baseDate: Date) {
  const m = slot.match(/^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/);
  const d = new Date(baseDate);
  const start = new Date(d);
  const end = new Date(d);
  if (!m) {
    start.setHours(8, 0, 0, 0);
    end.setHours(9, 0, 0, 0);
    return { start, end };
  }
  const [, sh, sm, eh, em] = m;
  start.setHours(Number(sh), Number(sm), 0, 0);
  end.setHours(Number(eh), Number(em), 0, 0);
  return { start, end };
}
function fmtHM(dt: Date | null | undefined) {
  if (!dt) return "";
  return `${String(dt.getHours()).padStart(2, "0")}:${String(
    dt.getMinutes()
  ).padStart(2, "0")}`;
}
function add1h(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  d.setHours(d.getHours() + 1);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

/* ===== user name helpers ===== */
function toTitleCase(s: string) {
  return s
    .split(/\s+/)
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : p))
    .join(" ");
}
function handleToFirstName(raw: string) {
  if (!raw) return "";
  let s = String(raw).trim();
  const at = s.indexOf("@");
  if (at > 0) s = s.slice(0, at);
  s = s.split(/[._-]/)[0] || s;
  if (/^\d+$/.test(s) || s.length < 2) return "";
  return toTitleCase(s);
}
function fullNameFrom(u: any | null | undefined) {
  if (!u) return "";
  const first =
    u.firstName ?? u.first_name ?? u.given_name ?? u.givenName ?? u.name ?? "";
  const last = u.lastName ?? u.last_name ?? u.family_name ?? u.familyName ?? "";
  let f = String(first || "").trim();
  const l = String(last || "").trim();
  if (!u.firstName && !u.first_name && f && !/\s/.test(f))
    f = handleToFirstName(f) || f;
  return f && l ? `${f} ${l}` : (f || l || "").trim();
}

/* ===== Props ===== */
type Props<TSlot extends readonly string[]> = {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: CreateBookingPayload | null) => void;
  date: Date | null;
  setDate: (d: Date | null) => void;
  timeSlots: TSlot;
  selectedSlot: TSlot[number];
  setSelectedSlot: (s: TSlot[number]) => void;
  supplierApiUrl?: string;
  fallbackOnError?: boolean;
  authHeaders?: () => HeadersInit;
  resetToken?: number;
  mode?: "create" | "edit";
  initial?: Partial<{
    supplierId: string;
    supplierSupCode: string;
    bookingCode: string;
    queue: number;
    licensePlate: string;
    truckType: string;
    rubberTypeId: string;
    rubberTypeName: string;
    recorderName: string;
    dateISO: string;
    startHM: string;
    endHM: string;
  }>;
};

export default function CreateBookingDialog<TSlot extends readonly string[]>({
  open,
  onClose,
  onConfirm,
  date,
  setDate,
  timeSlots,
  selectedSlot,
  supplierApiUrl = api("/api/bookings/suppliers?page=1&limit=100"),
  fallbackOnError = true,
  authHeaders,
  resetToken,
  mode = "create",
  initial,
}: Props<TSlot>) {
  const { data: session } = useSession();

  // ----- auth headers ref -----
  const authHeadersRef = React.useRef<() => HeadersInit>(() => ({}));
  React.useEffect(() => {
    authHeadersRef.current = authHeaders ?? (() => ({}));
  }, [authHeaders]);

  // suppliers
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [loadingSup, setLoadingSup] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [selectedSupplier, setSelectedSupplier] =
    React.useState<Supplier | null>(null);

  // rubber types
  const [rubberTypes, setRubberTypes] = React.useState<RubberTypeItem[]>([]);
  const [rtLoading, setRtLoading] = React.useState(false);
  const [rtError, setRtError] = React.useState<string | null>(null);

  // form fields
  const [startTime, setStartTime] = React.useState<Date | null>(null);
  const [endTime, setEndTime] = React.useState<Date | null>(null);
  const [bookingCode, setBookingCode] = React.useState("");
  const [queue, setQueue] = React.useState<number | "">("");
  const [licensePlate, setLicensePlate] = React.useState("");
  const [truckType, setTruckType] = React.useState<string>("");
  const [rubberType, setRubberType] = React.useState<string>("");
  const [rubberTypeName, setRubberTypeName] = React.useState<string>("");
  const [recorderName, setRecorderName] = React.useState<string>("");

  // slot state
  const [slotError, setSlotError] = React.useState<string | null>(null);

  /* ============ helpers ============ */
  async function fetchFirstJSON<T>(urls: string[], init?: RequestInit) {
    let lastErr: Error | null = null;
    for (const u of urls) {
      try {
        const res = await fetch(u, {
          ...init,
          headers: { Accept: "application/json", ...(init?.headers || {}) },
        });
        const txt = await res.text().catch(() => "");
        if (!res.ok) {
          if (res.status === 404) {
            lastErr = new Error(`HTTP 404 - ${txt || u}`);
            continue;
          }
          throw new Error(`HTTP ${res.status}${txt ? ` - ${txt}` : ""}`);
        }
        if (
          !(res.headers.get("content-type") || "").includes("application/json")
        ) {
          throw new Error(`Non-JSON from ${u}`);
        }
        return JSON.parse(txt) as T;
      } catch (e: any) {
        lastErr = e;
      }
    }
    throw lastErr ?? new Error("fetch failed");
  }

  function resolveSlotLabelForEdit(base: Date) {
    let sh = (initial?.startHM || "").trim();
    let eh = (initial?.endHM || "").trim();
    if (sh && (!eh || eh === sh)) {
      const found = (timeSlots as readonly string[]).find((s) =>
        s.startsWith(sh)
      );
      if (found) {
        const m = found.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
        if (m) eh = m[2];
      } else {
        eh = add1h(sh);
      }
    }
    return sh && eh ? `${sh} - ${eh}` : String(selectedSlot);
  }

  /* ===== Reset เมื่อเปิด / initial เปลี่ยน ===== */
  React.useEffect(() => {
    if (!open) return;
    let base = date ?? new Date();
    let slotLabel = String(selectedSlot);
    if (mode === "edit" && initial?.dateISO) {
      base = dayjs(initial.dateISO).toDate();
      slotLabel = resolveSlotLabelForEdit(base);
    }
    const { start, end } = parseSlotToDates(slotLabel, base);
    setStartTime(start);
    setEndTime(end);

    setBookingCode(initial?.bookingCode ?? "");
    setQueue(
      typeof initial?.queue === "number" && !Number.isNaN(initial.queue)
        ? initial.queue
        : ""
    );
    setLicensePlate(initial?.licensePlate ?? "");
    const initialTruck = (initial?.truckType ?? "").trim();
    setTruckType(
      (TRUCK_TYPES as readonly string[]).includes(initialTruck)
        ? initialTruck
        : ""
    );

    if (mode === "edit") {
      setRubberType(initial?.rubberTypeId ?? "");
      setRubberTypeName(initial?.rubberTypeName ?? "");
    } else {
      setRubberType("");
      setRubberTypeName("");
    }

    const fullname = initial?.recorderName ?? fullNameFrom(session?.user);
    if (fullname) setRecorderName(fullname);
    setSlotError(null);
  }, [
    open,
    resetToken,
    mode,
    initial,
    session?.user,
    date,
    selectedSlot,
    timeSlots,
  ]);

  React.useEffect(() => {
    if (!open) return;
    if (mode !== "edit") return;
    if (!initial?.dateISO) return;
    setDate(dayjs(initial.dateISO).toDate());
  }, [open, mode, initial?.dateISO, setDate]);

  React.useEffect(() => {
    if (selectedSupplier?.licensePlate)
      setLicensePlate(selectedSupplier.licensePlate);
  }, [selectedSupplier]);

  /* ===== โหลด Supplier และตั้งค่า preselect ===== */
  React.useEffect(() => {
    if (!open) return;

    const seedUrl = (() => {
      try {
        return new URL(
          supplierApiUrl.startsWith("http")
            ? supplierApiUrl
            : new URL(supplierApiUrl, window.location.origin).toString()
        ).toString();
      } catch {
        return supplierApiUrl;
      }
    })();

    const candidates = [
      seedUrl,
      seedUrl.replace("/bookings/", "/"),
      api("/api/bookings/suppliers?page=1&limit=100"),
      api("/api/suppliers?page=1&limit=100"),
      api("/api/bookings/supplier?page=1&limit=100"),
      api("/api/supplier?page=1&limit=100"),
      api("/api/vendors?page=1&limit=100"),
      api("/api/bookings/vendors?page=1&limit=100"),
    ].filter((v, i, a) => !!v && a.indexOf(v) === i);

    let alive = true;
    const ctrl = new AbortController();

    (async () => {
      try {
        setLoadingSup(true);
        setLoadError(null);

        const raw = await fetchFirstJSON<any>(candidates, {
          method: "GET",
          credentials: "include",
          signal: ctrl.signal,
          headers: { ...authHeadersRef.current() },
          cache: "no-store",
        });

        const listRaw: any[] =
          (Array.isArray(raw) && raw) ||
          raw?.items ||
          raw?.data ||
          raw?.results ||
          raw?.docs ||
          [];

        const list: Supplier[] = listRaw
          .map((s) => {
            const id = String(s._id ?? s.id ?? s.pk ?? "").trim();
            const supCode = String(
              s.supCode ?? s.code ?? s.supplier_code ?? ""
            ).trim();
            const firstName = String(
              s.firstName ?? s.name ?? s.first_name ?? ""
            );
            const lastName = String(s.lastName ?? s.last_name ?? "");
            const displayName =
              String(
                s.displayName ??
                  s.name ??
                  `${s.title ?? ""}${firstName} ${lastName}`.trim()
              ) || "";
            return {
              _id: id,
              supCode,
              title: s.title,
              firstName,
              lastName,
              displayName,
              licensePlate: s.licensePlate ?? s.license_plate ?? s.plate ?? "",
            } as Supplier;
          })
          // เก็บเฉพาะที่พอแสดงผลได้
          .filter((s) => !!s._id && (s.supCode || s.displayName));

        if (!alive) return;
        setSuppliers(list);

        // ✅ ตั้งค่า value ตอนแก้ไข: เทียบได้ทั้ง id และ supCode
        if (mode === "edit") {
          const wantId = (initial?.supplierId || "").trim();
          const wantCode = normalize(initial?.supplierSupCode);
          let found: Supplier | undefined;
          if (wantId) {
            found = list.find((x) => String(x._id) === wantId);
          }
          if (!found && wantCode) {
            found = list.find((x) => normalize(x.supCode) === wantCode);
          }
          setSelectedSupplier(found || null);
          if (found?.licensePlate) setLicensePlate(found.licensePlate);
        } else {
          setSelectedSupplier(null);
        }
      } catch (e: any) {
        if (!alive) return;
        setLoadError(e?.message || "fetch error");
        if (fallbackOnError) {
          const demo: Supplier[] = [
            {
              _id: "demo-1",
              supCode: "SUP001",
              title: "นาย",
              firstName: "สมชาย",
              lastName: "ใจดี",
              displayName: "SUP001 : นายสมชาย ใจดี",
              licensePlate: "1กก-1234",
            },
            {
              _id: "demo-2",
              supCode: "SUP002",
              title: "นาง",
              firstName: "สมหญิง",
              lastName: "ตั้งใจ",
              displayName: "SUP002 : นางสมหญิง ตั้งใจ",
              licensePlate: "2ขข-5678",
            },
          ];
          setSuppliers(demo);

          // ถ้า initial มีค่า ลองตั้งจากเดโม่
          if (mode === "edit") {
            const wantId = (initial?.supplierId || "").trim();
            const wantCode = normalize(initial?.supplierSupCode);
            const found =
              demo.find((x) => x._id === wantId) ||
              demo.find((x) => normalize(x.supCode) === wantCode) ||
              null;
            setSelectedSupplier(found);
            if (found?.licensePlate) setLicensePlate(found.licensePlate);
          }
        }
      } finally {
        if (alive) setLoadingSup(false);
      }
    })();

    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [
    open,
    supplierApiUrl,
    fallbackOnError,
    resetToken,
    mode,
    initial?.supplierId,
    initial?.supplierSupCode,
  ]);

  /* ===== โหลด Rubber Types ===== */
  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    const ctrl = new AbortController();
    (async () => {
      try {
        setRtLoading(true);
        setRtError(null);
        const raw = await fetchFirstJSON<any[]>(
          [api("/api/bookings/rubber-types"), api("/api/rubber-types")],
          {
            method: "GET",
            cache: "no-store",
            signal: ctrl.signal,
            credentials: "include",
            headers: { Accept: "application/json" },
          }
        );
        const data: RubberTypeItem[] = Array.isArray(raw)
          ? raw
              .map((r: any) => ({
                _id: String(r?._id ?? ""),
                name: String(r?.name ?? ""),
              }))
              .filter((r) => r._id && r.name)
          : [];
        if (!alive) return;
        setRubberTypes(data);

        if (mode === "edit") {
          let chosenId = "";
          let chosenName = "";
          const byId = data.find((r) => r._id === initial?.rubberTypeId);
          if (byId) {
            chosenId = byId._id;
            chosenName = byId.name;
          }
          if (!chosenId && initial?.rubberTypeName) {
            const byName = data.find(
              (r) => normalize(r.name) === normalize(initial.rubberTypeName)
            );
            if (byName) {
              chosenId = byName._id;
              chosenName = byName.name;
            }
          }
          if (!chosenId && initial?.rubberTypeId) {
            const byName2 = data.find(
              (r) => normalize(r.name) === normalize(initial.rubberTypeId)
            );
            if (byName2) {
              chosenId = byName2._id;
              chosenName = byName2.name;
            }
          }
          setRubberType(chosenId || "");
          setRubberTypeName(chosenName || initial?.rubberTypeName || "");
        }
      } catch (e: any) {
        if (!alive) return;
        setRtError(e?.message || "load error");
        setRubberTypes([]);
      } finally {
        if (alive) setRtLoading(false);
      }
    })();
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [open, mode, initial?.rubberTypeId, initial?.rubberTypeName]);

  /* ===== next-sequence (โหมดสร้าง) ===== */
  React.useEffect(() => {
    if (!open) return;
    if (mode !== "create") return;
    const iso = toISO(date ?? new Date());
    const startHM = fmtHM(startTime);
    if (!iso || !startHM) return;
    let alive = true;
    const ctrl = new AbortController();
    (async () => {
      try {
        setSlotError(null);
        const url = api(
          `/api/bookings/next-sequence?date=${encodeURIComponent(
            iso
          )}&start_time=${encodeURIComponent(startHM)}`
        );
        const r = await fetch(url, {
          cache: "no-store",
          signal: ctrl.signal,
          headers: { Accept: "application/json" },
          credentials: "include",
        });
        const text = await r.text().catch(() => "");
        const json = text
          ? (() => {
              try {
                return JSON.parse(text);
              } catch {
                return {};
              }
            })()
          : {};
        if (!alive) return;
        if (!r.ok) {
          setSlotError("ช่วงเวลานี้เต็มแล้ว — กรุณาเลือกช่วงเวลาอื่น");
          setQueue("");
          setBookingCode("");
          return;
        }
        const nextSeq: number | null =
          (typeof json?.next_sequence === "number" && json.next_sequence) ||
          (typeof json?.sequence === "number" && json.sequence) ||
          null;
        if (nextSeq || json?.unlimited) {
          const seq = nextSeq ?? 1;
          setQueue(seq);
          const YYYYMMDD = dayjs(iso).format("YYYYMMDD");
          const pad2 = (n: number) => String(n).padStart(2, "0");
          setBookingCode(`${YYYYMMDD}${pad2(seq)}`);
          setSlotError(null);
        } else {
          setSlotError("ช่วงเวลานี้เต็มแล้ว — กรุณาเลือกช่วงเวลาอื่น");
          setQueue("");
          setBookingCode("");
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [open, resetToken, date, startTime, mode]);

  /* ====== UI ====== */
  const isCreate = mode === "create";
  const isLocked = isCreate && !!slotError;

  const FIELD_PROPS = { size: "small" as const, fullWidth: true };
  const fieldSx = { "& .MuiInputBase-root": { height: 40 } };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      keepMounted
      PaperProps={{ sx: { overflow: "visible", borderRadius: 3 } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>
        {mode === "edit" ? "แก้ไข Booking" : "สร้าง Booking"}
      </DialogTitle>

      <DialogContent sx={{ overflow: "visible", position: "relative" }}>
        {isLocked && (
          <Alert
            severity="error"
            sx={{
              mb: 2,
              borderRadius: 2,
              "& .MuiAlert-message": { width: "100%" },
            }}
          >
            <AlertTitle sx={{ fontWeight: 800, mb: 0.5 }}>
              ช่วงเวลานี้เต็มแล้ว
            </AlertTitle>
            กรุณาเลือกช่วงเวลาอื่น หรือเปลี่ยนวันที่ แล้วลองใหม่อีกครั้ง
          </Alert>
        )}

        <Box
          component="form"
          id="create-booking-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (isLocked) return;
            const payload: CreateBookingPayload = {
              supplier: selectedSupplier,
              bookingCode,
              queue,
              licensePlate,
              truckType,
              rubberType,
              rubberTypeName,
              recorderName,
              startTime,
              endTime,
              date,
            };
            onConfirm(payload);
          }}
          className="grid gap-4 pt-2 md:grid-cols-2"
          sx={{ position: "relative" }}
        >
          {/* Row 1: Start / End */}
          <FormControl className="w-full">
            <FormLabel>Start Time *</FormLabel>
            <TextField
              {...FIELD_PROPS}
              sx={fieldSx}
              value={fmtHM(startTime)}
              inputProps={{ readOnly: true }}
              disabled={isLocked}
            />
          </FormControl>
          <FormControl className="w-full">
            <FormLabel>End Time *</FormLabel>
            <TextField
              {...FIELD_PROPS}
              sx={fieldSx}
              value={fmtHM(endTime)}
              inputProps={{ readOnly: true }}
              disabled={isLocked}
            />
          </FormControl>

          {/* Row 2: Date / Supplier */}
          <FormControl className="w-full">
            <FormLabel>Date *</FormLabel>
            <DatePicker
              value={date ? dayjs(date) : null}
              onChange={(v: Dayjs | null) => setDate(v ? v.toDate() : null)}
              reduceAnimations
              disabled={isLocked}
              format="DD-MMM-YYYY"
              slotProps={{
                textField: { ...FIELD_PROPS, sx: fieldSx },
                popper: {
                  disablePortal: true,
                  placement: "bottom-start",
                  modifiers: [{ name: "offset", options: { offset: [0, 8] } }],
                  sx: { zIndex: (t) => t.zIndex.modal + 2 },
                },
              }}
            />
          </FormControl>

          <FormControl className="w-full">
            <FormLabel>Supplier *</FormLabel>
            <Autocomplete<Supplier>
              key={`${open}-${initial?.supplierId || ""}-${initial?.supplierSupCode || ""}-${suppliers.length}`}
              disablePortal
              value={selectedSupplier}
              onChange={(_, v) => setSelectedSupplier(v)}
              options={suppliers}
              loading={loadingSup}
              filterOptions={(x) => x}
              autoHighlight
              openOnFocus
              getOptionLabel={(o) =>
                o
                  ? `${o.supCode}${
                      o.displayName ? " : " + o.displayName : ""
                    }`.trim() ||
                    o.displayName ||
                    ""
                  : ""
              }
              // ✅ เทียบได้ทั้ง _id และ supCode (กันกรณี object ไม่อ้างอิงกัน)
              isOptionEqualToValue={(a, b) =>
                (a?._id ?? "") === (b?._id ?? "") ||
                normalize(a?.supCode) === normalize(b?.supCode)
              }
              ListboxProps={{ style: { maxHeight: 300, overflow: "auto" } }}
              disabled={isLocked}
              renderInput={(params) => (
                <TextField
                  {...params}
                  {...FIELD_PROPS}
                  sx={fieldSx}
                  placeholder="คลิกเพื่อดูรายชื่อ"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingSup ? <CircularProgress size={18} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                  helperText={
                    loadError
                      ? `โหลดรายชื่อผิดพลาด: ${loadError}${
                          fallbackOnError ? " (แสดงรายชื่อเดโม่)" : ""
                        }`
                      : undefined
                  }
                />
              )}
              noOptionsText={loadingSup ? "กำลังโหลด..." : "ไม่มีรายการ"}
              slotProps={{
                popper: {
                  disablePortal: true,
                  modifiers: [{ name: "offset", options: { offset: [0, 8] } }],
                  sx: { zIndex: (t) => t.zIndex.modal + 2 },
                },
              }}
            />
          </FormControl>

          {/* Row 3: Booking Code / Queue */}
          <FormControl className="w-full">
            <FormLabel>Booking Code *</FormLabel>
            <TextField
              {...FIELD_PROPS}
              sx={fieldSx}
              value={bookingCode}
              onChange={(e) => setBookingCode(e.target.value)}
              inputProps={{ readOnly: true }}
              disabled={isLocked}
              error={isLocked}
              helperText={isLocked ? "ช่วงเวลานี้เต็มแล้ว" : undefined}
            />
          </FormControl>
          <FormControl className="w-full">
            <FormLabel>Queue *</FormLabel>
            <TextField
              {...FIELD_PROPS}
              sx={fieldSx}
              type="number"
              value={queue}
              onChange={(e) =>
                setQueue(e.target.value === "" ? "" : Number(e.target.value))
              }
              inputProps={{ min: 0, readOnly: true }}
              disabled={isLocked}
              error={isLocked}
            />
          </FormControl>

          {/* Row 4: License Plate / Truck Type */}
          <FormControl className="w-full">
            <FormLabel>License Plate *</FormLabel>
            <TextField
              {...FIELD_PROPS}
              sx={fieldSx}
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value)}
              disabled={isLocked}
            />
          </FormControl>
          <FormControl className="w-full">
            <FormLabel>Truck Type *</FormLabel>
            <TextField
              {...FIELD_PROPS}
              sx={fieldSx}
              select
              value={truckType}
              onChange={(e) => setTruckType(e.target.value)}
              disabled={isLocked}
            >
              <MenuItem value="" disabled>
                Select Truck Type
              </MenuItem>
              {TRUCK_TYPES.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>
          </FormControl>

          {/* Row 5: Type (Rubber) / Recorder */}
          <FormControl className="w-full">
            <FormLabel>
              Type *{" "}
              {rtLoading ? "(กำลังโหลด…)" : rtError ? "(โหลดไม่สำเร็จ)" : ""}
            </FormLabel>
            <TextField
              {...FIELD_PROPS}
              sx={fieldSx}
              select
              value={rubberType}
              onChange={(e) => {
                const id = e.target.value;
                setRubberType(id);
                const found = rubberTypes.find((r) => r._id === id);
                setRubberTypeName(found?.name || "");
              }}
              disabled={
                rtLoading || !!rtError || rubberTypes.length === 0 || isLocked
              }
              helperText={
                rtError
                  ? "โหลดรายการ Rubber Types ไม่สำเร็จ — โปรดลองรีเฟรชหน้า"
                  : undefined
              }
            >
              <MenuItem value="" disabled>
                Select Rubber Type
              </MenuItem>
              {rubberTypes.map((t) => (
                <MenuItem key={t._id} value={t._id}>
                  {t.name}
                </MenuItem>
              ))}
            </TextField>
          </FormControl>

          <FormControl className="w-full">
            <FormLabel>Recorder Name</FormLabel>
            <TextField
              {...FIELD_PROPS}
              sx={fieldSx}
              value={recorderName}
              inputProps={{ readOnly: true }}
              onChange={(e) => setRecorderName(e.target.value)}
              disabled={isLocked}
            />
          </FormControl>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>ยกเลิก</Button>
        <Button
          variant="contained"
          color={mode === "edit" ? "warning" : "success"}
          type="submit"
          form="create-booking-form"
          disabled={
            rtLoading || !!rtError || rubberTypes.length === 0 || isLocked
          }
        >
          {mode === "edit" ? "Save Changes" : "Save Booking"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
