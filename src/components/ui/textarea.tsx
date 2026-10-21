import * as React from "react";
import { cn } from "@/lib/utils";
export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn("min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base placeholder:text-muted-foreground disabled:opacity-60", className)} {...props} />;
}
