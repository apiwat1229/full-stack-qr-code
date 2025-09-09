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
  trailer?: boolean;
  initial?: {
    weight_out?: number | null;
    weight_out_head?: number | null;
    weight_out_trailer?: number | null;
  };
  onSave: (payload: {
    weight_out?: number | null;
    weight_out_head?: number | null;
    weight_out_trailer?: number | null;
  }) => Promise<void> | void;
};

const RADIUS = 1;

/** utils: format/parse with commas */
const addCommas = (raw: string) => {
  const s = raw.replace(/[^\d]/g, ""); // keep digits only
  if (!s) return "";
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};
const stripCommas = (s: string) => s.replace(/,/g, "");
const toNumOrNull = (s: string) => {
  const t = stripCommas(s.trim());
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

export default function WeightOutDialog({
  open,
  onClose,
  trailer = false,
  initial,
  onSave,
}: Props) {
  const [saving, setSaving] = React.useState(false);

  // state (เป็น string ที่มีคอมมา)
  const [wOut, setWOut] = React.useState<string>("");
  const [wOutHead, setWOutHead] = React.useState<string>("");
  const [wOutTrailer, setWOutTrailer] = React.useState<string>("");

  React.useEffect(() => {
    if (open) {
      setSaving(false);
      setWOut(
        initial?.weight_out != null ? addCommas(String(initial.weight_out)) : ""
      );
      setWOutHead(
        initial?.weight_out_head != null
          ? addCommas(String(initial.weight_out_head))
          : ""
      );
      setWOutTrailer(
        initial?.weight_out_trailer != null
          ? addCommas(String(initial.weight_out_trailer))
          : ""
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // validation
  const invalidSingle =
    !trailer &&
    (Number.isNaN(toNumOrNull(wOut)) || (toNumOrNull(wOut) as number) < 0);
  const invalidHead =
    trailer &&
    (Number.isNaN(toNumOrNull(wOutHead)) ||
      (toNumOrNull(wOutHead) as number) < 0);
  const invalidTail =
    trailer &&
    (Number.isNaN(toNumOrNull(wOutTrailer)) ||
      (toNumOrNull(wOutTrailer) as number) < 0);

  const canSave = trailer
    ? !invalidHead &&
      !invalidTail &&
      (wOutHead.trim() !== "" || wOutTrailer.trim() !== "")
    : !invalidSingle && wOut.trim() !== "";

  // onChange ที่ดูดคีย์และแสดงคอมมาทันที
  const onChangeWithComma =
    (setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // อนุญาตเฉพาะเลข/คอมมา เว้นวรรค/backspace/paste ได้
      const clean = raw.replace(/[^\d,]/g, "");
      // ถ้ามีคอมมาในรูปร่างผิด ให้รีฟอร์แมตใหม่จาก digit ล้วน
      setter(addCommas(clean));
    };

  const handleSubmit = async () => {
    if (!canSave) return;
    try {
      setSaving(true);
      if (trailer) {
        await onSave({
          weight_out_head: toNumOrNull(wOutHead),
          weight_out_trailer: toNumOrNull(wOutTrailer),
        });
      } else {
        await onSave({
          weight_out: toNumOrNull(wOut),
        });
      }
      onClose();
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
                value={wOutHead}
                onChange={onChangeWithComma(setWOutHead)}
                onKeyDown={onKeyDownSubmit}
                error={invalidHead}
                helperText={invalidHead ? "กรุณากรอกตัวเลข ≥ 0" : " "}
                inputProps={{ inputMode: "numeric" }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }}
              />
              <TextField
                label="น้ำหนักออก (หาง) - kg"
                value={wOutTrailer}
                onChange={onChangeWithComma(setWOutTrailer)}
                onKeyDown={onKeyDownSubmit}
                error={invalidTail}
                helperText={invalidTail ? "กรุณากรอกตัวเลข ≥ 0" : " "}
                inputProps={{ inputMode: "numeric" }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }}
              />
              <Alert severity="info" sx={{ borderRadius: RADIUS }}>
                รถพ่วงให้กรอกเป็น <strong>หัว / หาง</strong> แยกกัน
                (จะแสดงคอมมาอัตโนมัติ)
              </Alert>
            </>
          ) : (
            <>
              <TextField
                label="น้ำหนักออก (รวม) - kg"
                value={wOut}
                onChange={onChangeWithComma(setWOut)}
                onKeyDown={onKeyDownSubmit}
                error={invalidSingle}
                helperText={invalidSingle ? "กรุณากรอกตัวเลข ≥ 0" : " "}
                inputProps={{ inputMode: "numeric" }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: RADIUS } }}
              />
              <Alert severity="info" sx={{ borderRadius: RADIUS }}>
                รถเดี่ยวกรอกเป็น <strong>น้ำหนักรวม</strong> ช่องเดียว
                (จะแสดงคอมมาอัตโนมัติ)
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
