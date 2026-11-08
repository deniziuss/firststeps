import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Brand } from "@/components/nav";
import { ThemeToggle } from "@/components/theme";
import { getCurrentUser, HOME_BY_ROLE } from "@/server/dal";

async function SignedInRedirect() {
  const user = await getCurrentUser();
  if (user) redirect(HOME_BY_ROLE[user.role]);
  return null;
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between px-4 sm:px-6">
        <Brand />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <Suspense>
        <SignedInRedirect />
      </Suspense>
    </div>
  );
}
