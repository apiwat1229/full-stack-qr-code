// src/components/LocationCascadeSelect.tsx
"use client";

import {
  Autocomplete,
  Box,
  CircularProgress,
  FormControl,
  Stack,
  TextField,
} from "@mui/material";
import * as React from "react";

/* ================= Types ================= */
type Province = { _id: number; nameTh?: string; nameEn?: string };
type District = {
  _id: number;
  nameTh?: string;
  nameEn?: string;
  postalCode?: number;
};
type Subdistrict = {
  _id: number;
  nameTh?: string;
  nameEn?: string;
  postalCode?: number;
};

export type LocationValue = {
  provinceCode?: number | null;
  districtCode?: number | null;
  subdistrictCode?: number | null;
  postalCode?: number | null; // auto-filled from subdistrict
};

type Option = {
  code: number;
  label: string;
  postalCode?: number;
};

type Props = {
  value?: LocationValue; // controlled
  onChange?: (val: LocationValue) => void;
  helperTextProvince?: string;
  helperTextDistrict?: string;
  helperTextSubdistrict?: string;
  helperTextPostalCode?: string;
  requiredProvince?: boolean;
  requiredDistrict?: boolean;
  requiredSubdistrict?: boolean;
  disabled?: boolean;
  /**
   * ถ้าไม่ส่ง จะใช้ '/api' (proxy ของ Next) เป็นค่าเริ่มต้น
   * เพื่อลดปัญหา TLS กับ upstream
   */
  apiBaseUrl?: string;
  size?: "small" | "medium";
  showPostalCodeField?: boolean; // default true
  showPostalInOptions?: boolean; // default false
  lang?: "en" | "th"; // default "en"
};

/* =============== helpers =============== */
async function safeJson<T = any>(res: Response): Promise<T> {
  const txt = await res.text();
  try {
    return JSON.parse(txt) as T;
  } catch {
    // โยน error ที่อ่านง่าย เวลา backend ตอบ text/plain
    throw new Error(txt || `HTTP ${res.status}`);
  }
}

