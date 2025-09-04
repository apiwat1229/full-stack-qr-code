import AuthJsForm from "@auth/forms/AuthJsForm"; // ✅ ใช้ฟอร์มล็อกอินจริง
import Paper from "@mui/material/Paper";
import SignInPageTitle from "../ui/SignInPageTitle";

function ClassicSignInPageView() {
  return (
    <div className="flex min-w-0 flex-auto flex-col items-center sm:justify-center">
      <Paper className="min-h-full w-full rounded-none px-4 py-8 sm:min-h-auto sm:w-auto sm:rounded-xl sm:p-12 sm:shadow-sm">
        <div className="mx-auto flex w-full max-w-80 flex-col gap-8 sm:mx-0 sm:w-80">
          <SignInPageTitle />
          {/* ใช้ฟอร์มล็อกอินจริง */}
          <AuthJsForm formType="signin" />
        </div>
      </Paper>
    </div>
  );
}

export default ClassicSignInPageView;
