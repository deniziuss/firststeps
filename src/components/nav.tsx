"use client";

import {
  BarChart3Icon,
  BookOpenCheckIcon,
  BuildingIcon,
  CompassIcon,
  HandHelpingIcon,
  HomeIcon,
  InboxIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  MapPinnedIcon,
  MenuIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { UserRole } from "@/domain/statuses";
import { useI18n } from "@/i18n/client";
import type { MessageKey } from "@/i18n/translator";
import { cn } from "@/lib/utils";

const ICONS = {
  home: HomeIcon,
  dashboard: LayoutDashboardIcon,
  journey: CompassIcon,
  help: HandHelpingIcon,
  essentials: MapPinnedIcon,
  settings: SettingsIcon,
  inbox: InboxIcon,
  universities: BuildingIcon,
  templates: ListChecksIcon,
  sources: BookOpenCheckIcon,
  users: UsersIcon,
  reports: BarChart3Icon,
};

type NavItem = { href: string; label: MessageKey; icon: keyof typeof ICONS };

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  Student: [
    { href: "/dashboard", label: "nav.dashboard", icon: "home" },
    { href: "/journey", label: "nav.journey", icon: "journey" },
    { href: "/help", label: "nav.help", icon: "help" },
    { href: "/essentials", label: "nav.essentials", icon: "essentials" },
    { href: "/settings", label: "nav.settings", icon: "settings" },
  ],
  Mentor: [
    { href: "/mentor", label: "nav.mentorInbox", icon: "inbox" },
    { href: "/settings", label: "nav.settings", icon: "settings" },
  ],
  Admin: [
    { href: "/admin", label: "nav.adminOverview", icon: "dashboard" },
    { href: "/admin/requests", label: "nav.adminRequests", icon: "inbox" },
    { href: "/admin/templates", label: "nav.adminTemplates", icon: "templates" },
    { href: "/admin/sources", label: "nav.adminSources", icon: "sources" },
    { href: "/admin/universities", label: "nav.adminUniversities", icon: "universities" },
    { href: "/admin/users", label: "nav.adminUsers", icon: "users" },
    { href: "/admin/reports", label: "nav.adminReports", icon: "reports" },
    { href: "/settings", label: "nav.settings", icon: "settings" },
  ],
};

// The proxy rewrites /dashboard to /en/dashboard internally; strip the locale for matching.
function isActive(pathname: string, href: string) {
  const path = pathname.replace(/^\/(en|tr)(?=\/|$)/, "") || "/";
  if (href === "/admin") return path === "/admin";
  return path === href || path.startsWith(`${href}/`) || (href === "/journey" && path.startsWith("/tasks/"));
}

function NavLinks({ role, onNavigate }: { role: UserRole; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav aria-label={t("nav.main")}>
      <ul className="grid gap-1">
        {NAV_BY_ROLE[role].map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-[0.95rem] font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  active && "bg-sidebar-accent text-sidebar-foreground",
                )}
              >
                <Icon className={cn("size-[1.15rem]", active ? "text-sidebar-primary" : "text-sidebar-foreground/60")} aria-hidden />
                {t(item.label)}
                {active && <span className="ml-auto h-5 w-1 rounded-full bg-sidebar-primary" aria-hidden />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex min-h-11 items-center gap-2.5 rounded-lg font-heading text-xl font-semibold tracking-tight">
      <span className="grid size-8 place-items-center rounded-lg bg-primary font-sans text-sm font-bold text-primary-foreground" aria-hidden>
        FS
      </span>
      FirstSteps
    </Link>
  );
}

export function SidebarNav({ role }: { role: UserRole }) {
  return <NavLinks role={role} />;
}

export function MobileNav({ role, footer }: { role: UserRole; footer?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("common.openMenu")}>
          <MenuIcon aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[85vw] max-w-80 gap-6 bg-sidebar p-5">
        <SheetTitle>
          <Brand />
        </SheetTitle>
        <SheetDescription className="sr-only">{t("nav.main")}</SheetDescription>
        <NavLinks role={role} onNavigate={() => setOpen(false)} />
        {footer && <div className="mt-auto border-t pt-4">{footer}</div>}
      </SheetContent>
    </Sheet>
  );
}
