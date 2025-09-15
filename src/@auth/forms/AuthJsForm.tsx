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
import { getSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import AuthJsProviderSelect from "./AuthJsProviderSelect";
import signinErrors from "./signinErrors";

/* ===== Props ===== */
type AuthJsFormProps = {
  formType?: "signin";
  /** fallback ปลายทางหลังล็อกอิน ถ้าไม่มี callbackUrl และไม่มี route จาก system */
  defaultCallbackUrl?: string;
};

/* ===== Schema ===== */
const SystemEnum = z.enum(["qr", "dla", "pm"]);

const schema = z.object({
  email: z.string().email("You must enter a valid email").nonempty("You must enter an email"),
  password: z
    .string()
    .min(8, "Password is too short - must be at least 8 chars.")
    .nonempty("Please enter your password."),
  remember: z.boolean().optional(),
  system: SystemEnum, // บังคับเลือก
});

type FormType = z.infer<typeof schema>;

const defaultValues: FormType = {
  email: "",
  password: "",
  remember: true,
  system: "qr",
};

/** กำหนดปลายทางตามระบบที่เลือก */
const ROUTE_BY_SYSTEM: Record<FormType["system"], string> = {
  qr: "/dashboard/qr-code/v1",
  dla: "/dashboard/dla/v1",
  pm: "/dashboard/pm/v1",
};

/** แปลง error key -> ข้อความอ่านง่าย (ขยายได้ตามต้องการ) */
const FRIENDLY_AUTH_ERRORS: Record<string, string> = {
  MissingCSRF:
    "ไม่พบ CSRF token. โปรดเปิดเว็บด้วยโดเมน/พอร์ตเดียวกับ NEXTAUTH_URL/AUTH_URL ที่ตั้งไว้ใน .env.local (ห้ามสลับ localhost กับ IP)",
  CredentialsSignin: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  default: "Sign in failed",
};

function AuthJsForm({ formType = "signin", defaultCallbackUrl = "/" }: AuthJsFormProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlErrorType = searchParams.get("error");
  const callbackUrlFromUrl = searchParams.get("callbackUrl"); // ชนะทุกอย่างถ้ามี
  const urlErrorMsg = urlErrorType && (signinErrors[urlErrorType] ?? signinErrors.default);

  const { control, formState, handleSubmit, setError } = useForm<FormType>({
    mode: "onChange",
    defaultValues,
    resolver: zodResolver(schema),
  });

  const { isValid, dirtyFields, errors } = formState;

  /** หาปลายทางที่ควรไปหลังล็อกอิน */
  function resolveRedirectTarget(system: FormType["system"]) {
    if (callbackUrlFromUrl) return callbackUrlFromUrl;
    const fromSystem = ROUTE_BY_SYSTEM[system];
    if (fromSystem) return fromSystem;
    return defaultCallbackUrl || "/";
  }

  /** ดึง CSRF token ให้แน่ใจว่ามี และผูกกับ origin เดียวกับหน้าเว็บ */
  async function fetchCsrfToken(): Promise<string> {
    try {
      const r = await fetch("/api/auth/csrf", { credentials: "include" });
      if (!r.ok) return "";
      const data = (await r.json()) as any;
      // รองรับหลายรูปแบบที่ NextAuth อาจคืนมา
      return data?.csrfToken || data?.token || "";
    } catch {
      return "";
    }
  }

  /** ป้องกัน origin/host mismatch (ช่วยเตือน dev) */
  function assertOriginMatchesEnv() {
    // แบบ best-effort: ช่วยเตือนถ้า dev สลับ localhost กับ IP
    try {
      const envUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXTAUTH_URL ||
        process.env.AUTH_URL ||
        "";
      if (!envUrl) return;

      const current = new URL(window.location.origin);
      const expected = new URL(envUrl);

      if (current.host !== expected.host || current.protocol !== expected.protocol) {
        // เตือนใน console ให้ dev เห็น
        // eslint-disable-next-line no-console
        console.warn(
          "[Auth] Host/Protocol mismatch:",
          { current: current.origin, expected: expected.origin },
          "=> คุกกี้ CSRF อาจไม่ติดตาม ทำให้ MissingCSRF ได้"
        );
      }
    } catch {
      // ignore
    }
  }

  async function onSubmit(values: FormType) {
    const { email, password, system } = values;

    assertOriginMatchesEnv();

    try {
      localStorage.setItem("selected_system", system);
    } catch {
      // ignore
    }

    // 1) ดึง CSRF token ก่อน
    const csrfToken = await fetchCsrfToken();
    if (!csrfToken) {
      setError("root", { type: "manual", message: FRIENDLY_AUTH_ERRORS.MissingCSRF });
      return false;
    }

    // 2) ยิง signIn พร้อม csrfToken และ redirect:false
    const result = await signIn("credentials", {
      email,
      password,
      csrfToken, // คีย์สำคัญสำหรับบางสภาพแวดล้อม dev
      redirect: false,
      // baseUrl จะอิง origin ปัจจุบันอยู่แล้ว ไม่จำเป็นต้องกำหนด
      // callbackUrl: resolveRedirectTarget(system), // เราจะ push เองข้างล่าง
    });

    // debug เฉพาะ dev
    // eslint-disable-next-line no-console
    console.log("signIn result", result);

    if (result?.error) {
      const msg =
        FRIENDLY_AUTH_ERRORS[result.error] ??
        signinErrors[result.error] ??
        FRIENDLY_AUTH_ERRORS.default;
      setError("root", { type: "manual", message: msg });
      return false;
    }

    // 3) โหลด session มาเช็ค flag เพิ่มเติม (ถ้าคุณเก็บ mustChangePassword ใน session แล้ว)
    const sess = await getSession();
    const mustChange = (sess as any)?.user?.mustChangePassword;

    if (mustChange) {
      router.push("/change-password");
      return true;
    }

    // 4) สำเร็จ → ไปปลายทางที่ต้องการ
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
      {/* error จาก query เช่น /sign-in?error=CredentialsSignin */}
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
              helperText={errors.system?.message ? "Please select a system" : undefined}
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

      {/* Social providers (ถ้ามี) */}
      <AuthJsProviderSelect />
    </form>
  );
}

export default AuthJsForm;