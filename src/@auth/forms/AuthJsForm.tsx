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
  TextField,
} from "@mui/material";
import _ from "lodash";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import AuthJsProviderSelect from "./AuthJsProviderSelect";
import signinErrors from "./signinErrors";

type AuthJsFormProps = {
  /** เดิมเป็น 'signin' | 'signup' แต่เพื่อให้เหมือน SignInPageForm ให้แสดงฟอร์ม Sign In เป็นหลัก */
  formType?: "signin"; // ฟิกซ์ให้เป็น signin เพื่อความชัดเจน (ถ้าจะรองรับ signup ค่อยแยกคอมโพเนนต์)
  /** ตั้งค่า default callback หลัง login (ถ้าต้องการ) */
  defaultCallbackUrl?: string;
};

/** ให้สอดคล้องกับ SignInPageForm: label/โครง MUI + validation */
const schema = z.object({
  email: z
    .string()
    .email("You must enter a valid email")
    .nonempty("You must enter an email"),
  // ให้เหมือน SignInPageForm: min 8 chars
  password: z
    .string()
    .min(8, "Password is too short - must be at least 8 chars.")
    .nonempty("Please enter your password."),
  remember: z.boolean().optional(),
});

type FormType = z.infer<typeof schema>;

const defaultValues: FormType = {
  email: "",
  password: "",
  remember: true,
};

function AuthJsForm({
  formType = "signin",
  defaultCallbackUrl = "/",
}: AuthJsFormProps) {
  const searchParams = useSearchParams();
  const urlErrorType = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") || defaultCallbackUrl;

  const urlErrorMsg =
    urlErrorType && (signinErrors[urlErrorType] ?? signinErrors.default);

  const { control, formState, handleSubmit, setError } = useForm<FormType>({
    mode: "onChange",
    defaultValues,
    resolver: zodResolver(schema),
  });

  const { isValid, dirtyFields, errors } = formState;

  async function onSubmit(values: FormType) {
    const { email, password } = values;

    // ใช้ redirect: false เพื่อให้ AuthGuard/logic ภายนอกเป็นคนพาไปหน้าเป้าหมาย
    // ถ้าอยากให้หน้านี้พาไปเองให้เปลี่ยนเป็น redirect: true, callbackUrl
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      // callbackUrl, // ถ้าอยากให้ฟอร์มพา redirect เอง ค่อยเปิดใช้งาน
    });

    if (result?.error) {
      setError("root", {
        type: "manual",
        message: signinErrors[result.error] ?? "Sign in failed",
      });
      return false;
    }

    return true;
  }

  // ฟอร์มนี้ทำหน้าที่ “Sign In” อย่างเดียว เพื่อให้หน้าตาตรงกับ SignInPageForm
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

      {/* ปุ่ม social แบบ dynamic ผ่าน AuthJsProviderSelect (แทนปุ่ม mock) */}
      <AuthJsProviderSelect />
    </form>
  );
}

export default AuthJsForm;
