// src/app/(public)/sign-in/AuthJsCredentialsSignInForm.tsx
import Link from "@fuse/core/Link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert } from "@mui/material";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import _ from "lodash";
import { signIn } from "next-auth/react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import signinErrors from "./signinErrors";

const schema = z.object({
  email: z
    .string()
    .email("You must enter a valid email")
    .nonempty("You must enter an email"),
  password: z
    .string()
    .min(4, "Password is too short - must be at least 4 chars.")
    .nonempty("Please enter your password."),
  remember: z.boolean().optional(),
});

type FormType = z.infer<typeof schema>;

const defaultValues: FormType = {
  email: "",
  password: "",
  remember: true,
};

function AuthJsCredentialsSignInForm() {
  const { control, formState, handleSubmit, setError } = useForm<FormType>({
    mode: "onChange",
    defaultValues,
    resolver: zodResolver(schema),
  });

  const { isValid, dirtyFields, errors } = formState;

  async function onSubmit(formData: FormType) {
    const { email, password } = formData;

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false, // ให้เราคุมการนำทางเอง
    });

    if (result?.error) {
      setError("root", {
        type: "manual",
        message: signinErrors[result.error] ?? "Sign in failed",
      });
      return false;
    }

    // สำเร็จ: ให้หน้า AuthGuard/route ของคุณเป็นคนพากลับตาม logic เดิม
    return true;
  }

  return (
    <form
      name="loginForm"
      noValidate
      className="flex w-full flex-col justify-center"
      onSubmit={handleSubmit(onSubmit)}
    >
      {errors?.root?.message && (
        <Alert
          className="mb-8"
          severity="error"
          sx={(theme) => ({
            backgroundColor: theme.palette.error.light,
            color: theme.palette.error.dark,
          })}
        >
          {errors?.root?.message}
        </Alert>
      )}

      <Controller
        name="email"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            className="mb-6"
            label="Email"
            autoFocus
            type="email"
            error={!!errors.email}
            helperText={errors?.email?.message}
            variant="outlined"
            required
            fullWidth
          />
        )}
      />

      <Controller
        name="password"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            className="mb-6"
            label="Password"
            type="password"
            error={!!errors.password}
            helperText={errors?.password?.message}
            variant="outlined"
            required
            fullWidth
          />
        )}
      />

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
        <Link className="text-md font-medium" to="/#">
          Forgot password?
        </Link>
      </div>

      <Button
        variant="contained"
        color="secondary"
        className="mt-4 w-full"
        aria-label="Sign in"
        disabled={_.isEmpty(dirtyFields) || !isValid}
        type="submit"
        size="large"
      >
        Sign in
      </Button>
    </form>
  );
}

export default AuthJsCredentialsSignInForm;
