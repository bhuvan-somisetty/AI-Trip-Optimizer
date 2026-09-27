"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "cn"

const fieldBase =
  "w-full min-w-0 rounded-lg border border-input bg-transparent text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(fieldBase, "min-h-20 px-2.5 py-2", className)} {...props} />
}

function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select
        data-slot="select"
        className={cn(fieldBase, "h-8 cursor-pointer appearance-none pr-8 pl-2.5 [&>option]:bg-popover [&>option]:text-popover-foreground")}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

function Switch({
  checked,
  onCheckedChange,
  className,
  id,
  disabled,
  ...rest
}: { checked: boolean; onCheckedChange: (v: boolean) => void; className?: string; id?: string; disabled?: boolean } & Omit<React.ComponentProps<"button">, "onClick">) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
        checked ? "bg-primary" : "bg-input dark:bg-input/80",
        className
      )}
      {...rest}
    >
      <span
        className={cn(
          "inline-block size-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-4.5" : "translate-x-0.5"
        )}
      />
    </button>
  )
}

/** Pill-style single choice — used for filters where every option should stay visible. */

export { Textarea, NativeSelect, Switch }
