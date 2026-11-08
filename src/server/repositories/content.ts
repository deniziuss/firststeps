import "server-only";
import type { SourceStatus } from "@/domain/statuses";
import { query, sql } from "../db";

export type EssentialRow = {
  TaskID: number;
  TaskTitle: string;
  Description: string | null;
  Category: string;
  SourceID: number | null;
  SourceTitle: string | null;
  SourceURL: string | null;
  SourceStatus: SourceStatus | null;
  LastVerifiedAt: Date | null;
};

// City and university life guide: practical templates for a university (and global ones) with their sources.
export function listEssentials(universityId: number) {
  return query<EssentialRow>(
    `SELECT t.TaskID, t.TaskTitle, t.Description, t.Category,
            s.SourceID, s.SourceTitle, s.SourceURL, s.SourceStatus, s.LastVerifiedAt
       FROM dbo.Task_Templates t
       LEFT JOIN dbo.Information_Sources s ON s.TaskID = t.TaskID AND s.SourceStatus <> N'Outdated'
      WHERE t.IsActive = 1
        AND (t.UniversityID IS NULL OR t.UniversityID = @universityId)
        AND t.Category IN (N'Transport', N'DailyLife', N'Health', N'Housing')
      ORDER BY t.Category, t.TaskTitle, s.SourceTitle`,
    { universityId: [sql.Int, universityId] },
  );
}
