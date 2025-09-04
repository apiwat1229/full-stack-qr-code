"use client";

import SearchIcon from "@mui/icons-material/Search";
import { Card, InputAdornment, TextField } from "@mui/material";

export default function UsersToolbar({
  q,
  setQ,
}: {
  q: string;
  setQ: (v: string) => void;
}) {
  return (
    <Card
      elevation={0}
      sx={{
        mt: 2,
        px: 2,
        py: 1.5,
        display: "flex",
        alignItems: "center",
        gap: 1,
        borderRadius: 2,
        border: (t) => `1px solid ${t.palette.divider}`,
        width: "100%",
      }}
    >
      <TextField
        fullWidth
        size="small"
        placeholder="ค้นหา ชื่อผู้ใช้ / ชื่อ / อีเมล / แผนก"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 999 } }}
      />
    </Card>
  );
}
