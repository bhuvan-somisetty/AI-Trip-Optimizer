"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"
import { cn } from "cn"

function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogContent({
  className,
  children,
  side,
  ...props
}: DialogPrimitive.Popup.Props & { side?: "left" | "right" }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
      <DialogPrimitive.Viewport
        className={cn(
          "fixed inset-0 z-50 flex",
          side === "left" ? "justify-start" : side === "right" ? "justify-end" : "items-center justify-center p-4"
        )}
      >
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "relative bg-popover text-popover-foreground shadow-2xl outline-none duration-200",
            side
              ? cn(
                  "flex h-full w-[min(88vw,22rem)] flex-col",
                  side === "left"
                    ? "data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left"
                    : "data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right"
                )
              : "max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border p-6 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          {children}
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPrimitive.Portal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mb-5 flex flex-col gap-1.5 pr-8", className)} {...props} />
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title className={cn("text-lg font-semibold tracking-tight", className)} {...props} />
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return <DialogPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export { Dialog, DialogClose, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription }
