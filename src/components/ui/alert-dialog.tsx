"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
export const AlertDialog=Dialog.Root;
export function AlertDialogContent({className,onOpenAutoFocus,onCloseAutoFocus,...props}:React.ComponentProps<typeof Dialog.Content>){
  const opener = React.useRef<HTMLElement | null>(null);
  return <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/50"/><Dialog.Content className={cn("fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain space-y-4 rounded-lg border bg-popover p-6 text-popover-foreground shadow-lg [overflow-wrap:anywhere]",className)}
    onOpenAutoFocus={event => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      onOpenAutoFocus?.(event);
    }}
    onCloseAutoFocus={event => {
      onCloseAutoFocus?.(event);
      if (!event.defaultPrevented && opener.current?.isConnected && !opener.current.matches(":disabled")) {
        event.preventDefault();
        opener.current.focus({ preventScroll: true });
      }
    }} {...props}/></Dialog.Portal>;
}
export function AlertDialogHeader({className,...props}:React.ComponentProps<"div">){return <div className={cn("space-y-2",className)} {...props}/>;}
export function AlertDialogFooter({className,...props}:React.ComponentProps<"div">){return <div className={cn("flex flex-wrap justify-end gap-2",className)} {...props}/>;}
export function AlertDialogTitle({className,...props}:React.ComponentProps<typeof Dialog.Title>){return <Dialog.Title className={cn("text-lg font-semibold",className)} {...props}/>;}
export function AlertDialogDescription({className,...props}:React.ComponentProps<typeof Dialog.Description>){return <Dialog.Description className={cn("text-sm leading-6 text-muted-foreground",className)} {...props}/>;}
export function AlertDialogCancel({className,...props}:React.ComponentProps<typeof Dialog.Cancel>){return <Dialog.Cancel className={cn(buttonVariants({variant:"outline"}),className)} {...props}/>;}
