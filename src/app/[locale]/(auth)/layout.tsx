import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Brand } from "@/components/nav";
import { LanguageSwitcher, ThemeToggle } from "@/components/theme";
import { getCurrentUser, HOME_BY_ROLE } from "@/server/dal";

async function SignedInRedirect() {
  const user = await getCurrentUser();
  if (user) redirect(HOME_BY_ROLE[user.role]);
  return null;
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Brand />
        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 sm:p-8">{children}</div>
      </main>
      <Suspense>
        <SignedInRedirect />
      </Suspense>
    </div>
  );
}