const LocationCascadeSelect: React.FC<Props> = ({
  value,
  onChange,
  helperTextProvince,
  helperTextDistrict,
  helperTextSubdistrict,
  helperTextPostalCode,
  requiredProvince,
  requiredDistrict,
  requiredSubdistrict,
  disabled,
  apiBaseUrl,
  size = "small",
  showPostalCodeField = true,
  showPostalInOptions = false,
  lang = "en",
}) => {
  // ค่า default → ใช้ Next API routes (proxy): /api
  // คุณสามารถส่ง apiBaseUrl เข้ามาเพื่อ override ได้ (เช่น ชี้ตรงไป backend)
  const API = React.useMemo(
    () => (apiBaseUrl && apiBaseUrl !== "" ? apiBaseUrl : "/api"),
    [apiBaseUrl]
  );

  // uncontrolled fallback
  const [ucValue, setUcValue] = React.useState<LocationValue>({
    provinceCode: null,
    districtCode: null,
    subdistrictCode: null,
    postalCode: null,
  });
  const isControlled = typeof value !== "undefined";
  const current = isControlled ? (value as LocationValue) : ucValue;
  const setValue = (next: LocationValue) => {
    if (isControlled) onChange?.(next);
    else {
      setUcValue(next);
      onChange?.(next);
    }
  };

  // raw data
  const [provinces, setProvinces] = React.useState<Province[]>([]);
  const [districts, setDistricts] = React.useState<District[]>([]);
  const [subdistricts, setSubdistricts] = React.useState<Subdistrict[]>([]);

  const [loadingProvinces, setLoadingProvinces] = React.useState(false);
  const [loadingDistricts, setLoadingDistricts] = React.useState(false);
  const [loadingSubdistricts, setLoadingSubdistricts] = React.useState(false);

  const pvText = (p?: Province) =>
    String(
      (lang === "th" ? p?.nameTh : p?.nameEn) ??
        p?.nameEn ??
        p?.nameTh ??
        p?._id ??
        ""
    );
  const dtText = (d?: District) =>
    String(
      (lang === "th" ? d?.nameTh : d?.nameEn) ??
        d?.nameEn ??
        d?.nameTh ??
        d?._id ??
        ""
    );
  const sbText = (s?: Subdistrict) =>
    String(
      (lang === "th" ? s?.nameTh : s?.nameEn) ??
        s?.nameEn ??
        s?.nameTh ??
        s?._id ??
        ""
    );
  const withPostal = (text: string, postal?: number) =>
    showPostalInOptions && postal ? `${text} (${postal})` : text;

  /* ============ load provinces (once) ============ */
  React.useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setLoadingProvinces(true);
      try {
        const res = await fetch(`${API}/locations/provinces`, {
          cache: "no-store",
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(await res.text());
        const list = await safeJson<Province[]>(res);
        setProvinces(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("load provinces failed:", err);
          setProvinces([]);
        }
      } finally {
        setLoadingProvinces(false);
      }
    })();
    return () => ac.abort();
  }, [API]);

  /* ============ load districts on province change ============ */
  React.useEffect(() => {
    const pv = current.provinceCode;
    // เคลียร์ลูกเสมอ
    setDistricts([]);
    setSubdistricts([]);

    // sync ค่าในฟอร์ม
    setValue({
      provinceCode: pv ?? null,
      districtCode: null,
      subdistrictCode: null,
      postalCode: null,
    });

    if (!pv) return;

    const ac = new AbortController();
    (async () => {
      setLoadingDistricts(true);
      try {
        const res = await fetch(
          `${API}/locations/districts?provinceCode=${pv}`,
          { cache: "no-store", signal: ac.signal }
        );
        if (!res.ok) throw new Error(await res.text());
        const list = await safeJson<District[]>(res);
        setDistricts(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("load districts failed:", err);
          setDistricts([]);
        }
      } finally {
        setLoadingDistricts(false);
      }
    })();

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.provinceCode, API]);

  /* ============ load subdistricts on district change ============ */
  React.useEffect(() => {
    const d = current.districtCode;

    // เคลียร์ลูกและไปรษณีย์
    setSubdistricts([]);
    setValue({ ...current, subdistrictCode: null, postalCode: null });

    if (!d) return;

    const ac = new AbortController();
    (async () => {
      setLoadingSubdistricts(true);
      try {
        const res = await fetch(
          `${API}/locations/subdistricts?districtCode=${d}`,
          { cache: "no-store", signal: ac.signal }
        );
        if (!res.ok) throw new Error(await res.text());
        const list = await safeJson<Subdistrict[]>(res);
        setSubdistricts(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("load subdistricts failed:", err);
          setSubdistricts([]);
        }
      } finally {
        setLoadingSubdistricts(false);
      }
    })();

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.districtCode, API]);

  /* ============ auto-fill postal from selected subdistrict ============ */
  React.useEffect(() => {
    if (!current.subdistrictCode) {
      if (current.postalCode) {
        setValue({ ...current, postalCode: null });
      }
      return;
    }
    const found = subdistricts.find((s) => s._id === current.subdistrictCode);
    const pc = found?.postalCode ?? null;
    if (pc !== current.postalCode) {
      setValue({ ...current, postalCode: pc });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.subdistrictCode, subdistricts]);

  /* ============ build options ============ */
  const provinceOptions: Option[] = React.useMemo(
    () => provinces.map((p) => ({ code: p._id, label: pvText(p) })),
    [provinces, lang]
  );
  const districtOptions: Option[] = React.useMemo(
    () =>
      districts.map((d) => ({
        code: d._id,
        label: withPostal(dtText(d), d.postalCode),
        postalCode: d.postalCode,
      })),
    [districts, lang, showPostalInOptions]
  );
  const subdistrictOptions: Option[] = React.useMemo(
    () =>
      subdistricts.map((s) => ({
        code: s._id,
        label: withPostal(sbText(s), s.postalCode),
        postalCode: s.postalCode,
      })),
    [subdistricts, lang, showPostalInOptions]
  );

  // derive selected Option from code
  const selectedProvince =
    provinceOptions.find((o) => o.code === current.provinceCode) || null;
  const selectedDistrict =
    districtOptions.find((o) => o.code === current.districtCode) || null;
  const selectedSubdistrict =
    subdistrictOptions.find((o) => o.code === current.subdistrictCode) || null;

  // labels
  const lblProvince = lang === "en" ? "Province" : "จังหวัด";
  const lblDistrict = lang === "en" ? "District" : "อำเภอ/เขต";
  const lblSubdistrict = lang === "en" ? "Subdistrict" : "ตำบล/แขวง";
  const lblPostal = lang === "en" ? "Postal Code" : "รหัสไปรษณีย์";
  const txtLoading = lang === "en" ? "Loading…" : "กำลังโหลด…";

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      {/* Province */}
      <FormControl fullWidth size={size} disabled={disabled}>
        <Autocomplete
          disablePortal
          options={provinceOptions}
          loading={loadingProvinces}
          value={selectedProvince}
          isOptionEqualToValue={(o, v) => o.code === v.code}
          getOptionLabel={(o) => o.label}
          onChange={(_, opt) =>
            setValue({
              provinceCode: opt?.code ?? null,
              districtCode: null,
              subdistrictCode: null,
              postalCode: null,
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label={lblProvince}
              required={!!requiredProvince}
              helperText={helperTextProvince}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    {loadingProvinces ? <CircularProgress size={18} /> : null}
                    {params.InputProps.endAdornment}
                  </Box>
                ),
              }}
            />
          )}
          noOptionsText={loadingProvinces ? txtLoading : undefined}
        />
      </FormControl>

      {/* District */}
      <FormControl
        fullWidth
        size={size}
        disabled={disabled || !current.provinceCode || loadingProvinces}
      >
        <Autocomplete
          disablePortal
          options={districtOptions}
          loading={loadingDistricts}
          value={selectedDistrict}
          isOptionEqualToValue={(o, v) => o.code === v.code}
          getOptionLabel={(o) => o.label}
          onChange={(_, opt) =>
            setValue({
              ...current,
              districtCode: opt?.code ?? null,
              subdistrictCode: null,
              postalCode: null,
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label={lblDistrict}
              required={!!requiredDistrict}
              helperText={helperTextDistrict}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    {loadingDistricts ? <CircularProgress size={18} /> : null}
                    {params.InputProps.endAdornment}
                  </Box>
                ),
              }}
            />
          )}
          noOptionsText={loadingDistricts ? txtLoading : undefined}
        />
      </FormControl>

      {/* Subdistrict */}
      <FormControl
        fullWidth
        size={size}
        disabled={disabled || !current.districtCode || loadingDistricts}
      >
        <Autocomplete
          disablePortal
          options={subdistrictOptions}
          loading={loadingSubdistricts}
          value={selectedSubdistrict}
          isOptionEqualToValue={(o, v) => o.code === v.code}
          getOptionLabel={(o) => o.label}
          onChange={(_, opt) =>
            setValue({
              ...current,
              subdistrictCode: opt?.code ?? null, // postal จะถูกเติมโดย useEffect
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label={lblSubdistrict}
              required={!!requiredSubdistrict}
              helperText={helperTextSubdistrict}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    {loadingSubdistricts ? (
                      <CircularProgress size={18} />
                    ) : null}
                    {params.InputProps.endAdornment}
                  </Box>
                ),
              }}
            />
          )}
          noOptionsText={loadingSubdistricts ? txtLoading : undefined}
        />
      </FormControl>

      {/* Postal Code (read-only) */}
      {showPostalCodeField && (
        <TextField
          label={lblPostal}
          fullWidth
          size={size}
          value={current.postalCode ?? ""}
          InputProps={{ readOnly: true }}
          helperText={
            helperTextPostalCode ||
            (lang === "en"
              ? "Auto-filled from Subdistrict"
              : "กรอกอัตโนมัติจากตำบล/แขวง")
          }
        />
      )}
    </Stack>
  );
};

export default LocationCascadeSelect;
