import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * A real 44px button that draws a small 28px visual. The hit area is the button itself,
 * not an invisible pseudo-element, so it can never overlap a neighbouring control.
 * `label` is required because the control has no visible text.
 */
type IconButtonProps = Omit<React.ComponentProps<"button">, "children" | "aria-label"> & {
  label: string;
  icon: React.ReactNode;
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon, className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn("group grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground disabled:opacity-60", className)}
      {...props}
    >
      <span className="grid size-7 place-items-center rounded-md group-hover:bg-secondary group-hover:text-foreground group-aria-expanded:bg-secondary group-aria-expanded:text-foreground [&_svg]:size-4">
        {icon}
      </span>
    </button>
  ),
);
IconButton.displayName = "IconButton";
