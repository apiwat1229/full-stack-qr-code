"use client";

import FuseSvgIcon from "@fuse/core/FuseSvgIcon";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Snackbar,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { useEffect, useState } from "react";

/* ❗ บังคับใช้ internal API เสมอ */
const API_BASE = "/api";

type Supplier = {
  _id: string;
  supCode: string;
  title?: string;
  firstName: string;
  lastName: string;
  address: string;
  phone?: string;
  certificateNo?: string;
  certificateExpiry?: string;
  status: "Active" | "Suspend" | "Blacklist";
  rubberTypes: string[];
  score?: number | null;
  ussEudrQuota?: number | null;
  clEudrQuota?: number | null;
  note?: string;
  avatar?: string;
  background?: string;
  createdAt: string;
};

export default function SupplierView({ id }: { id: string }) {
  const [data, setData] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({
    open: false,
    msg: "",
    sev: "success" as "success" | "error",
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/suppliers/${id}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as Supplier;
        setData(json);
      } catch (e: any) {
        setToast({
          open: true,
          msg: e?.message || "โหลดข้อมูลไม่สำเร็จ",
          sev: "error",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <Typography className="p-12">Loading...</Typography>;
  if (!data) return <Typography className="p-12">Not found</Typography>;

  const nameDisplay =
    `${data.title ?? ""}${data.firstName} ${data.lastName}`.trim();

  return (
    <>
      <div className="relative flex flex-auto flex-col items-center overflow-y-auto">
        <Box
          className="relative min-h-40 w-full px-8 sm:min-h-48 sm:px-12"
          sx={{ backgroundColor: "background.default" }}
        >
          {data.background && (
            <img
              className="absolute inset-0 h-full w-full object-cover"
              src={data.background}
              alt="supplier background"
            />
          )}
        </Box>

        <div className="px-6 sm:px-12 w-full">
          <div className="-mt-16 flex flex-auto items-end">
            <Avatar
              sx={{
                borderWidth: 4,
                borderStyle: "solid",
                borderColor: "background.paper",
                backgroundColor: "background.default",
                color: "text.secondary",
              }}
              className="text-16 h-32 w-32 font-bold"
              src={data.avatar}
              alt={nameDisplay || data.supCode}
            >
              {(nameDisplay || data.supCode || "S").charAt(0)}
            </Avatar>

            <div className="mb-1 ml-auto flex items-center">
              <Button
                variant="contained"
                color="secondary"
                component={Link}
                href={`/suppliers/${data._id}/edit`}
              >
                <FuseSvgIcon>lucide:square-pen</FuseSvgIcon>
                <span className="mx-2">Edit</span>
              </Button>
            </div>
          </div>

          <Typography className="mt-3 truncate text-4xl font-bold">
            {nameDisplay || data.supCode}
          </Typography>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Chip label={data.status} color="default" />
            {data.rubberTypes?.map((rt) => (
              <Chip key={rt} label={rt} size="small" />
            ))}
          </div>

          <Divider className="mt-4 mb-6" />

          <div className="flex flex-col gap-8">
            <InfoRow icon="lucide:hash" label="SupCode" value={data.supCode} />
            <InfoRow
              icon="lucide:map-pin"
              label="Address"
              value={data.address}
            />
            <InfoRow icon="lucide:phone" label="Phone" value={data.phone} />
            <InfoRow
              icon="lucide:scroll-text"
              label="Certificate No."
              value={data.certificateNo}
            />
            <InfoRow
              icon="lucide:calendar"
              label="Cert. Expiry"
              value={data.certificateExpiry}
            />
            <InfoRow
              icon="lucide:gauge"
              label="Score"
              value={data.score ?? undefined}
            />
            <InfoRow
              icon="lucide:database"
              label="USS EUDR"
              value={data.ussEudrQuota ?? undefined}
            />
            <InfoRow
              icon="lucide:database"
              label="CL EUDR"
              value={data.clEudrQuota ?? undefined}
            />
            <InfoRow icon="lucide:sticky-note" label="Note" value={data.note} />
          </div>
        </div>
      </div>

      <Snackbar
        open={toast.open}
        autoHideDuration={2500}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        sx={{ mt: 8, mr: 2, zIndex: (theme) => theme.zIndex.modal + 1 }}
      >
        <Alert
          severity={toast.sev}
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          variant="filled"
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value?: string | number;
}) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-center">
      <FuseSvgIcon>{icon}</FuseSvgIcon>
      <div className="ml-6 leading-6">
        <strong className="mr-2">{label}:</strong> {value}
      </div>
    </div>
  );
}
