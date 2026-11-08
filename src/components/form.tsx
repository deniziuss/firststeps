"use client";

import { CircleAlertIcon, CircleCheckIcon, Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/server/errors";
import { cn } from "@/lib/utils";

export function SubmitButton({ children, pendingText, ...props }: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending && <Loader2Icon className="animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

export function FormMessage({ state }: { state: ActionResult | undefined }) {
  if (!state) return null;
  if (state.ok) {
    if (!state.message) return null;
    return (
      <Alert role="status">
        <CircleCheckIcon className="text-success" />
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="destructive" role="alert">
      <CircleAlertIcon />
      <AlertDescription>{state.error}</AlertDescription>
    </Alert>
  );
}

export function Field({
  label,
  name,
  state,
  hint,
  className,
  children,
}: {
  label: string;
  name: string;
  state?: ActionResult;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const errors = state && !state.ok ? state.fieldErrors?.[name] : undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={name}>{label}</Label>
      {children}
      {hint && !errors && <p className="text-xs text-muted-foreground">{hint}</p>}
      {errors?.map((error) => (
        <p key={error} id={`${name}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ))}
    </div>
  );
}

export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover",
        className,
      )}
      {...props}
    />
  );
}
