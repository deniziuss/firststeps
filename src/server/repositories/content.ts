import "server-only";
import type { SourceStatus } from "@/domain/statuses";
import type { Locale } from "@/i18n/config";
import { query, sql } from "../db";
import { localizedTask } from "./localized";

export type EssentialRow = {
  TaskID: number;
  TaskTitle: string;
  Description: string | null;
  IsFallback: boolean;
  Category: string;
  SourceID: number | null;
  SourceTitle: string | null;
  SourceURL: string | null;
  SourceStatus: SourceStatus | null;
  LastVerifiedAt: Date | null;
};

// City and university life guide: practical templates for a university (and global ones) with their sources.
export function listEssentials(universityId: number, locale: Locale) {
  return query<EssentialRow>(
    `SELECT t.TaskID, ${localizedTask("t", "tt")}, t.Category,
            s.SourceID, COALESCE(st.SourceTitle, s.SourceTitle) AS SourceTitle, s.SourceURL, s.SourceStatus, s.LastVerifiedAt
       FROM dbo.Task_Templates t
       LEFT JOIN dbo.Task_Template_Translations tt ON tt.TaskID = t.TaskID AND tt.LanguageCode = @lang
       LEFT JOIN dbo.Information_Sources s ON s.TaskID = t.TaskID AND s.SourceStatus <> N'Outdated'
       LEFT JOIN dbo.Information_Source_Translations st ON st.SourceID = s.SourceID AND st.LanguageCode = @lang
      WHERE t.IsActive = 1
        AND (t.UniversityID IS NULL OR t.UniversityID = @universityId)
        AND t.Category IN (N'Transport', N'DailyLife', N'Health', N'Housing')
      ORDER BY t.Category, TaskTitle, SourceTitle`,
    { universityId: [sql.Int, universityId], lang: [sql.Char(2), locale] },
  );
}
