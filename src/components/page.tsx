import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="flex flex-col gap-4 border-b border-hairline pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="text-title font-light">{title}</h1>
        {description && <div className="mt-3 max-w-2xl text-base text-foreground-soft">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, className }: { icon: LucideIcon; title: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("shape-cut flex flex-col items-center gap-3 border border-dashed border-taupe/60 bg-band/60 px-6 py-14 text-center", className)}>
      <Icon className="size-8 text-gold" aria-hidden />
      <p className="font-heading text-2xl font-light tracking-[-0.02em]">{title}</p>
      {children && <div className="max-w-md text-muted-foreground">{children}</div>}
    </div>
  );
}

export function Section({
  id,
  title,
  description,
  actions,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("grid content-start gap-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id={id} className="text-2xl font-light tracking-[-0.02em]">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("shape-cut-sm border bg-card p-5", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-heading text-4xl font-light tracking-[-0.03em] tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function PageSkeleton({ label }: { label: string }) {
  return (
    <div className="grid gap-6" aria-busy="true" role="status">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-10 w-72 max-w-full" />
      <Skeleton className="h-32" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
