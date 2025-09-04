// src/components/suppliers/SupplierDetailDrawer.tsx
"use client";

import Link from "next/link";
import React, { useMemo } from "react";

import { useThaiAddressApi } from "@/lib/useThaiAddressApi";
import type { Supplier } from "@/types/supplier";
import { normalizeRubberTypeNames } from "@/types/supplier";

import FuseSvgIcon from "@fuse/core/FuseSvgIcon";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";

/* ---------- Local types ---------- */
type StatusType = Supplier["status"];

/* ---------- Props ---------- */
export type SupplierDetailDrawerProps = {
  open: boolean;
  supplier: Supplier | null;
  onClose: () => void;
  onDelete?: (id: string) => void;
};

/* ---------- Utils ---------- */
const fmtDate = (d?: string) => {
  if (!d) return "-";
  const dt = new Date(d);
  return isNaN(+dt) ? "-" : dt.toLocaleString();
};

const composeName = (s?: Supplier | null) =>
  s ? `${s.title ?? ""}${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() : "-";

/* ---------- Rubber group helpers ---------- */
type RubberGroup = {
  title: string;
  color:
    | "default"
    | "primary"
    | "secondary"
    | "success"
    | "info"
    | "warning"
    | "error";
  items: string[];
};

const RUBBER_GROUPS: RubberGroup[] = [
  {
    title: "EUDR",
    color: "success",
    items: ["EUDR CL", "EUDR North-East CL", "EUDR USS"],
  },
  { title: "FSC", color: "info", items: ["FSC CL", "FSC USS"] },
  { title: "Region", color: "warning", items: ["North-East CL"] },
  {
    title: "Regular",
    color: "secondary",
    items: ["Regular CL", "Regular USS"],
  },
];

function groupRubberTypes(list?: string[]) {
  const val = Array.isArray(list) ? list : [];
  return RUBBER_GROUPS.map((g) => ({
    ...g,
    picked: g.items.filter((x) => val.includes(x)),
  })).filter((g) => g.picked.length > 0);
}

/* ---------- Building blocks ---------- */
function Section({
  title,
  fullWidth,
  children,
}: {
  title: string;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: fullWidth ? "1fr" : { xs: "1fr", md: "1fr" },
          columnGap: 2,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function RowPair({
  left,
  right,
}: {
  left: { icon: string; label: string; value?: React.ReactNode } | null;
  right: { icon: string; label: string; value?: React.ReactNode } | null;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: right ? "1fr 1fr" : "1fr",
        gap: 2,
      }}
    >
      {left && (
        <RowCompact icon={left.icon} label={left.label} value={left.value} />
      )}
      {right && (
        <RowCompact icon={right.icon} label={right.label} value={right.value} />
      )}
    </Box>
  );
}

function RowCompact({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "auto auto 1fr",
        alignItems: "center",
        columnGap: 0.75,
        py: 0.4,
        minHeight: 28,
      }}
    >
      <FuseSvgIcon size={16} color="action">
        {icon}
      </FuseSvgIcon>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ whiteSpace: "nowrap" }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 0 }}>
        {value ?? "-"}
      </Typography>
    </Box>
  );
}

function AddressLine({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "auto auto 1fr",
        columnGap: 0.75,
      }}
    >
      <FuseSvgIcon size={16} color="action">
        {icon}
      </FuseSvgIcon>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ whiteSpace: "nowrap" }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 500,
          minWidth: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {value ?? "-"}
      </Typography>
    </Box>
  );
}

const renderStatusChip = (s?: StatusType) => {
  switch (s) {
    case "Active":
      return <Chip size="small" color="success" label="Active" />;
    case "Suspend":
      return <Chip size="small" color="warning" label="Suspend" />;
    case "Blacklist":
      return <Chip size="small" color="error" label="Blacklist" />;
    default:
      return <Chip size="small" variant="outlined" label="-" />;
  }
};

/* ---------- Main Drawer ---------- */
export default function SupplierDetailDrawer({
  open,
  supplier,
  onClose,
  onDelete,
}: SupplierDetailDrawerProps) {
  const fullName = useMemo(() => composeName(supplier), [supplier]);

  // ดึงชื่อ ตำบล/อำเภอ/จังหวัด + ไปรษณีย์
  const { subdistrictName, districtName, provinceName, postalCode } =
    useThaiAddressApi({
      provinceCode: supplier?.provinceCode,
      districtCode: supplier?.districtCode,
      subdistrictCode: supplier?.subdistrictCode,
      postalCode: supplier?.postalCode,
    });

  // ✅ full address
  const composedFullAddress = useMemo(() => {
    const first = (supplier?.address || "").trim();
    const tail = [
      subdistrictName && `ตำบล${subdistrictName}`,
      districtName && `อำเภอ${districtName}`,
      provinceName && `จังหวัด${provinceName}`,
      postalCode,
    ]
      .filter(Boolean)
      .join(", ");
    return [first, tail].filter(Boolean).join(", ");
  }, [
    supplier?.address,
    subdistrictName,
    districtName,
    provinceName,
    postalCode,
  ]);

  // ✅ ใช้ normalize ให้กลายเป็น string[] ก่อน group
  const rubberGroups = useMemo(
    () => groupRubberTypes(normalizeRubberTypeNames(supplier?.rubberTypes)),
    [supplier?.rubberTypes]
  );

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        sx: {
          width: { xs: "100vw", sm: "90vw", md: 920 },
          maxWidth: "100vw",
          boxShadow: 24,
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: "flex",
          alignItems: "center",
          borderBottom: 1,
          borderColor: "divider",
          gap: 1,
        }}
      >
        <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 700 }}>
          Supplier Details
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <Button
            size="small"
            variant="contained"
            color="secondary"
            startIcon={<FuseSvgIcon>lucide:square-pen</FuseSvgIcon>}
            component={Link}
            href={supplier ? `/suppliers/${supplier._id}/edit` : "#"}
            disabled={!supplier}
          >
            Edit
          </Button>
          <IconButton onClick={onClose}>
            <FuseSvgIcon>lucide:x</FuseSvgIcon>
          </IconButton>
        </Stack>
      </Box>

      <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {/* Cover */}
        <Box
          sx={{
            minHeight: 120,
            backgroundColor: "background.default",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {supplier?.background ? (
            <img
              src={supplier.background}
              alt="cover"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : null}
        </Box>

        {/* Avatar + Name + Status */}
        <Box sx={{ px: 3, pb: 1.5, mt: -7 }}>
          <Avatar
            src={supplier?.avatar}
            sx={{
              width: 88,
              height: 88,
              border: "4px solid",
              borderColor: "background.paper",
            }}
          >
            {(supplier &&
              (
                `${supplier.firstName ?? ""} ${supplier.lastName ?? ""}`.trim() ||
                supplier.supCode ||
                "S"
              ).charAt(0)) ||
              "S"}
          </Avatar>

          <Typography variant="h6" fontWeight={700} sx={{ mt: 1 }}>
            {fullName || supplier?.supCode || "-"}
          </Typography>

          {supplier?.phone ? (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              Tel. {supplier.phone}
            </Typography>
          ) : null}

          <Box sx={{ mt: 0.5 }}>
            Status: {renderStatusChip(supplier?.status)}
          </Box>
        </Box>

        <Divider />

        {/* Body */}
        <Box sx={{ px: 3, py: 1, overflowY: "auto", flex: 1 }}>
          <Section title="Basic">
            <RowPair
              left={{
                icon: "lucide:id-card",
                label: "Supplier Code",
                value: supplier?.supCode,
              }}
              right={{ icon: "lucide:user", label: "Name", value: fullName }}
            />
          </Section>

          <Section title="Contact">
            <RowPair
              left={{
                icon: "lucide:phone",
                label: "Phone",
                value: supplier?.phone || "-",
              }}
              right={{
                icon: "lucide:badge-check",
                label: "Certificate No.",
                value: supplier?.certificateNo || "-",
              }}
            />
            <RowPair
              left={{
                icon: "lucide:calendar",
                label: "Certificate Expiry",
                value: supplier?.certificateExpiry || "-",
              }}
              right={null}
            />
          </Section>

          <Section title="Address" fullWidth>
            <AddressLine
              icon="lucide:map-pin"
              label="Full Address"
              value={composedFullAddress}
            />
          </Section>

          <Section title="Rubber Types" fullWidth>
            {rubberGroups.length ? (
              <Stack spacing={1.25}>
                {rubberGroups.map((g) => (
                  <Box key={g.title}>
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary" }}
                    >
                      {g.title}
                    </Typography>
                    <Box
                      sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 0.75,
                        mt: 0.5,
                      }}
                    >
                      {g.picked.map((t) => (
                        <Chip
                          key={t}
                          label={t}
                          size="small"
                          color={g.color}
                          variant="filled"
                        />
                      ))}
                    </Box>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                -
              </Typography>
            )}
          </Section>

          <Section title="Quota & Score">
            <RowPair
              left={{
                icon: "lucide:package",
                label: "CL EUDR Quota",
                value: supplier?.clEudrQuota ?? "-",
              }}
              right={{
                icon: "lucide:package",
                label: "USS EUDR Quota",
                value: supplier?.ussEudrQuota ?? "-",
              }}
            />
            <RowPair
              left={{
                icon: "lucide:star",
                label: "Score",
                value: supplier?.score ?? "-",
              }}
              right={null}
            />
          </Section>

          <Section title="Note" fullWidth>
            <Typography
              variant="body2"
              sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            >
              {supplier?.note || "-"}
            </Typography>
          </Section>
        </Box>

        <Divider />

        {/* Created/Updated footer */}
        <Box sx={{ px: 3, py: 1 }}>
          <RowPair
            left={{
              icon: "lucide:calendar",
              label: "Created At",
              value: fmtDate(supplier?.createdAt),
            }}
            right={{
              icon: "lucide:history",
              label: "Updated At",
              value: fmtDate(supplier?.updatedAt),
            }}
          />
        </Box>

        {/* Bottom bar */}
        <Box
          sx={{
            p: 1.25,
            display: "flex",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Button
            variant="outlined"
            color="error"
            startIcon={<FuseSvgIcon>lucide:trash</FuseSvgIcon>}
            disabled={!supplier}
            onClick={() => supplier && onDelete?.(supplier._id)}
          >
            Delete
          </Button>
          <Stack direction="row" spacing={1}>
            <Button onClick={onClose}>Close</Button>
          </Stack>
        </Box>
      </Box>
    </Drawer>
  );
}
