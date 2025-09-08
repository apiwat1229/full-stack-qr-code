// src/app/(control-panel)/check-out/checked/components/WeightOutDialog.tsx
"use client";

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import * as React from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  /** รถพ่วงหรือไม่ (พ่วง = กรอกหัว/หาง, เดี่ยว = กรอกรวม) */
  trailer?: boolean;
  /** ค่าเริ่มต้น (ถ้ามี) */
  initial?: {
    weight_out?: number | null;
    weight_out_head?: number | null;
    weight_out_trailer?: number | null;
  };
  /** callback เมื่อกดบันทึก (ยิง API ภายนอก) */
  onSave: (payload: {
    weight_out?: number | null;
    weight_out_head?: number | null;
    weight_out_trailer?: number | null;
  }) => Promise<void> | void;
};

const RADIUS = 1;

export default function WeightOutDialog({
  open,
  onClose,
  trailer = false,
  initial,
  onSave,
}: Props) {
  const [saving, setSaving] = React.useState(false);

  // state ตามประเภทรถ
  const [wOut, setWOut] = React.useState<string>("");
  const [wOutHead, setWOutHead] = React.useState<string>("");
  const [wOutTrailer, setWOutTrailer] = React.useState<string>("");

  React.useEffect(() => {
    if (open) {
      setSaving(false);
      setWOut(initial?.weight_out != null ? String(initial?.weight_out) : "");
      setWOutHead(
        initial?.weight_out_head != null ? String(initial?.weight_out_head) : ""
      );
      setWOutTrailer(
        initial?.weight_out_trailer != null
          ? String(initial?.weight_out_trailer)
          : ""
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // validation
  const numOrNull = (s: string) => {
    const t = s.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  };

  const invalidSingle =
    !trailer &&
    (Number.isNaN(numOrNull(wOut)) || (numOrNull(wOut) as number) < 0);

  const invalidHead =
    trailer &&
    (Number.isNaN(numOrNull(wOutHead)) || (numOrNull(wOutHead) as number) < 0);

  const invalidTail =
    trailer &&
    (Number.isNaN(numOrNull(wOutTrailer)) ||
      (numOrNull(wOutTrailer) as number) < 0);

  const canSave = trailer
    ? !invalidHead &&
      !invalidTail &&
      (wOutHead.trim() !== "" || wOutTrailer.trim() !== "")
    : !invalidSingle && wOut.trim() !== "";

  const handleSubmit = async () => {
    if (!canSave) return;
    try {
      setSaving(true);
      if (trailer) {
        await onSave({
          weight_out_head: numOrNull(wOutHead),
          weight_out_trailer: numOrNull(wOutTrailer),
        });
      } else {
        await onSave({
          weight_out: numOrNull(wOut),
        });
      }
      onClose();
    } catch (e) {
      // ให้หน้าหลักแสดง snackbar เองอยู่แล้ว
    } finally {
      setSaving(false);
    }
  };

  const onKeyDownSubmit: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter" && canSave && !saving) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>บันทึกน้ำหนักขาออก</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {trailer ? (
            <>
              <TextField
                label="น้ำหนักออก (หัว) - kg"
                type="number"
                value={wOutHead}
                onChange={(e) => setWOutHead(e.target.value)}
                onKeyDown={onKeyDownSubmit}
                error={invalidHead}
                helperText={invalidHead ? "กรุณากรอกตัวเลข ≥ 0" : " "}
                inputProps={{ min: 0, step: "1", inputMode: "numeric" }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }}
              />
              <TextField
                label="น้ำหนักออก (หาง) - kg"
                type="number"
                value={wOutTrailer}
                onChange={(e) => setWOutTrailer(e.target.value)}
                onKeyDown={onKeyDownSubmit}
                error={invalidTail}
                helperText={invalidTail ? "กรุณากรอกตัวเลข ≥ 0" : " "}
                inputProps={{ min: 0, step: "1", inputMode: "numeric" }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }}
              />
              <Alert severity="info" sx={{ borderRadius: RADIUS }}>
                รถพ่วงให้กรอกเป็น <strong>หัว / หาง</strong> แยกกัน
              </Alert>
            </>
          ) : (
            <>
              <TextField
                label="น้ำหนักออก (รวม) - kg"
                type="number"
                value={wOut}
                onChange={(e) => setWOut(e.target.value)}
                onKeyDown={onKeyDownSubmit}
                error={invalidSingle}
                helperText={invalidSingle ? "กรุณากรอกตัวเลข ≥ 0" : " "}
                inputProps={{ min: 0, step: "1", inputMode: "numeric" }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }}
              />
              <Alert severity="info" sx={{ borderRadius: RADIUS }}>
                รถเดี่ยวกรอกเป็น <strong>น้ำหนักรวม</strong> ช่องเดียว
              </Alert>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          ยกเลิก
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!canSave || saving}
        >
          บันทึก
        </Button>
      </DialogActions>
    </Dialog>
  );
}
