"use client";

import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      <PrinterIcon aria-hidden /> {label}
    </Button>
  );
}
