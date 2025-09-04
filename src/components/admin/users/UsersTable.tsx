"use client";

import { UserRow } from "@/types/user";
import {
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  tableCellClasses,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import dayjs from "dayjs";

const SoftCell = styled(TableCell)(({ theme }) => ({
  [`&.${tableCellClasses.head}`]: {
    background:
      theme.palette.mode === "light"
        ? alpha(theme.palette.common.black, 0.02)
        : alpha("#fff", 0.06),
    fontWeight: 700,
    fontSize: 13,
    color: alpha(theme.palette.text.primary, 0.9),
    borderBottomColor: alpha(theme.palette.divider, 0.7),
  },
  [`&.${tableCellClasses.body}`]: {
    borderBottomColor: alpha(theme.palette.divider, 0.5),
  },
}));

export default function UsersTable({
  rows,
  loading,
  onRowClick,
  onEdit,
  onReset,
  onDelete,
  canUpdate,
  canDelete,
}: {
  rows: UserRow[];
  loading: boolean;
  onRowClick: (u: UserRow) => void;
  onEdit: (u: UserRow) => void;
  onReset: (u: UserRow) => void;
  onDelete: (u: UserRow) => void;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{ borderRadius: 2, width: "100%" }}
    >
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <SoftCell sx={{ width: 200 }}>Username</SoftCell>
            <SoftCell>Name</SoftCell>
            <SoftCell sx={{ width: 120 }}>Dept</SoftCell>
            <SoftCell sx={{ width: 260 }}>Email</SoftCell>
            <SoftCell sx={{ width: 100 }}>Role</SoftCell>
            <SoftCell sx={{ width: 140 }}>Created</SoftCell>
            <SoftCell align="right" sx={{ width: 160 }}>
              Actions
            </SoftCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <SoftCell colSpan={7}>กำลังโหลด…</SoftCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <SoftCell colSpan={7}>ไม่พบข้อมูล</SoftCell>
            </TableRow>
          ) : (
            rows.map((u) => (
              <TableRow
                key={u._id}
                hover
                sx={{ cursor: "pointer" }}
                onClick={() => onRowClick(u)}
              >
                <SoftCell>
                  <Typography fontWeight={800}>{u.username}</Typography>
                </SoftCell>
                <SoftCell>
                  {(u.name || "-") + " " + (u.lastName || "")}
                </SoftCell>
                <SoftCell>{u.department || "-"}</SoftCell>
                <SoftCell>
                  <Typography
                    variant="body2"
                    noWrap
                    title={u.email || "-"}
                    sx={{ maxWidth: 260 }}
                  >
                    {u.email || "-"}
                  </Typography>
                </SoftCell>
                <SoftCell>{u.role || "user"}</SoftCell>
                <SoftCell>
                  {u.createdAt ? dayjs(u.createdAt).format("DD-MMM-YYYY") : "-"}
                </SoftCell>
                <SoftCell align="right" onClick={(e) => e.stopPropagation()}>
                  <Stack direction="row" spacing={1} justifyContent="end">
                    <Tooltip title={!canUpdate ? "ไม่มีสิทธิ์แก้ไข" : "แก้ไข"}>
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={!canUpdate}
                          onClick={() => onEdit(u)}
                          sx={{ borderRadius: 999, minWidth: 36 }}
                        >
                          แก้ไข
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip
                      title={
                        !canUpdate ? "ไม่มีสิทธิ์รีเซ็ตรหัสผ่าน" : "รีเซ็ต"
                      }
                    >
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          color="secondary"
                          disabled={!canUpdate}
                          onClick={() => onReset(u)}
                          sx={{ borderRadius: 999, minWidth: 36 }}
                        >
                          รีเซ็ต
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title={!canDelete ? "ไม่มีสิทธิ์ลบ" : "ลบ"}>
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          disabled={!canDelete}
                          onClick={() => onDelete(u)}
                          sx={{ borderRadius: 999, minWidth: 36 }}
                        >
                          ลบ
                        </Button>
                      </span>
                    </Tooltip>
                  </Stack>
                </SoftCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
