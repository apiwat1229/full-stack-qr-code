// src/components/booking/TicketDialog.tsx
"use client";

import FuseSvgIcon from "@fuse/core/FuseSvgIcon";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import * as htmlToImage from "html-to-image";
import React from "react";
import ReactDOM from "react-dom/client";
import TicketView from "./TicketView";

/* ================= Types ================= */
export type TicketData = {
  bookingId?: string; // ✅ id สำหรับลบ
  queue: number | string;
  supCode: string;
  title?: string;
  firstName?: string;
  lastName?: string;
  truck?: string;
  rubberType?: string;
  bookingCode?: string | number;
  date?: Date | null;
  timeLabel?: string;
  recorder?: string;
  startTime?: string;
};

export type TicketDialogProps = {
  open: boolean;
  onClose: () => void;
  data: TicketData | null;
  onEdit?: (data: TicketData) => void;
  onDelete?: (data: TicketData) => void; // ✅ parent จะยิง API ลบ
  onCopy?: (data: TicketData) => void;
  previewWidth?: number;
  exportWidth?: number;
};

/* ================= Helpers ================= */
function formatThaiDate(d?: Date | null): string {
  if (!d) return "-";
  const weekday = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    weekday: "long",
  }).format(d);
  const day = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "2-digit",
  }).format(d);
  const month = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    month: "short",
  }).format(d);
  const year = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    year: "numeric",
  }).format(d);
  return `( ${weekday} ) ${day} ${month} ${year}`;
}
function toFullName(t?: string, f?: string, l?: string) {
  const name = `${t ?? ""}${f ?? ""} ${l ?? ""}`.trim();
  return name || "-";
}
function timeFromSlot(timeLabel?: string, startTime?: string) {
  if (timeLabel) {
    const left = timeLabel.split(" - ")[0]?.trim();
    if (left) return left;
  }
  return startTime || "-";
}

