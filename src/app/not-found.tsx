import { CompassIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <CompassIcon className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">This page does not exist or you do not have access to it.</p>
      <Button asChild variant="outline">
        <Link href="/">Go to the start page</Link>
      </Button>
    </div>
  );
}
