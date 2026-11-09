"use client";

import { CircleAlertIcon, CircleCheckIcon, Loader2Icon } from "lucide-react";
import { Children, cloneElement, isValidElement, useId, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/server/errors";

export function SubmitButton({ children, pendingText, ...props }: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending || undefined} {...props}>
      {pending && <Loader2Icon className="animate-spin" aria-hidden />}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

export function FormMessage({ state, className }: { state: ActionResult | undefined; className?: string }) {
  if (!state) return null;
  if (state.ok) {
    if (!state.message) return null;
    return (
      <Alert role="status" className={cn("border-success/30 bg-success-soft", className)}>
        <CircleCheckIcon className="text-success" aria-hidden />
        <AlertDescription className="text-foreground">{state.message}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="destructive" role="alert" className={cn("border-destructive/40 bg-destructive-soft", className)}>
      <CircleAlertIcon aria-hidden />
      <AlertDescription>{state.error}</AlertDescription>
    </Alert>
  );
}

// Label, hint and error for one control. The control gets id, aria-describedby and aria-invalid.
export function Field({
  label,
  name,
  state,
  hint,
  optional,
  className,
  children,
}: {
  label: string;
  name: string;
  state?: ActionResult;
  hint?: string;
  optional?: boolean;
  className?: string;
  children: React.ReactElement<React.InputHTMLAttributes<HTMLElement>>;
}) {
  const { t } = useI18n();
  const id = `${name}-${useId()}`;
  const errors = state && !state.ok ? state.fieldErrors?.[name] : undefined;
  // After a failed submission React resets the form; the action echoes non-secret values back, and the
  // control is re-created with them so the user does not have to type everything again.
  const kept = state && !state.ok ? state.values?.[name] : undefined;
  const describedBy = [hint ? `${id}-hint` : null, errors ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  const control = Children.only(children);

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional && <span className="font-normal text-muted-foreground"> ({t("common.optional")})</span>}
      </Label>
      {isValidElement(control)
        ? cloneElement(control, {
            id,
            name,
            "aria-describedby": describedBy,
            "aria-invalid": errors ? true : undefined,
            ...(kept !== undefined ? { defaultValue: kept, key: `${id}:${kept}` } : {}),
          })
        : control}
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {errors && (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm text-destructive">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {errors.join(" ")}
        </p>
      )}
    </div>
  );
}

export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-lg border border-input bg-card px-3 text-base focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring md:text-sm [&>option]:bg-popover",
        className,
      )}
      {...props}
    />
  );
}

// A group of large, labelled radio options (easier to scan and tap than a select).
export function ChoiceGroup({
  legend,
  name,
  options,
  defaultValue,
  state,
}: {
  legend: string;
  name: string;
  options: { value: string; label: string; hint?: string }[];
  defaultValue?: string;
  state?: ActionResult;
}) {
  const errors = state && !state.ok ? state.fieldErrors?.[name] : undefined;
  return (
    <fieldset className="grid gap-2" aria-describedby={errors ? `${name}-error` : undefined}>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-input bg-card p-3 transition-colors hover:bg-accent has-checked:border-primary has-checked:bg-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
          >
            <input type="radio" name={name} value={option.value} defaultChecked={option.value === defaultValue} className="mt-1 size-4 accent-primary focus-visible:outline-none" />
            <span className="grid gap-0.5">
              <span className="font-medium">{option.label}</span>
              {option.hint && <span className="text-sm text-muted-foreground">{option.hint}</span>}
            </span>
          </label>
        ))}
      </div>
      {errors && (
        <p id={`${name}-error`} className="text-sm text-destructive">
          {errors.join(" ")}
        </p>
      )}
    </fieldset>
  );
}

// Asks for confirmation before submitting the surrounding form.
export function ConfirmSubmit({
  title,
  description,
  confirmLabel,
  children,
  ...buttonProps
}: React.ComponentProps<typeof Button> & { title: string; description: string; confirmLabel?: string }) {
  const { t } = useI18n();
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" ref={triggerRef} {...buttonProps}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => triggerRef.current?.closest("form")?.requestSubmit()}>{confirmLabel ?? t("common.confirm")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
