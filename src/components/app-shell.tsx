import { LogOutIcon } from "lucide-react";
import { Suspense } from "react";
import { Brand, MobileNav, SidebarNav } from "@/components/nav";
import { LanguageSwitcher, ThemeToggle } from "@/components/theme";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getI18n } from "@/i18n/server";
import { HOME_BY_ROLE, requireUser } from "@/server/dal";
import { signOut } from "@/server/actions/auth";

// The frame is static; only the parts that depend on the signed-in user wait for the session.
// Pages render in their own boundary (loading.tsx) and check access themselves.
export async function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        {t("common.skipToContent")}
      </a>
      {/* The column carries the background for the full page height; its content stays in view. */}
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar print:hidden lg:block">
        <div className="sticky top-0 flex h-screen flex-col gap-8 px-4 py-6">
          <Suspense fallback={<Brand />}>
            <UserBrand />
          </Suspense>
          <Suspense fallback={<NavSkeleton />}>
            <UserNav />
          </Suspense>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur print:hidden sm:px-6">
          <Suspense>
            <UserMobileNav />
          </Suspense>
          <div className="min-w-0 lg:hidden">
            <Brand />
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Suspense fallback={<Skeleton className="size-9 rounded-full" />}>
              <UserMenu />
            </Suspense>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 focus:outline-none sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavSkeleton() {
  return (
    <div className="grid gap-2">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-11" />
      ))}
    </div>
  );
}

async function UserBrand() {
  const user = await requireUser();
  return <Brand href={HOME_BY_ROLE[user.role]} />;
}

async function UserNav() {
  const user = await requireUser();
  return <SidebarNav role={user.role} />;
}

async function UserMobileNav() {
  const user = await requireUser();
  return <MobileNav role={user.role} />;
}

async function UserMenu() {
  const user = await requireUser();
  const { t } = await getI18n();
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
  return (
    <>
      <div className="hidden text-right text-sm leading-tight md:block">
        <p className="font-medium">
          {user.firstName} {user.lastName}
        </p>
        <p className="text-muted-foreground">{t(`roles.${user.role}`)}</p>
      </div>
      <Avatar className="hidden sm:flex">
        <AvatarFallback className="bg-secondary font-medium">{initials}</AvatarFallback>
      </Avatar>
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="icon" aria-label={t("common.signOut")}>
          <LogOutIcon aria-hidden />
        </Button>
      </form>
    </>
  );
}
