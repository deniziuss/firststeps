import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthFrame } from "@/components/auth-frame";
import { getCurrentUser, HOME_BY_ROLE } from "@/server/dal";

async function SignedInRedirect() {
  const user = await getCurrentUser();
  if (user) redirect(HOME_BY_ROLE[user.role]);
  return null;
}

// Sign-in, registration and "forgot password": a signed-in user is sent home.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthFrame>{children}</AuthFrame>
      <Suspense>
        <SignedInRedirect />
      </Suspense>
    </>
  );
}
