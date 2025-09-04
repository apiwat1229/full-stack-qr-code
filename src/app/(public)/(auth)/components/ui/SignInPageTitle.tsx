import Link from "@fuse/core/Link";
import Typography from "@mui/material/Typography";

function SignInPageTitle() {
  return (
    <div className="w-full">
      <img
        className="w-22"
        // src="/assets/images/logo/logo.svg"
        src="/assets/images/logo/logo-dark.png"
        alt="logo"
      />

      <Typography className="mt-8 text-5xl leading-[1.35] font-extrabold tracking-tight">
        Sign in
      </Typography>
      <div className="mt-0.5 flex items-baseline font-medium">
        <Typography>Don't have an account ?</Typography>
        <Link className="ml-1" to="#">
          Contact IT Department.
        </Link>
      </div>
    </div>
  );
}

export default SignInPageTitle;
