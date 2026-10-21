"use client";
import * as React from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";
export const DropdownMenu=Menu.Root;
export const DropdownMenuTrigger=Menu.Trigger;
export function DropdownMenuContent({className,sideOffset=4,...props}:React.ComponentProps<typeof Menu.Content>){return <Menu.Portal><Menu.Content sideOffset={sideOffset} className={cn("z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] max-w-[calc(100vw-2rem)] min-w-40 overflow-y-auto overscroll-contain rounded-lg border bg-popover p-1 text-popover-foreground shadow-md",className)} {...props}/></Menu.Portal>;}
export function DropdownMenuItem({className,...props}:React.ComponentProps<typeof Menu.Item>){return <Menu.Item className={cn("relative flex min-h-11 cursor-default items-center rounded-sm px-3 py-2 text-sm data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-60",className)} {...props}/>;}
export function DropdownMenuLabel({className,...props}:React.ComponentProps<typeof Menu.Label>){return <Menu.Label className={cn("px-3 py-2 text-sm font-semibold",className)} {...props}/>;}
