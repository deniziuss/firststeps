import { PageSkeleton } from "@/components/page";
import { getI18n } from "@/i18n/server";

export default async function Loading() {
  const { t } = await getI18n();
  return <PageSkeleton label={t("common.loading")} />;
}
