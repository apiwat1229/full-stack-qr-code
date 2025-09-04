// src/app/suppliers/_components/SupplierForm.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import React, { useCallback, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import FuseSvgIcon from "@fuse/core/FuseSvgIcon";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  FormControl,
  FormLabel,
  IconButton,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import Link from "next/link";
import { useRouter } from "next/navigation";

import LocationCascadeSelect, {
  type LocationValue,
} from "@/components/widgets/LocationCascadeSelect";

const API_BASE = "/api";

/* ---------------- Types ---------------- */
type RubberTypeOption = { id: string; name: string };

/* ---------------- Schema ---------------- */
const schema = z.object({
  avatar: z.string().optional(),
  background: z.string().optional(),
  supCode: z.string().min(1, "SupCode is required").max(5, "max 5 chars"),
  title: z
    .enum([
      "",
      "นาย",
      "นาง",
      "นางสาว",
      "ว่าที่ ร.ต.",
      "บริษัท",
      "หจก.",
      "สหกรณ์",
    ])
    .default(""),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  address: z.string().min(1, "Address is required"),
  provinceCode: z.number().nullable().optional(),
  districtCode: z.number().nullable().optional(),
  subdistrictCode: z.number().nullable().optional(),
  postalCode: z.number().nullable().optional(),
  phone: z.string().optional(),
  certificateNo: z.string().optional(),
  certificateExpiry: z.string().optional(), // yyyy-MM-dd
  status: z.enum(["Active", "Suspend", "Blacklist"]).default("Active"),

  // ✅ ใช้ rubberTypeIds (ObjectId ของ RubberType)
  rubberTypeIds: z.array(z.string()).default([]),

  score: z.number().nullable().optional(),
  ussEudrQuota: z.number().nullable().optional(),
  clEudrQuota: z.number().nullable().optional(),
  note: z.string().optional(),
});

export type SupplierFormType = z.infer<typeof schema>;

const isISODate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

const INITIAL_LOCATION: LocationValue = {
  provinceCode: null,
  districtCode: null,
  subdistrictCode: null,
  postalCode: null,
};

/* -------- map API -> form fields -------- */
function mapSupplierFromApi(data: any): SupplierFormType {
  // API คืน rubberTypes เป็น array ของ object (populate แล้ว)
  const rubberTypeIds: string[] = Array.isArray(data?.rubberTypes)
    ? data.rubberTypes
        .map((rt: any) =>
          typeof rt === "string" ? rt : (rt?._id ?? rt?.id ?? "")
        )
        .filter(Boolean)
    : [];

  return {
    avatar: data?.avatar ?? "",
    background: data?.background ?? "",
    supCode: data?.supCode ?? "",
    title: data?.title ?? "",
    firstName: data?.firstName ?? "",
    lastName: data?.lastName ?? "",
    address: data?.address ?? "",
    provinceCode:
      typeof data?.provinceCode === "number" ? data.provinceCode : null,
    districtCode:
      typeof data?.districtCode === "number" ? data.districtCode : null,
    subdistrictCode:
      typeof data?.subdistrictCode === "number" ? data.subdistrictCode : null,
    postalCode: typeof data?.postalCode === "number" ? data.postalCode : null,
    phone: data?.phone ?? "",
    certificateNo: data?.certificateNo ?? "",
    certificateExpiry: data?.certificateExpiry ?? "",
    status: (["Active", "Suspend", "Blacklist"] as const).includes(data?.status)
      ? data.status
      : "Active",

    // ✅ เก็บเป็น ids
    rubberTypeIds,

    score: data?.score ?? null,
    ussEudrQuota: data?.ussEudrQuota ?? null,
    clEudrQuota: data?.clEudrQuota ?? null,
    note: data?.note ?? "",
  };
}

/* -------- sanitize -------- */
function sanitizeForUpdate<T extends Record<string, any>>(obj: T) {
  const { _id, __v, createdAt, updatedAt, ...rest } = obj;
  return rest as T;
}

/* -------- safe setState -------- */
function useStateSafe<T>(initial: T) {
  const [state, setState] = React.useState(initial);
  const mounted = React.useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );
  const setSafe = React.useCallback((updater: React.SetStateAction<T>) => {
    if (mounted.current) setState(updater);
  }, []);
  return [state, setSafe] as const;
}

