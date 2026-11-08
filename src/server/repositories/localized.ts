// SQL fragments for translated task content. `base` is the Task_Templates alias, `tr` the alias of
// a LEFT JOIN on Task_Template_Translations filtered by @lang. English is the fallback.
export function localizedTitle(base: string, tr: string) {
  return `COALESCE(${tr}.TaskTitle, ${base}.TaskTitle)`;
}

export function localizedTask(base: string, tr: string) {
  return `${localizedTitle(base, tr)} AS TaskTitle,
          CASE WHEN ${tr}.TaskID IS NULL THEN ${base}.Description ELSE ${tr}.Description END AS Description,
          CAST(CASE WHEN @lang <> 'en' AND ${tr}.TaskID IS NULL THEN 1 ELSE 0 END AS BIT) AS IsFallback`;
}
