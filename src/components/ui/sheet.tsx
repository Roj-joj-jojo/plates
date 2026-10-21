"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
export const Sheet=Dialog.Root;
export const SheetTrigger=Dialog.Trigger;
export function SheetContent({className,children,...props}:React.ComponentProps<typeof Dialog.Content>){return <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/50"/><Dialog.Content className={cn("fixed inset-y-0 right-0 z-50 w-[min(100%,28rem)] overflow-y-auto border-l bg-card px-6 py-8 shadow-lg",className)} {...props}>{children}<Dialog.Close aria-label="Close panel" className="absolute right-2 top-2 grid size-11 place-items-center rounded-md hover:bg-secondary"><X className="size-4" aria-hidden/></Dialog.Close></Dialog.Content></Dialog.Portal>;}
export function SheetTitle({className,...props}:React.ComponentProps<typeof Dialog.Title>){return <Dialog.Title className={cn("pr-10 [overflow-wrap:anywhere]",className)} {...props}/>;}
export const SheetDescription=Dialog.Description;
