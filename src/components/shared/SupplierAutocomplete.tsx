"use client";

import { Supplier } from "@/types/supplier";
import {
  Autocomplete,
  AutocompleteProps,
  CircularProgress,
  TextField,
  TextFieldProps,
} from "@mui/material";
import * as React from "react";

const SUPPLIER_ENDPOINT = "/api/suppliers";

type SupplierAutocompleteProps = {
  value: Supplier | null;
  onChange: (supplier: Supplier | null) => void;
  textFieldProps?: TextFieldProps;
} & Omit<
  AutocompleteProps<Supplier, false, false, false>,
  "options" | "renderInput" | "onChange" | "value"
>;

export default function SupplierAutocomplete({
  value,
  onChange,
  textFieldProps,
  ...autoCompleteProps
}: SupplierAutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<readonly Supplier[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setOptions([]);
      return;
    }
    let isAbort = false;
    const ctrl = new AbortController();
    const fetchSuppliers = async () => {
      setLoading(true);
      try {
        const url = new URL(SUPPLIER_ENDPOINT, window.location.origin);
        if (query.trim()) url.searchParams.set("q", query.trim());
        url.searchParams.set("limit", "20");
        const res = await fetch(url.toString(), {
          cache: "no-store",
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to fetch");
        if (!isAbort) setOptions(json.data || []);
      } catch (e: any) {
        if (e.name !== "AbortError" && !isAbort) console.error(e);
      } finally {
        if (!isAbort) setLoading(false);
      }
    };
    const t = setTimeout(fetchSuppliers, 300);
    return () => {
      isAbort = true;
      ctrl.abort();
      clearTimeout(t);
    };
  }, [open, query]);

  return (
    <Autocomplete
      {...autoCompleteProps}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={options}
      loading={loading}
      value={value}
      onChange={(_e, newValue) => onChange(newValue)}
      onInputChange={(_e, newInputValue) => setQuery(newInputValue)}
      isOptionEqualToValue={(option, val) => option._id === val._id}
      getOptionLabel={(option) =>
        `${option.supCode} - ${option.title || ""}${option.firstName || ""} ${option.lastName || ""}`.trim()
      }
      filterOptions={(x) => x}
      slotProps={{
        popper: {
          sx: {
            zIndex: (theme) => theme.zIndex.modal + 1,
          },
        },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Supplier"
          placeholder="พิมพ์เพื่อค้นหารหัสหรือชื่อ..."
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? (
                  <CircularProgress color="inherit" size={20} />
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
          {...textFieldProps}
        />
      )}
    />
  );
}
