import { LogOutIcon } from "lucide-react";
import { Suspense } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Brand, MobileNav, SidebarNav } from "@/components/nav";
import { ThemeToggle } from "@/components/theme";
import { signOut } from "@/server/actions/auth";
import { requireUser } from "@/server/dal";

// The frame is static; only the parts that depend on the signed-in user wait for the session.
// Pages render in their own boundary (loading.tsx) and check access themselves.
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen print:hidden w-64 shrink-0 flex-col gap-6 border-r bg-sidebar p-4 lg:flex">
        <Brand />
        <Suspense fallback={<NavSkeleton />}>
          <UserNav />
        </Suspense>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 print:hidden items-center gap-2 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <Suspense>
            <UserMobileNav />
          </Suspense>
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
              <UserMenu />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

function NavSkeleton() {
  return (
    <div className="grid gap-2">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-8" />
      ))}
    </div>
  );
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
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
  return (
    <>
      <div className="hidden text-right text-sm sm:block">
        <p className="font-medium leading-tight">
          {user.firstName} {user.lastName}
        </p>
        <p className="text-xs text-muted-foreground">{user.role}</p>
      </div>
      <Avatar>
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="icon" aria-label="Sign out">
          <LogOutIcon />
        </Button>
      </form>
    </>
  );
}
