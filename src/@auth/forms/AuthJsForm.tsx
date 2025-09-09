// src/@auth/forms/AuthJsForm.tsx
"use client";

import Link from "@fuse/core/Link";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  TextField,
} from "@mui/material";
import _ from "lodash";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import AuthJsProviderSelect from "./AuthJsProviderSelect";
import signinErrors from "./signinErrors";

/* ===== Props ===== */
type AuthJsFormProps = {
  formType?: "signin";
  /** fallback ถ้าไม่มี callbackUrl และไม่มี route จาก system */
  defaultCallbackUrl?: string;
};

/* ===== Schema ===== */
const SystemEnum = z.enum(["qr", "dla", "pm"]);

const schema = z.object({
  email: z
    .string()
    .email("You must enter a valid email")
    .nonempty("You must enter an email"),
  password: z
    .string()
    .min(8, "Password is too short - must be at least 8 chars.")
    .nonempty("Please enter your password."),
  remember: z.boolean().optional(),
  system: SystemEnum, // ต้องเลือกเสมอ
});

type FormType = z.infer<typeof schema>;

const defaultValues: FormType = {
  email: "",
  password: "",
  remember: true,
  system: "qr",
};

/* 🔧 กำหนดปลายทางตามระบบที่เลือก (แก้ได้ตามใจ) */
const ROUTE_BY_SYSTEM: Record<FormType["system"], string> = {
  qr: "/dashboard/qr-code/v1",
  dla: "/dashboard/dla/v1",
  pm: "/dashboard/pm/v1",
};

/* ===== Component ===== */
function AuthJsForm({
  formType = "signin",
  defaultCallbackUrl = "/",
}: AuthJsFormProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlErrorType = searchParams.get("error");
  const callbackUrlFromUrl = searchParams.get("callbackUrl"); // 🔧 ถ้ามี query จะชนะทุกอย่าง

  const urlErrorMsg =
    urlErrorType && (signinErrors[urlErrorType] ?? signinErrors.default);

  const { control, formState, handleSubmit, setError } = useForm<FormType>({
    mode: "onChange",
    defaultValues,
    resolver: zodResolver(schema),
  });

  const { isValid, dirtyFields, errors } = formState;

  /* 🔧 ฟังก์ชันเลือกปลายทางตามลำดับความสำคัญ */
  function resolveRedirectTarget(system: FormType["system"]) {
    // 1) callbackUrl จาก query มาก่อน
    if (callbackUrlFromUrl) return callbackUrlFromUrl;

    // 2) route map ตาม system
    const fromSystem = ROUTE_BY_SYSTEM[system];
    if (fromSystem) return fromSystem;

    // 3) fallback prop
    return defaultCallbackUrl || "/";
  }

  async function onSubmit(values: FormType) {
    const { email, password, system } = values;

    try {
      localStorage.setItem("selected_system", system);
    } catch {}

    // แนะนำให้ใช้ redirect:false แล้วค่อย router.push เอง จะ control ง่ายสุด
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("root", {
        type: "manual",
        message: signinErrors[result.error] ?? "Sign in failed",
      });
      return false;
    }

    // 🔧 ตัดสินใจปลายทางที่นี่
    const target = resolveRedirectTarget(system);
    router.push(target);
    return true;
  }

  return (
    <form
      name="loginForm"
      noValidate
      className="flex w-full flex-col justify-center gap-4"
      onSubmit={handleSubmit(onSubmit)}
    >
      {urlErrorMsg && (
        <Alert
          className="mt-2"
          severity="error"
          sx={(theme) => ({
            backgroundColor: theme.palette.error.light,
            color: theme.palette.error.dark,
          })}
        >
          {urlErrorMsg}
        </Alert>
      )}

      {/* Email */}
      <Controller
        name="email"
        control={control}
        render={({ field }) => (
          <FormControl>
            <FormLabel htmlFor="email">Email address</FormLabel>
            <TextField
              {...field}
              autoFocus
              type="email"
              error={!!errors.email}
              helperText={errors?.email?.message}
              required
              fullWidth
            />
          </FormControl>
        )}
      />

      {/* Password */}
      <Controller
        name="password"
        control={control}
        render={({ field }) => (
          <FormControl>
            <FormLabel htmlFor="password">Password</FormLabel>
            <TextField
              {...field}
              type="password"
              error={!!errors.password}
              helperText={errors?.password?.message}
              required
              fullWidth
            />
          </FormControl>
        )}
      />

      {/* Select System */}
      <Controller
        name="system"
        control={control}
        defaultValue="qr"
        render={({ field }) => (
          <FormControl>
            <FormLabel>Select System</FormLabel>
            <TextField
              {...field}
              select
              required
              value={field.value ?? "qr"}
              error={!!errors.system}
              helperText={
                errors.system?.message ? "Please select a system" : undefined
              }
              fullWidth
            >
              <MenuItem value="qr">QR Code</MenuItem>
              <MenuItem value="dla">Data Lake and Analytics</MenuItem>
              <MenuItem value="pm">Project management</MenuItem>
            </TextField>
          </FormControl>
        )}
      />

      {/* Remember + Forgot */}
      <div className="flex flex-col items-center justify-center sm:flex-row sm:justify-between">
        <Controller
          name="remember"
          control={control}
          render={({ field }) => (
            <FormControl>
              <FormControlLabel
                label="Remember me"
                control={<Checkbox size="small" {...field} />}
              />
            </FormControl>
          )}
        />

        <Link className="text-md font-medium" to="/pages/auth/forgot-password">
          Forgot password?
        </Link>
      </div>

      {/* Submit */}
      <Button
        variant="contained"
        color="secondary"
        className="w-full"
        aria-label="Sign in"
        disabled={_.isEmpty(dirtyFields) || !isValid}
        type="submit"
        size="medium"
      >
        Sign in
      </Button>

      {/* Social providers */}
      <AuthJsProviderSelect />
    </form>
  );
}

export default AuthJsForm;
