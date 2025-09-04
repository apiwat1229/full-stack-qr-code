"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  FormLabel,
  Stack,
  TextField,
} from "@mui/material";
import dayjs from "dayjs";
import * as React from "react";

export default function TimeConfirmDialog({
  open,
  title,
  defaultISO,
  onClose,
  onConfirm,
  disabled,
}: {
  open: boolean;
  title: string;
  defaultISO?: string | null;
  onClose: () => void;
  onConfirm: (hhmm: string) => void; // คืนค่า HH:mm ให้ BE
  disabled?: boolean;
}) {
  const [hhmm, setHhmm] = React.useState(
    dayjs(defaultISO || new Date()).format("HH:mm")
  );

  React.useEffect(() => {
    if (open) setHhmm(dayjs(defaultISO || new Date()).format("HH:mm"));
  }, [open, defaultISO]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <FormControl>
            <FormLabel>เวลา</FormLabel>
            <TextField
              size="small"
              type="time"
              value={hhmm}
              onChange={(e) => setHhmm(e.target.value)}
              inputProps={{ step: 60 }}
              disabled={disabled}
            />
            <FormHelperText>
              สามารถแก้ไขเวลาได้ (ค่าเริ่มต้น: ตอนนี้)
            </FormHelperText>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>ยกเลิก</Button>
        <Button
          variant="contained"
          onClick={() => onConfirm(hhmm)}
          disabled={disabled}
        >
          บันทึก
        </Button>
      </DialogActions>
    </Dialog>
  );
}
