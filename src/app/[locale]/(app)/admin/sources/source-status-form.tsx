"use client";

import { ConfirmSubmit } from "@/components/form";
import { Button } from "@/components/ui/button";
import type { SourceStatus } from "@/domain/statuses";
import { useI18n } from "@/i18n/client";
import { deleteSource, setSourceStatus } from "@/server/actions/admin";

export function SourceStatusForm({ sourceId, current }: { sourceId: number; current: SourceStatus }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-1.5">
      <form action={setSourceStatus}>
        <input type="hidden" name="sourceId" value={sourceId} />
        <input type="hidden" name="status" value="Verified" />
        <Button type="submit" size="xs" variant={current === "Verified" ? "ghost" : "outline"}>
          {current === "Verified" ? t("admin.sources.reverify") : t("admin.sources.markVerified")}
        </Button>
      </form>
      {current !== "Outdated" && (
        <form action={setSourceStatus}>
          <input type="hidden" name="sourceId" value={sourceId} />
          <input type="hidden" name="status" value="Outdated" />
          <Button type="submit" size="xs" variant="ghost">
            {t("admin.sources.markOutdated")}
          </Button>
        </form>
      )}
      <form action={deleteSource}>
        <input type="hidden" name="sourceId" value={sourceId} />
        <ConfirmSubmit size="xs" variant="ghost" className="text-destructive" title={t("admin.sources.deleteConfirmTitle")} description={t("admin.sources.deleteConfirmText")} confirmLabel={t("common.delete")}>
          {t("common.delete")}
        </ConfirmSubmit>
      </form>
    </div>
  );
}
