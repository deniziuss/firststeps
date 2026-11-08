import { Button } from "@/components/ui/button";
import type { SourceStatus } from "@/domain/statuses";
import { deleteSource, setSourceStatus } from "@/server/actions/admin";

export function SourceStatusForm({ sourceId, current }: { sourceId: number; current: SourceStatus }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <form action={setSourceStatus}>
        <input type="hidden" name="sourceId" value={sourceId} />
        <input type="hidden" name="status" value="Verified" />
        <Button type="submit" size="xs" variant={current === "Verified" ? "outline" : "secondary"}>
          {current === "Verified" ? "Re-verify today" : "Mark verified"}
        </Button>
      </form>
      {current !== "Outdated" && (
        <form action={setSourceStatus}>
          <input type="hidden" name="sourceId" value={sourceId} />
          <input type="hidden" name="status" value="Outdated" />
          <Button type="submit" size="xs" variant="ghost">
            Mark outdated
          </Button>
        </form>
      )}
      <form action={deleteSource}>
        <input type="hidden" name="sourceId" value={sourceId} />
        <Button type="submit" size="xs" variant="ghost" className="text-destructive">
          Delete
        </Button>
      </form>
    </div>
  );
}
