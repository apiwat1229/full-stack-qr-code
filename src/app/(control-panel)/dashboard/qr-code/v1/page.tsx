"use client";

import FusePageSimple from "@fuse/core/FusePageSimple";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import {
  alpha,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import * as React from "react";

/* ================= Styles ================= */
const Root = styled(FusePageSimple)(({ theme }) => ({
  "& .FusePageSimple-header": {
    background:
      theme.palette.mode === "light"
        ? `linear-gradient(180deg, ${alpha(theme.palette.primary.light, 0.1)} 0%, transparent 60%)`
        : undefined,
    borderBottom: `1px solid ${theme.vars.palette.divider}`,
  },
  "& .FusePageSimple-content": {
    boxShadow: theme.vars.shadows[1],
    backgroundColor: theme.vars.palette.background.default,
  },
}));

const Card = styled(Paper)(({ theme }) => ({
  borderRadius: 16,
  border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
}));

/* ================= Page ================= */
export default function QrDashBoardV1() {
  const [q, setQ] = React.useState("");

  const handleCreate = () => {
    // TODO: ใส่ลอจิกสร้างใหม่
    alert("Create clicked");
  };

  const handleRefresh = () => {
    // TODO: ใส่ลอจิกรีเฟรชข้อมูล
    alert("Refresh clicked");
  };

  return (
    <Root
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
                QR Code DashBoard V.1
              </Typography>
              <Typography variant="body2" color="text.secondary">
                QR Code DashBoard V.1 สำหรับเริ่มพัฒนาหน้าใหม่
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <IconButton onClick={handleRefresh} color="inherit">
                <RefreshIcon />
              </IconButton>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreate}
                sx={{ borderRadius: 999, px: 2.2 }}
              >
                สร้างใหม่
              </Button>
            </Stack>

          </Stack>

          <Card
            elevation={0}
            sx={{
              mt: 2,
              px: 2,
              py: 1.5,
              display: "flex",
              alignItems: "center",
              gap: 1,
              backdropFilter: "blur(6px)",
            }}
          >
            <TextField
              fullWidth
              size="small"
              placeholder="ค้นหา…"
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
            <Chip
              size="small"
              label={q ? `กำลังค้นหา: "${q}"` : "พร้อมค้นหา"}
              variant="outlined"
            />
          </Card>
        </Box>
      }
      content={
        <Box className="p-6">
          <Card elevation={0} sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              เนื้อหา (Content Area)
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              วางตาราง/การ์ด/ฟอร์ม/กราฟ ของคุณในส่วนนี้ได้เลย
              โครงนี้เป็นสตาร์ทเตอร์เพจ—แก้ไข/ลบ/เพิ่มคอมโพเนนต์ได้ตามต้องการ
            </Typography>
          </Card>
        </Box>
      }
    />
  );
}