/* =================== Component =================== */
export default function SupplierForm({
  isNew = false,
  id,
}: {
  isNew?: boolean;
  id?: string;
}) {
  const router = useRouter();

  const {
    control,
    watch,
    reset,
    handleSubmit,
    formState,
    getValues,
    setValue,
  } = useForm<SupplierFormType>({
    mode: "all",
    resolver: zodResolver(schema),
    defaultValues: {
      avatar: "",
      background: "",
      supCode: "",
      title: "",
      firstName: "",
      lastName: "",
      address: "",
      provinceCode: null,
      districtCode: null,
      subdistrictCode: null,
      postalCode: null,
      phone: "",
      certificateNo: "",
      certificateExpiry: "",
      status: "Active",

      // ✅ ค่าเริ่มต้นเป็น ids ว่าง ๆ
      rubberTypeIds: [],

      score: null,
      ussEudrQuota: null,
      clEudrQuota: null,
      note: "",
    },
  });

  const { isValid, isSubmitting, errors } = formState;
  const canSave = isValid && !isSubmitting;

  const [toast, setToast] = useStateSafe({
    open: false,
    msg: "",
    sev: "success" as "success" | "error",
  });

  const [locTH, setLocTH] = React.useState<LocationValue>(INITIAL_LOCATION);

  // ✅ options ของ RubberType จาก API
  const [rubberTypeOptions, setRubberTypeOptions] = React.useState<
    RubberTypeOption[]
  >([]);

  // โหลด options
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/suppliers/rubber-types`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await res.text());
        const list = await res.json();
        const opts: RubberTypeOption[] = (Array.isArray(list) ? list : [])
          .map((x: any) => ({
            id: String(x._id ?? x.id),
            name: String(x.name ?? ""),
          }))
          .filter((x) => x.id && x.name);
        setRubberTypeOptions(opts);
      } catch (e: any) {
        setToast({
          open: true,
          msg: e?.message || "โหลด Rubber Types ไม่สำเร็จ",
          sev: "error",
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----- load on edit ----- */
  useEffect(() => {
    (async () => {
      if (!isNew && id) {
        try {
          const res = await fetch(`${API_BASE}/suppliers/${id}`, {
            cache: "no-store",
          });
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json();

          const formValues = mapSupplierFromApi(data);
          reset(formValues);
          setLocTH({
            provinceCode: formValues.provinceCode,
            districtCode: formValues.districtCode,
            subdistrictCode: formValues.subdistrictCode,
            postalCode: formValues.postalCode,
          });
        } catch (e: any) {
          setToast({
            open: true,
            msg: e?.message || "โหลดข้อมูลไม่สำเร็จ",
            sev: "error",
          });
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  const readFileAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("File reading error"));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  /* ----- submit ----- */
  const onSubmit = useCallback(async () => {
    const raw = getValues();

    const supCode = (raw.supCode || "").toUpperCase();

    // normalize certificateExpiry → yyyy-MM-dd หรือว่าง
    let certificateExpiry = raw.certificateExpiry || "";
    if (certificateExpiry && !isISODate(certificateExpiry)) {
      const d = new Date(certificateExpiry);
      certificateExpiry = isNaN(+d) ? "" : d.toISOString().slice(0, 10);
    }

    // รวมตำแหน่ง และ sanitize
    const payload = sanitizeForUpdate({
      ...raw,
      supCode,
      certificateExpiry,
      provinceCode: locTH.provinceCode ?? null,
      districtCode: locTH.districtCode ?? null,
      subdistrictCode: locTH.subdistrictCode ?? null,
      postalCode: locTH.postalCode ?? null,
    }) as any;

    // ✅ ส่งเป็น rubberTypeIds (unique, ตัด falsy)
    payload.rubberTypeIds = Array.isArray(raw.rubberTypeIds)
      ? Array.from(new Set(raw.rubberTypeIds.filter(Boolean)))
      : [];

    // ❌ อย่าส่ง rubberTypes (ชื่อ) ไปที่ API
    delete payload.rubberTypes;

    // ถ้าว่าง ให้ลบ certificateExpiry เพื่อเลี่ยง 400
    if (!payload.certificateExpiry) delete payload.certificateExpiry;

    try {
      const res = await fetch(
        isNew ? `${API_BASE}/suppliers` : `${API_BASE}/suppliers/${id}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        let msg = `Save failed (${res.status})`;
        try {
          const j = await res.json();
          if (j?.message)
            msg = Array.isArray(j.message) ? j.message.join(", ") : j.message;
        } catch {
          const t = await res.text();
          if (t) msg = t || msg;
        }
        throw new Error(msg);
      }
      setToast({ open: true, msg: "บันทึกสำเร็จ", sev: "success" });
      router.push("/suppliers/list");
    } catch (e: any) {
      setToast({
        open: true,
        msg: e?.message || "บันทึกไม่สำเร็จ",
        sev: "error",
      });
    }
  }, [getValues, id, isNew, locTH, router]);

  /* ----- delete ----- */
  const onDelete = useCallback(async () => {
    if (!id) return;
    if (!confirm("ยืนยันการลบรายการนี้?")) return;
    try {
      const res = await fetch(`${API_BASE}/suppliers/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      setToast({ open: true, msg: "ลบสำเร็จ", sev: "success" });
      router.push("/suppliers/list");
    } catch (e: any) {
      setToast({ open: true, msg: e?.message || "ลบไม่สำเร็จ", sev: "error" });
    }
  }, [id, router]);

  // watchers for view
  const background = watch("background");
  const supCode = watch("supCode");
  const nameDisplay =
    `${watch("title") ?? ""}${watch("firstName") ?? ""} ${watch("lastName") ?? ""}`.trim();

  return (
    <>
      <div className="relative flex flex-auto flex-col items-center overflow-y-auto">
        {/* Cover */}
        <Box
          className="relative min-h-40 w-full px-8 sm:min-h-48 sm:px-12" // ✅ แก้ sm:minh-48 → sm:min-h-48
          sx={{ backgroundColor: "background.default" }}
        >
          {background && (
            <img
              className="absolute inset-0 h-full w-full object-cover"
              src={background}
              alt="supplier cover"
            />
          )}
        </Box>

        <div className="w-full px-6 pb-8 sm:px-12">
          <div className="-mt-16 flex w-full flex-auto items-end">
            {/* Avatar */}
            <Controller
              control={control}
              name="avatar"
              render={({ field: { onChange, value } }) => (
                <Box
                  sx={{
                    borderWidth: 4,
                    borderStyle: "solid",
                    borderColor: "background.paper",
                  }}
                  className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full"
                >
                  <div className="absolute inset-0 z-10 bg-black/50" />
                  <div className="absolute inset-0 z-20 flex items-center justify-center gap-1">
                    <label
                      htmlFor="button-avatar"
                      className="flex cursor-pointer p-2"
                    >
                      <input
                        accept="image/*"
                        className="hidden"
                        id="button-avatar"
                        type="file"
                        onChange={async (e) => {
                          const file = e?.target?.files?.[0];
                          if (!file) return;
                          const base64 = await readFileAsBase64(file);
                          onChange(base64);
                        }}
                      />
                      <FuseSvgIcon className="text-white">
                        lucide:camera
                      </FuseSvgIcon>
                    </label>

                    <IconButton onClick={() => onChange("")}>
                      <FuseSvgIcon className="text-white">
                        lucide:trash
                      </FuseSvgIcon>
                    </IconButton>
                  </div>

                  <Avatar
                    sx={{
                      backgroundColor: "background.default",
                      color: "text.secondary",
                    }}
                    className="text-16 h-full w-full object-cover font-bold"
                    src={value || ""}
                    alt={nameDisplay || supCode || "avatar"}
                  >
                    {(nameDisplay || supCode || "S").charAt(0)}
                  </Avatar>
                </Box>
              )}
            />

            {/* Cover uploader */}
            <div className="mb-1 ml-auto flex items-center gap-8">
              <Controller
                control={control}
                name="background"
                render={({ field: { onChange } }) => (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Button
                      variant="outlined"
                      startIcon={<FuseSvgIcon>lucide:image</FuseSvgIcon>}
                      component="label"
                    >
                      Upload Cover
                      <input
                        hidden
                        accept="image/*"
                        type="file"
                        onChange={async (e) => {
                          const file = e?.target?.files?.[0];
                          if (!file) return;
                          const base64 = await readFileAsBase64(file);
                          onChange(base64);
                        }}
                      />
                    </Button>
                    <Button
                      variant="text"
                      color="error"
                      onClick={() => onChange("")}
                      startIcon={<FuseSvgIcon>lucide:trash</FuseSvgIcon>}
                    >
                      Remove
                    </Button>
                  </Stack>
                )}
              />
            </div>
          </div>

          <Typography className="mt-3 truncate text-3xl font-bold">
            {nameDisplay || "New Supplier"}
          </Typography>

          {/* ฟอร์มหลัก */}
          <Paper className="mt-4 p-4">
            <form
              id="supplier-form"
              onSubmit={handleSubmit(onSubmit)}
              noValidate
            >
              <Stack spacing={2}>
                {/* แถว 1 */}
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <Controller
                    control={control}
                    name="supCode"
                    render={({ field }) => (
                      <FormControl className="w-full md:w-1/5">
                        <FormLabel>Supplier Code</FormLabel>
                        <TextField
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => {
                            const v = e.target.value
                              .toUpperCase()
                              .replace(/[^A-Z0-9]/g, "")
                              .slice(0, 5);
                            field.onChange(v);
                          }}
                          placeholder="e.g. S001"
                          error={!!errors.supCode}
                          helperText={errors?.supCode?.message}
                        />
                      </FormControl>
                    )}
                  />

                  <Controller
                    control={control}
                    name="title"
                    render={({ field }) => (
                      <FormControl className="w-full md:w-1/5">
                        <FormLabel>คำนำหน้า</FormLabel>
                        <TextField {...field} select value={field.value ?? ""}>
                          {[
                            "",
                            "นาย",
                            "นาง",
                            "นางสาว",
                            "ว่าที่ ร.ต.",
                            "บริษัท",
                            "หจก.",
                            "สหกรณ์",
                          ].map((t) => (
                            <MenuItem key={t} value={t}>
                              {t || "—"}
                            </MenuItem>
                          ))}
                        </TextField>
                      </FormControl>
                    )}
                  />

                  <Controller
                    control={control}
                    name="firstName"
                    render={({ field }) => (
                      <FormControl className="w-full md:w-2/5">
                        <FormLabel>First name</FormLabel>
                        <TextField
                          {...field}
                          value={field.value ?? ""}
                          error={!!errors.firstName}
                          helperText={errors?.firstName?.message}
                        />
                      </FormControl>
                    )}
                  />

                  <Controller
                    control={control}
                    name="lastName"
                    render={({ field }) => (
                      <FormControl className="w-full md:w-2/5">
                        <FormLabel>Last name</FormLabel>
                        <TextField
                          {...field}
                          value={field.value ?? ""}
                          error={!!errors.lastName}
                          helperText={errors?.lastName?.message}
                        />
                      </FormControl>
                    )}
                  />
                </Stack>

                {/* แถว 2: Status */}
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <Controller
                    control={control}
                    name="status"
                    render={({ field }) => (
                      <FormControl className="w-full md:w-1/5">
                        <FormLabel>Status</FormLabel>
                        <TextField
                          {...field}
                          select
                          value={field.value ?? "Active"}
                        >
                          {["Active", "Suspend", "Blacklist"].map((s) => (
                            <MenuItem key={s} value={s}>
                              {s}
                            </MenuItem>
                          ))}
                        </TextField>
                      </FormControl>
                    )}
                  />
                </Stack>

                {/* แถว 3: Address */}
                <Controller
                  control={control}
                  name="address"
                  render={({ field }) => (
                    <FormControl className="w-full">
                      <FormLabel>Address</FormLabel>
                      <TextField
                        {...field}
                        value={field.value ?? ""}
                        multiline
                        minRows={3}
                        error={!!errors.address}
                        helperText={errors?.address?.message}
                      />
                    </FormControl>
                  )}
                />

                {/* แถว 4: Location */}
                <LocationCascadeSelect
                  lang="th"
                  value={locTH}
                  onChange={(v) => {
                    setLocTH(v);
                    setValue("provinceCode", v.provinceCode ?? null, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    setValue("districtCode", v.districtCode ?? null, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    setValue("subdistrictCode", v.subdistrictCode ?? null, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    setValue("postalCode", v.postalCode ?? null, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                  helperTextProvince="จังหวัด"
                  helperTextDistrict="อำเภอ/เขต"
                  helperTextSubdistrict="ตำบล/แขวง"
                  helperTextPostalCode="รหัสไปรษณีย์"
                  showPostalInOptions={false}
                />

                {/* แถว 5: Phone / Cert No / Cert Expiry */}
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <Controller
                    control={control}
                    name="phone"
                    render={({ field }) => (
                      <FormControl className="w-full md:w-1/3">
                        <FormLabel>Phone</FormLabel>
                        <TextField
                          {...field}
                          value={field.value ?? ""}
                          placeholder="0XX-XXX-XXXX"
                          onChange={(e) => {
                            const cleaned = e.target.value
                              .replace(/\D/g, "")
                              .slice(0, 10);
                            let formatted = cleaned;
                            if (cleaned.length > 6) {
                              formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
                            } else if (cleaned.length > 3) {
                              formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
                            }
                            field.onChange(formatted);
                          }}
                        />
                      </FormControl>
                    )}
                  />
                  <Controller
                    control={control}
                    name="certificateNo"
                    render={({ field }) => (
                      <FormControl className="w-full md:w-1/3">
                        <FormLabel>Certificate No.</FormLabel>
                        <TextField {...field} value={field.value ?? ""} />
                      </FormControl>
                    )}
                  />
                  <Controller
                    control={control}
                    name="certificateExpiry"
                    render={({ field: { value, onChange } }) => (
                      <FormControl className="w-full md:w-1/3">
                        <FormLabel>Certificate Expiry</FormLabel>
                        <DatePicker
                          value={value ? new Date(value) : null}
                          onChange={(d) => {
                            const iso = d
                              ? new Date(d as any).toISOString().slice(0, 10)
                              : "";
                            onChange(iso);
                          }}
                          slotProps={{ textField: { fullWidth: true } }}
                        />
                      </FormControl>
                    )}
                  />
                </Stack>

                {/* แถว 6: Rubber Types (✅ ใช้ ids, โหลดจาก API) */}
                <Controller
                  control={control}
                  name="rubberTypeIds"
                  render={({ field }) => (
                    <FormControl className="w-full">
                      <FormLabel>Rubber Types</FormLabel>
                      <Box display="flex" gap={1} flexWrap="wrap">
                        {rubberTypeOptions.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            ไม่มีตัวเลือกหรือโหลดไม่สำเร็จ
                          </Typography>
                        ) : (
                          rubberTypeOptions.map((opt) => {
                            const selected = (field.value || []).includes(
                              opt.id
                            );
                            return (
                              <Chip
                                key={opt.id}
                                label={opt.name}
                                variant={selected ? "filled" : "outlined"}
                                color={selected ? "primary" : "default"}
                                onClick={() => {
                                  const set = new Set<string>(
                                    field.value || []
                                  );
                                  if (set.has(opt.id)) set.delete(opt.id);
                                  else set.add(opt.id);
                                  field.onChange(Array.from(set));
                                }}
                              />
                            );
                          })
                        )}
                      </Box>
                    </FormControl>
                  )}
                />

                {/* แถว 7: Score / USS / CL */}
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <Controller
                    control={control}
                    name="score"
                    render={({ field }) => (
                      <FormControl className="w-full md:w-1/3">
                        <FormLabel>Score</FormLabel>
                        <TextField
                          {...field}
                          type="number"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? null
                                : Number(e.target.value)
                            )
                          }
                          InputLabelProps={{ shrink: true }}
                        />
                      </FormControl>
                    )}
                  />
                  <Controller
                    control={control}
                    name="ussEudrQuota"
                    render={({ field }) => (
                      <FormControl className="w-full md:w-1/3">
                        <FormLabel>USS EUDR Quota</FormLabel>
                        <TextField
                          {...field}
                          type="number"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? null
                                : Number(e.target.value)
                            )
                          }
                          InputLabelProps={{ shrink: true }}
                        />
                      </FormControl>
                    )}
                  />
                  <Controller
                    control={control}
                    name="clEudrQuota"
                    render={({ field }) => (
                      <FormControl className="w-full md:w-1/3">
                        <FormLabel>CL EUDR Quota</FormLabel>
                        <TextField
                          {...field}
                          type="number"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? null
                                : Number(e.target.value)
                            )
                          }
                          InputLabelProps={{ shrink: true }}
                        />
                      </FormControl>
                    )}
                  />
                </Stack>

                {/* แถว 8: Note */}
                <Controller
                  control={control}
                  name="note"
                  render={({ field }) => (
                    <FormControl className="w-full">
                      <FormLabel>Note</FormLabel>
                      <TextField
                        {...field}
                        value={field.value ?? ""}
                        multiline
                        minRows={3}
                      />
                    </FormControl>
                  )}
                />
              </Stack>
            </form>
          </Paper>
        </div>
      </div>

      {/* Footer actions */}
      <Box
        className="flex items-center border-t py-3.5 pr-4 pl-1 sm:pr-12 sm:pl-9"
        sx={{ backgroundColor: "background.default" }}
      >
        {!isNew && (
          <Button
            color="error"
            onClick={onDelete}
            startIcon={<FuseSvgIcon>lucide:trash</FuseSvgIcon>}
          >
            Delete
          </Button>
        )}

        <Button component={Link} className="ml-auto" href={"/suppliers/list"}>
          Cancel
        </Button>

        <Button
          className="ml-2"
          variant="contained"
          color="secondary"
          type="submit"
          form="supplier-form"
          disabled={!canSave}
          startIcon={<FuseSvgIcon>lucide:save</FuseSvgIcon>}
        >
          Save
        </Button>
      </Box>

      {/* Toast */}
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