/* ================= Dialog + Copy & Confirm Delete ================= */
function TicketDialogBase({
  open,
  onClose,
  data,
  onEdit,
  onDelete,
  onCopy,
  previewWidth = 360,
  exportWidth = 360,
}: TicketDialogProps) {
  const [copying, setCopying] = React.useState(false);
  const [copied, setCopied] = React.useState(false); // ✅ แสดงผลบนปุ่ม
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [toast, setToast] = React.useState<{
    open: boolean;
    msg: string;
    sev: "success" | "error" | "info";
  }>({ open: false, msg: "", sev: "success" });

  const hiddenId = React.useId();

  const handleCopy = React.useCallback(async () => {
    if (!data) return;
    setCopying(true);

    // สร้าง DOM ชั่วคราวสำหรับเรนเดอร์ Ticket เพื่อนำไปแปลงภาพ
    const container = document.createElement("div");
    container.setAttribute("id", hiddenId);
    container.setAttribute("aria-hidden", "true");
    Object.assign(container.style, {
      position: "fixed",
      inset: "0 auto auto -100000px",
      width: "0",
      height: "0",
      overflow: "hidden",
      background: "transparent",
      pointerEvents: "none",
      zIndex: "-1",
      contain: "content",
      willChange: "transform",
    } as CSSStyleDeclaration);
    document.body.appendChild(container);

    const root = ReactDOM.createRoot(container);
    root.render(
      <div id="ticket-export" style={{ display: "inline-block" }}>
        <TicketView
          dateObj={data.date ?? null}
          rubberType={data.rubberType || "-"}
          code={data.supCode}
          name={toFullName(data.title, data.firstName, data.lastName)}
          dateText={formatThaiDate(data.date)}
          timeText={timeFromSlot(data.timeLabel, data.startTime)}
          truck={data.truck || "-"}
          bookingCode={data.bookingCode ?? "-"}
          queue={data.queue}
          width={exportWidth}
          sx={{ boxShadow: "none" }}
        />
      </div>
    );

    // รอให้ DOM & ฟอนต์พร้อม
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r))
    );
    if ((document as any).fonts?.ready) {
      try {
        await (document as any).fonts.ready;
      } catch {}
    }

    const node = container.querySelector<HTMLDivElement>("#ticket-export");
    if (!node) {
      root.unmount();
      container.remove();
      setCopying(false);
      setToast({ open: true, msg: "คัดลอกไม่สำเร็จ", sev: "error" });
      return;
    }

    try {
      // แปลง DOM -> PNG Blob
      const blob: Blob | null = await (htmlToImage as any).toBlob(node, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: null,
      });
      if (!blob) throw new Error("toBlob failed");

      // พยายามคัดลอกเป็นรูปภาพแบบ native
      const canClipboardImage =
        "clipboard" in navigator &&
        typeof (window as any).ClipboardItem === "function";

      if (canClipboardImage) {
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({ "image/png": blob }),
        ]);
        onCopy?.(data);
        setToast({
          open: true,
          msg: "คัดลอกบัตรคิวเป็นรูปภาพแล้ว",
          sev: "success",
        });
      } else {
        // Fallback: ให้บันทึกรูปแทน แล้วบอกผู้ใช้
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ticket-${data.supCode}-${data.queue}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setToast({
          open: true,
          msg: "เบราว์เซอร์นี้ยังไม่รองรับการคัดลอกรูปภาพ — ได้ดาวน์โหลดไฟล์แทนแล้ว",
          sev: "info",
        });
      }

      // เปลี่ยนปุ่มเป็น “Copied ✓” ชั่วคราว
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setToast({ open: true, msg: "คัดลอกไม่สำเร็จ", sev: "error" });
    } finally {
      root.unmount();
      container.remove();
      setCopying(false);
    }
  }, [data, exportWidth, hiddenId, onCopy]);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        keepMounted
        scroll="paper"
        disablePortal
        disableScrollLock
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
        transitionDuration={0}
        PaperProps={{
          sx: {
            borderRadius: 2,
            position: "relative",
            willChange: "transform",
          },
        }}
        slotProps={{ backdrop: { transitionDuration: 0 } }}
      >
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ position: "absolute", right: 8, top: 8 }}
          aria-label="close"
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        <DialogTitle sx={{ fontWeight: 700, pr: 6 }}>
          Ticket Preview
        </DialogTitle>

        <DialogContent
          dividers
          sx={{ display: "flex", justifyContent: "center" }}
        >
          {open && data ? (
            <TicketView
              dateObj={data.date ?? null}
              rubberType={data.rubberType || "-"}
              code={data.supCode}
              name={toFullName(data.title, data.firstName, data.lastName)}
              dateText={formatThaiDate(data.date)}
              timeText={timeFromSlot(data.timeLabel, data.startTime)}
              truck={data.truck || "-"}
              bookingCode={data.bookingCode ?? "-"}
              queue={data.queue}
              width={previewWidth}
            />
          ) : null}
        </DialogContent>

        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ px: 2, py: 1.25 }}
        >
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<FuseSvgIcon>lucide:pencil</FuseSvgIcon>}
              onClick={() => data && onEdit?.(data)}
              sx={{ borderRadius: 1, textTransform: "none", px: 1.25 }}
            >
              Edit
            </Button>

            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<FuseSvgIcon>lucide:trash-2</FuseSvgIcon>}
              onClick={() => setConfirmOpen(true)}
              disabled={!data?.bookingId}
              sx={{ borderRadius: 1, textTransform: "none", px: 1.25 }}
            >
              Delete
            </Button>
          </Stack>

          <Button
            size="small"
            variant={copied ? "contained" : "outlined"}
            color={copied ? "success" : "inherit"}
            startIcon={
              copied ? (
                <CheckIcon fontSize="small" />
              ) : (
                <FuseSvgIcon>lucide:clipboard-copy</FuseSvgIcon>
              )
            }
            onClick={handleCopy}
            disabled={copying || !data}
            sx={{ borderRadius: 1, textTransform: "none", px: 1.25 }}
          >
            {copied ? "Copied" : copying ? "กำลังคัดลอก..." : "Copy Ticket"}
          </Button>
        </Stack>
      </Dialog>

      {/* Confirm Delete */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>ยืนยันการลบ</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ต้องการลบ Booking นี้หรือไม่? การลบจะไม่สามารถย้อนกลับได้
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)}>ยกเลิก</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (data) onDelete?.(data);
              setConfirmOpen(false);
            }}
          >
            ลบ
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar (แจ้งผลการคัดลอก/ดาวน์โหลด) */}
      <Snackbar
        open={toast.open}
        autoHideDuration={2200}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transitionDuration={0}
      >
        <Alert
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          severity={toast.sev}
          variant="filled"
          sx={{
            alignItems: "center",
            color: "#fff",
            "& .MuiAlert-icon": { color: "#fff" },
          }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </>
  );
}

/* ================= ลด re-render เกินเหตุ ================= */
function shallowEqual(a: any, b: any) {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

export default React.memo(TicketDialogBase, (prev, next) => {
  if (prev.open !== next.open) return false;
  if (prev.onClose !== next.onClose) return false;
  if (prev.onEdit !== next.onEdit) return false;
  if (prev.onDelete !== next.onDelete) return false;
  if (prev.onCopy !== next.onCopy) return false;
  if (prev.previewWidth !== next.previewWidth) return false;
  if (prev.exportWidth !== next.exportWidth) return false;
  return shallowEqual(prev.data, next.data);
});
