"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";

/**
 * Shown by the error boundaries when a page fails unexpectedly (for example the database is not
 * reachable). The message is translated and generic; technical details stay in the server log.
 * In production Next.js only passes an opaque digest to the browser, shown as a reference.
 */
export function ErrorView({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    // Focus the heading so keyboard and screen reader users learn that the page changed.
    document.getElementById("error-title")?.focus();
  }, []);
  return (
    <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <TriangleAlertIcon className="size-10 text-gold" aria-hidden />
      <h1 id="error-title" tabIndex={-1} className="text-title font-light focus:outline-none">
        {t("errors.pageTitle")}
      </h1>
      <p className="max-w-md text-muted-foreground">{t("errors.pageText")}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={reset}>
          <RotateCcwIcon aria-hidden />
          {t("common.tryAgain")}
        </Button>
        <Button asChild variant="outline">
          <Link href="/">{t("notFound.home")}</Link>
        </Button>
      </div>
      {error.digest && <p className="font-mono text-xs text-muted-foreground">{t("errors.reference", { digest: error.digest })}</p>}
    </div>
  );
}
