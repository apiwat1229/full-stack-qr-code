"use client";

import CreateBookingDialog, {
  type CreateBookingPayload,
  type Supplier,
} from "@/components/booking/CreateBookingDialog";
import TicketDialog, {
  type TicketData,
} from "@/components/booking/TicketDialog";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Paper,
  Snackbar,
  Stack,
  Typography,
  type AlertColor,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs, { Dayjs } from "dayjs";
import { useSession } from "next-auth/react";
import * as React from "react";

/* ================= CONFIG ================= */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "") || "";
const api = (path: string) =>
  `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

const NEXT_SEQUENCE_API = (dateISO: string, start: string) =>
  api(
    `/api/bookings/next-sequence?date=${encodeURIComponent(
      dateISO
    )}&start_time=${encodeURIComponent(start)}`
  );
const CREATE_BOOKING_API = api(`/api/bookings`);
const UPDATE_BOOKING_API = (id: string) =>
  api(`/api/bookings?id=${encodeURIComponent(id)}`);
const DELETE_BOOKING_API = (id: string) =>
  api(`/api/bookings?id=${encodeURIComponent(id)}`);
const EVENTS_API = (dateISO: string) =>
  api(`/api/bookings/events?date=${encodeURIComponent(dateISO)}`);

/* ================= CONSTS ================= */
const TIME_SLOTS = [
  "08:00 - 09:00",
  "09:00 - 10:00",
  "10:00 - 11:00",
  "11:00 - 12:00",
  "13:00 - 14:00",
] as const;

/* ================= Styled ================= */
const Controls = styled(Paper)(({ theme }) => ({
  borderRadius: 10,
  padding: 12,
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  border: `1px solid ${theme.palette.divider}`,
  background: theme.palette.background.paper,
  [theme.breakpoints.up("md")]: { padding: 16 },
}));

const SlotButton = styled(Button)(({ theme }) => ({
  textTransform: "none",
  borderRadius: 10,
  minWidth: 132,
  height: 38,
  paddingInline: 14,
  fontWeight: 700,
  boxShadow: "none",
  borderColor: theme.palette.divider,
  color: theme.palette.text.primary,
  "&.MuiButton-outlined:hover": {
    borderColor: theme.palette.text.primary,
    background: theme.palette.action.hover,
  },
  "&.is-selected": {
    background: theme.palette.secondary.main,
    color: "#fff",
    borderColor: theme.palette.secondary.main,
  },
  "&.is-selected:hover": {
    background: theme.palette.secondary.dark,
    borderColor: theme.palette.secondary.dark,
  },
  [theme.breakpoints.down("sm")]: { minWidth: 116 },
}));

const BookingsGrid = styled("div")(({ theme }) => ({
  display: "grid",
  gap: 16,
  gridTemplateColumns: "1fr",
  [theme.breakpoints.up("sm")]: { gridTemplateColumns: "1fr 1fr" },
}));
const BookingCard = styled(Card)(({ theme }) => ({
  borderRadius: 12,
  borderColor: theme.palette.divider,
  "& .label": { fontWeight: 700 },
}));

/* ================= Utils ================= */
function fullNameFrom(u: any): string {
  if (!u) return "";
  const first =
    u.firstName ?? u.first_name ?? u.given_name ?? u.givenName ?? u.name ?? "";
  const last = u.lastName ?? u.last_name ?? u.family_name ?? u.familyName ?? "";
  const f = String(first || "").trim();
  const l = String(last || "").trim();
  return f && l ? `${f} ${l}` : (f || l || "").trim();
}
function toISODate(d: Date | null): string | null {
  if (!d) return null;
  return dayjs(d).format("YYYY-MM-DD");
}
function parseSlot(slot: string): { start: string; end: string } {
  const m = slot.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
  if (!m) return { start: "08:00", end: "09:00" };
  return { start: m[1], end: m[2] };
}
async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const ct = res.headers.get("content-type") || "";
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`HTTP ${res.status}${text ? ` - ${text}` : ""}`);
  if (!ct.includes("application/json")) throw new Error(`Non-JSON from ${url}`);
  return JSON.parse(text) as T;
}
function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/* ================= Types ================= */
type BookingItem = {
  _id?: string;
  queue: number | string;
  supCode: string;
  title?: string;
  firstName?: string;
  lastName?: string;
  truck?: string;
  truckType?: string;
  rubberTypeName?: string;
  rubberTypeId?: string;
  bookingCode?: string | number;
  recorder?: string;
  dateISO?: string | null;
  timeSlot?: string;
  supplierId?: string;
  startHM?: string;
  endHM?: string;
};

type ToastState = {
  open: boolean;
  msg: string;
  sev: AlertColor; // 'success' | 'info' | 'warning' | 'error'
};

/* ============ Item Card ============ */
function BookingItemCard({
  item,
  onTicket,
}: {
  item: BookingItem;
  onTicket?: () => void;
}) {
  const fullName =
    `${item.title ?? ""}${item.firstName ?? ""} ${item.lastName ?? ""}`.trim();
  const truckDisplay =
    item.truck || item.truckType
      ? `${item.truck || "-"}${item.truckType ? ` (${item.truckType})` : ""}`
      : "-";

  return (
    <BookingCard variant="outlined">
      <CardContent sx={{ py: 2.25 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 1,
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Queue : {item.queue}
          </Typography>
          {!!item.rubberTypeName && (
            <Chip
              label={item.rubberTypeName}
              size="small"
              sx={{ bgcolor: "#455a64", color: "#fff", fontWeight: 700 }}
            />
          )}
        </Box>
        <Divider sx={{ mb: 1 }} />
        <Stack spacing={0.75}>
          <Typography variant="body2">
            <span className="label">Code :</span> {item.supCode}
          </Typography>
          <Typography variant="body2">
            <span className="label">Name :</span> {fullName || "-"}
          </Typography>
          <Typography variant="body2">
            <span className="label">Truck :</span> {truckDisplay}
          </Typography>
          <Typography variant="body2">
            <span className="label">Booking Code :</span>{" "}
            {item.bookingCode || "-"}
          </Typography>
        </Stack>
        <Box
          sx={{
            mt: 1.25,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="body2">
            <span className="label">Recorder :</span> {item.recorder || "-"}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={onTicket}
            sx={{ borderRadius: 1, textTransform: "none", px: 2 }}
          >
            Ticket
          </Button>
        </Box>
      </CardContent>
    </BookingCard>
  );
}

/* ================= Page ================= */
export default function BookingWithSlotsPage() {
  const { data: session } = useSession();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogSeed, setDialogSeed] = React.useState<number>(0);
  const [dialogMode, setDialogMode] = React.useState<"create" | "edit">(
    "create"
  );
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [dialogInitial, setDialogInitial] =
    React.useState<
      React.ComponentProps<typeof CreateBookingDialog>["initial"]
    >();

  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<ToastState>({
    open: false,
    msg: "",
    sev: "success",
  });

  const [date, setDate] = React.useState<Date | null>(new Date());
  const [selectedSlot, setSelectedSlot] =
    React.useState<(typeof TIME_SLOTS)[number]>("08:00 - 09:00");
  const [items, setItems] = React.useState<BookingItem[]>([]);

  const [ticketOpen, setTicketOpen] = React.useState(false);
  const [ticketData, setTicketData] = React.useState<TicketData | null>(null);

  /** โหลด events แล้วกรองช่วงเวลา */
  const loadBookings = React.useCallback(
    async (dateISO: string, slot: string) => {
      const { start, end } = parseSlot(slot);
      const rows = await fetchJSON<any[]>(EVENTS_API(dateISO), {
        cache: "no-store",
        credentials: "include",
      });
      const mapped: (BookingItem & { _start: string })[] = rows
        .map((r: any, idx: number) => {
          const startHM = dayjs(r.start).format("HH:mm");
          const endHM = dayjs(r.end ?? r.start).format("HH:mm");
          const xp = r?.extendedProps ?? {};
          const seq =
            Number(
              xp.sequence ??
                xp.queue ??
                xp.order ??
                r.sequence ??
                r.queue ??
                r.order ??
                NaN
            ) || idx + 1;
          return {
            _id: r.id,
            queue: seq,
            supCode: xp.supplier_code ?? "-",
            firstName: xp.supplier_name ?? "",
            truck: xp.truck_register ?? "-",
            truckType: xp.truck_type ?? xp.truck_type_name ?? "",
            rubberTypeName: xp.rubber_type_name ?? xp.rubber_type ?? "",
            rubberTypeId: xp.rubber_type_id ?? xp.rubber_type ?? "",
            bookingCode: xp.booking_code ?? "",
            recorder: xp.recorded_by ?? "-",
            dateISO,
            timeSlot: `${start} - ${end}`,
            _start: startHM,
            supplierId: xp.supplier_id ?? xp.supplier ?? "",
            startHM,
            endHM,
          };
        })
        .filter((it) => it._start === start)
        .sort((a, b) => Number(a.queue) - Number(b.queue));

      setItems(mapped.map(({ _start, ...r }) => r));
    },
    []
  );

  React.useEffect(() => {
    const dateISO = toISODate(date);
    if (!dateISO) return;
    loadBookings(dateISO, selectedSlot).catch((e) =>
      setToast({
        open: true,
        msg: e.message || "โหลดรายการไม่สำเร็จ",
        sev: "error",
      })
    );
  }, [date, selectedSlot, loadBookings]);

  const handleDeleteTicket = async (data: TicketData) => {
    if (!data.bookingId) return;
    try {
      const res = await fetch(DELETE_BOOKING_API(data.bookingId), {
        method: "DELETE",
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok)
        throw new Error(
          (await res.text().catch(() => "")) || `HTTP ${res.status}`
        );
      const dateISO = toISODate(date)!;
      await loadBookings(dateISO, selectedSlot);
      setTicketOpen(false);
      setToast({ open: true, msg: "ลบรายการสำเร็จ", sev: "success" });
    } catch (e: any) {
      setToast({
        open: true,
        msg: `ลบไม่สำเร็จ: ${e?.message || "unknown"}`,
        sev: "error",
      });
    }
  };

  const handleEditTicket = (data: TicketData) => {
    const current = items.find((x) => x._id === data.bookingId);
    if (!current) {
      setToast({ open: true, msg: "ไม่พบข้อมูลรายการนี้บนหน้า", sev: "error" });
      return;
    }
    setTicketOpen(false);
    setTimeout(() => {
      setEditingId(String(current._id));
      setDialogMode("edit");
      setDialogSeed(Date.now());
      setDialogInitial({
        supplierId: current.supplierId ?? "",
        supplierSupCode: current.supCode ?? "",
        bookingCode: String(current.bookingCode ?? ""),
        queue: Number(current.queue ?? 1),
        licensePlate: String(current.truck ?? ""),
        truckType: String(current.truckType ?? ""),
        rubberTypeId: current.rubberTypeId ?? "",
        rubberTypeName: current.rubberTypeName ?? "",
        recorderName: String(current.recorder || ""),
        dateISO: current.dateISO,
        startHM: current.startHM,
        endHM: current.endHM,
      });
      setDialogOpen(true);
    }, 0);
  };

  const handleConfirm = async (payload: CreateBookingPayload | null) => {
    if (!payload || !payload.supplier) {
      setToast({ open: true, msg: "กรุณาเลือก Supplier ก่อน", sev: "error" });
      return;
    }
    if (!date) {
      setToast({ open: true, msg: "กรุณาเลือกวันที่", sev: "error" });
      return;
    }
    if (!payload.rubberType) {
      setToast({ open: true, msg: "กรุณาเลือก Rubber Type", sev: "error" });
      return;
    }

    const supplierId = (payload.supplier as Supplier)._id?.trim();
    if (!supplierId) {
      setToast({ open: true, msg: "Supplier id ไม่ถูกต้อง", sev: "error" });
      return;
    }

    const isoDate = toISODate(payload.date ?? date)!;
    const { start, end } = parseSlot(selectedSlot);

    try {
      setSaving(true);

      const startHM = dayjs(
        payload.startTime || `${isoDate}T${start}:00`
      ).format("HH:mm");
      const endHM = dayjs(payload.endTime || `${isoDate}T${end}:00`).format(
        "HH:mm"
      );

      if (dialogMode === "create") {
        const seq = await fetchJSON<{
          sequence: number | null;
          next_sequence: number | null;
          unlimited: boolean;
          count: number;
          error?: string;
        }>(NEXT_SEQUENCE_API(isoDate, startHM), {
          cache: "no-store",
          credentials: "include",
        });
        if (!seq.next_sequence && !seq.unlimited)
          throw new Error(seq.error || "ช่วงเวลานี้เต็มแล้ว");
        const sequence = seq.next_sequence ?? 1;
        const booking_code = `${dayjs(isoDate).format("YYYYMMDD")}${pad2(
          sequence
        )}`;

        const body = {
          date: isoDate,
          start_time: startHM,
          end_time: endHM,
          booking_code,
          sequence,
          user_name:
            (
              payload.recorderName ||
              fullNameFrom(session?.user as any) ||
              "-"
            ).trim() || "-",
          truck_register: (payload.licensePlate || "").trim(),
          truck_type: (payload.truckType || "").trim(),
          supplier: supplierId,
          rubber_type: payload.rubberType,
        };

        await fetchJSON<{ id: string }>(CREATE_BOOKING_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });

        await loadBookings(isoDate, selectedSlot);
        setDialogOpen(false);
        setToast({ open: true, msg: `บันทึก Booking สำเร็จ`, sev: "success" });
      } else {
        if (!editingId) throw new Error("missing booking id");

        const body = {
          date: isoDate,
          start_time: startHM,
          end_time: endHM,
          booking_code: String(payload.bookingCode || ""),
          sequence: Math.max(1, Number(payload.queue || 1)),
          user_name:
            (
              payload.recorderName ||
              fullNameFrom(session?.user as any) ||
              "-"
            ).trim() || "-",
          truck_register: (payload.licensePlate || "").trim(),
          truck_type: (payload.truckType || "").trim(),
          supplier: supplierId,
          rubber_type: payload.rubberType,
        };

        await fetchJSON<{ ok?: boolean }>(UPDATE_BOOKING_API(editingId), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });

        await loadBookings(isoDate, selectedSlot);
        setDialogOpen(false);
        setToast({ open: true, msg: `แก้ไข Booking สำเร็จ`, sev: "success" });
        setEditingId(null);
        setDialogMode("create");
        setDialogInitial(undefined);
      }
    } catch (e: any) {
      setToast({
        open: true,
        msg: `${
          dialogMode === "edit" ? "บันทึกการแก้ไขไม่สำเร็จ" : "บันทึกไม่สำเร็จ"
        }: ${e?.message || "unknown error"}`,
        sev: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: "auto" }}>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 1 }}>
        Create Booking
      </Typography>

      {/* Controls */}
      <Controls variant="outlined">
        <DatePicker
          label="Date"
          value={date ? dayjs(date) : null}
          onChange={(v: Dayjs | null) => setDate(v ? v.toDate() : null)}
          format="DD-MMM-YYYY"
          slotProps={{
            textField: {
              size: "small",
              sx: {
                width: 220,
                "& .MuiOutlinedInput-root": { borderRadius: 8 },
              },
            },
            popper: { disablePortal: true },
          }}
        />

        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          sx={{ flex: 1 }}
        >
          {TIME_SLOTS.map((slot) => {
            const selected = selectedSlot === slot;
            return (
              <SlotButton
                key={slot}
                variant="outlined"
                className={selected ? "is-selected" : undefined}
                onClick={() => setSelectedSlot(slot)}
              >
                {slot}
              </SlotButton>
            );
          })}
        </Stack>

        <Button
          onClick={() => {
            setEditingId(null);
            setDialogMode("create");
            setDialogInitial(undefined);
            setDialogSeed(Date.now());
            setDialogOpen(true);
          }}
          variant="contained"
          color="primary"
          disabled={saving}
          sx={{ borderRadius: 1, height: 38, px: 2.25, textTransform: "none" }}
        >
          + Create Booking
        </Button>
      </Controls>

      {/* Cards */}
      <Box sx={{ mt: 2 }}>
        <BookingsGrid>
          {items.map((it, idx) => (
            <BookingItemCard
              key={it._id || `${it.supCode}-${String(it.queue)}-${idx}`}
              item={it}
              onTicket={() => {
                const td: TicketData = {
                  bookingId: it._id,
                  queue: it.queue,
                  supCode: it.supCode,
                  title: it.title,
                  firstName: it.firstName,
                  lastName: it.lastName,
                  truck: it.truck,
                  rubberType: it.rubberTypeName,
                  bookingCode: it.bookingCode,
                  recorder: it.recorder,
                  date,
                  timeLabel: it.timeSlot,
                };
                setTicketData(td);
                setTicketOpen(true);
              }}
            />
          ))}
        </BookingsGrid>

        {!items.length && (
          <Paper
            variant="outlined"
            sx={{
              mt: 2,
              p: 3,
              borderRadius: 8,
              textAlign: "center",
              color: "text.secondary",
            }}
          >
            ยังไม่มีรายการในช่วงเวลานี้ — กด “+ สร้าง Booking” เพื่อเพิ่มรายการ
          </Paper>
        )}
      </Box>

      {/* Dialogs */}
      <CreateBookingDialog
        key={dialogSeed}
        resetToken={dialogSeed}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={handleConfirm}
        date={date}
        setDate={setDate}
        timeSlots={TIME_SLOTS}
        selectedSlot={selectedSlot}
        setSelectedSlot={setSelectedSlot}
        supplierApiUrl={api("/api/bookings/suppliers?page=1&limit=100")}
        mode={dialogMode}
        initial={dialogInitial}
        authHeaders={() => ({})}
      />

      <TicketDialog
        open={ticketOpen}
        onClose={() => setTicketOpen(false)}
        data={ticketData}
        onDelete={handleDeleteTicket}
        onEdit={handleEditTicket}
      />

      {/* Snackbar */}
      <Snackbar
        open={toast.open}
        autoHideDuration={2400}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        sx={{ mt: 8, mr: 2, zIndex: (theme) => theme.zIndex.modal + 1 }}
      >
        <Alert
          severity={toast.sev || "info"}
          variant="filled"
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          sx={{ color: "#fff", "& .MuiAlert-icon": { color: "#fff" } }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
