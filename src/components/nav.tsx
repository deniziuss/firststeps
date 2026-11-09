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
  ScrollTextIcon,
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
  audit: ScrollTextIcon,
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
    { href: "/admin/audit", label: "nav.adminAudit", icon: "audit" },
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
                  "flex min-h-11 items-center gap-3 rounded-full px-3.5 font-heading text-[0.95rem] tracking-[-0.01em] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  active && "bg-card text-sidebar-foreground ring-1 ring-hairline",
                )}
              >
                <Icon className={cn("size-[1.15rem]", active ? "text-sidebar-primary" : "text-sidebar-foreground/60")} aria-hidden />
                {t(item.label)}
                {active && <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary" aria-hidden />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// The FirstSteps mark: a rising stair line ending in an ochre point, the "next step".
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={cn("size-7 shrink-0", className)} aria-hidden focusable="false">
      <rect x="0.75" y="0.75" width="26.5" height="26.5" rx="7" className="fill-primary" />
      <path d="M6.5 21.5h5v-5h5v-5h5" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="stroke-primary-foreground" />
      <circle cx="21.5" cy="7" r="2.1" className="fill-[#c9a15a]" />
    </svg>
  );
}

export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex min-h-11 items-center gap-2.5 rounded-sm font-heading text-[1.3rem] font-normal tracking-[-0.03em]", className)}>
      <BrandMark />
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
      <SheetContent side="left" closeLabel={t("common.close")} className="w-[85vw] max-w-80 gap-6 bg-sidebar p-5">
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
