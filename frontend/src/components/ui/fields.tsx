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
function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  className,
  size = "default",
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: React.ReactNode }[]
  className?: string
  size?: "default" | "sm"
}) {
  return (
    <div role="radiogroup" className={cn("inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1", className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
            value === o.value
              ? "bg-background text-foreground shadow-sm dark:bg-card"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Multi-select chips. */
function ChipToggle({
  selected,
  onChange,
  options,
  className,
}: {
  selected: string[]
  onChange: (v: string[]) => void
  options: { value: string; label: React.ReactNode }[]
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const on = selected.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter((s) => s !== o.value) : [...selected, o.value])}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              on
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Range({
  value,
  onChange,
  min,
  max,
  step = 1,
  className,
  ...rest
}: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; className?: string } & Omit<React.ComponentProps<"input">, "onChange" | "value">) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        "h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-background [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow",
        className
      )}
      style={{ background: `linear-gradient(to right, var(--color-primary) ${pct}%, var(--color-muted) ${pct}%)` }}
      {...rest}
    />
  )
}

export { Textarea, NativeSelect, Switch, Segmented, ChipToggle, Range }
