import { CompassIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <CompassIcon className="size-10 text-taupe" aria-hidden />
      <h1 className="text-3xl font-semibold">{t("notFound.title")}</h1>
      <p className="max-w-sm text-muted-foreground">{t("notFound.text")}</p>
      <Button asChild variant="outline">
        <Link href="/">{t("notFound.home")}</Link>
      </Button>
    </div>
  );
}
