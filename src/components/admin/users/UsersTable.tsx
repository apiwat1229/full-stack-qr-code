// components/admin/users/UsersTable.tsx
"use client";

import type { UserRow } from "@/types/user";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import {
  CircularProgress,
  IconButton,
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

type Props = {
  rows: UserRow[];
  loading?: boolean;
  onRowClick?: (u: UserRow) => void;
  onEdit?: (u: UserRow) => void;
  onReset?: (u: UserRow) => void;
  onDelete?: (u: UserRow) => void;
  canUpdate?: boolean;
  canDelete?: boolean;
};

function displayName(u: UserRow) {
  const full = `${u.name ?? ""} ${u.lastName ?? ""}`.trim();
  return full || u.username || u.email || u._id || (u as any).id || "-";
}

export default function UsersTable({
  rows,
  loading,
  onRowClick,
  onEdit,
  onReset,
  onDelete,
  canUpdate,
  canDelete,
}: Props) {
  return (
    <TableContainer
      sx={{
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <Table
        size="small"
        sx={{
          minWidth: 900,
          "& thead th": {
            bgcolor: (t) =>
              t.palette.mode === "light"
                ? t.palette.grey[100]
                : t.palette.grey[900],
            color: "text.secondary",
            fontWeight: 700,
            letterSpacing: 0.3,
          },
          "& tbody tr:hover": {
            bgcolor: (t) =>
              t.palette.mode === "light"
                ? "rgba(25,118,210,.05)"
                : "rgba(144,202,249,.08)",
            cursor: "pointer",
          },
          "& td, & th": { borderColor: (t) => t.palette.divider },
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell width={64} align="center">
              ลำดับ
            </TableCell>
            <TableCell>ชื่อ - นามสกุล</TableCell>
            <TableCell>Username</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>แผนก</TableCell>
            <TableCell>ตำแหน่ง</TableCell>
            <TableCell>Role</TableCell>
            <TableCell align="right" width={160}>
              การจัดการ
            </TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                <CircularProgress size={28} />
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1 }}
                >
                  กำลังโหลด…
                </Typography>
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  ไม่มีข้อมูลผู้ใช้
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((u, idx) => {
              const pos =
                (u as any).position ??
                (u as any).jobTitle ??
                (u as any).title ??
                "-";
              return (
                <TableRow
                  key={String(u._id || (u as any).id || idx)}
                  hover
                  onClick={() => onRowClick?.(u)}
                >
                  <TableCell align="center">{idx + 1}</TableCell>
                  <TableCell>{displayName(u)}</TableCell>
                  <TableCell>{u.username || "-"}</TableCell>
                  <TableCell>{u.email || "-"}</TableCell>
                  <TableCell>{u.department || "-"}</TableCell>
                  <TableCell>{pos || "-"}</TableCell>
                  <TableCell>{u.role || "-"}</TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <Stack
                      direction="row"
                      spacing={1}
                      justifyContent="flex-end"
                    >
                      <Tooltip title="รีเซ็ตรหัสผ่าน">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => onReset?.(u)}
                            disabled={!canUpdate}
                          >
                            <RestartAltIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>

                      <Tooltip title="แก้ไข">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => onEdit?.(u)}
                            disabled={!canUpdate}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>

                      <Tooltip title="ลบ">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => onDelete?.(u)}
                            disabled={!canDelete}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
