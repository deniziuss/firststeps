"use client";

import {
  BarChart3Icon,
  BookOpenCheckIcon,
  BuildingIcon,
  CompassIcon,
  HandHelpingIcon,
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
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { UserRole } from "@/domain/statuses";
import { cn } from "@/lib/utils";

const ICONS = {
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

type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

export const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  Student: [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/journey", label: "My journey", icon: "journey" },
    { href: "/help", label: "Help requests", icon: "help" },
    { href: "/essentials", label: "Local essentials", icon: "essentials" },
    { href: "/settings", label: "Settings", icon: "settings" },
  ],
  Mentor: [
    { href: "/mentor", label: "Assigned requests", icon: "inbox" },
    { href: "/settings", label: "Settings", icon: "settings" },
  ],
  Admin: [
    { href: "/admin", label: "Overview", icon: "dashboard" },
    { href: "/admin/requests", label: "Help requests", icon: "inbox" },
    { href: "/admin/templates", label: "Task templates", icon: "templates" },
    { href: "/admin/sources", label: "Sources", icon: "sources" },
    { href: "/admin/universities", label: "Universities", icon: "universities" },
    { href: "/admin/users", label: "Users", icon: "users" },
    { href: "/admin/reports", label: "Reports", icon: "reports" },
    { href: "/settings", label: "Settings", icon: "settings" },
  ],
};

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`) || (href === "/journey" && pathname.startsWith("/tasks/"));
}

function NavLinks({ role, onNavigate }: { role: UserRole; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-1" aria-label="Main">
      {NAV_BY_ROLE[role].map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              active && "bg-sidebar-accent text-sidebar-foreground",
            )}
          >
            <Icon className={cn("size-4", active && "text-sidebar-primary")} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid size-7 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">FS</span>
      FirstSteps
    </Link>
  );
}

export function SidebarNav({ role }: { role: UserRole }) {
  return <NavLinks role={role} />;
}

export function MobileNav({ role }: { role: UserRole }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar p-4">
        <SheetTitle className="mb-4">
          <Brand />
        </SheetTitle>
        <NavLinks role={role} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
