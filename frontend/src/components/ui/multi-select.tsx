import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type MultiSelectProps = {
  className?: string
  options: string[]
  placeholder: string
  selected: string[]
  onChange: (nextSelected: string[]) => void
}

function MultiSelect({
  className,
  options,
  placeholder,
  selected,
  onChange,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [])

  const summary = useMemo(() => {
    if (selected.length === 0) return placeholder
    if (selected.length === 1) return selected[0]
    return `${selected.length} selected`
  }, [placeholder, selected])

  const toggleValue = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value))
      return
    }

    onChange([...selected, value])
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen((current) => !current)}
        className="h-11 w-full justify-between rounded-2xl border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal text-slate-900 shadow-xs hover:bg-white"
      >
        <span className={cn("truncate", selected.length === 0 && "text-slate-400")}>{summary}</span>
        <ChevronDown className={cn("size-4 text-slate-500 transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="mb-2 flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {placeholder}
            </span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-3" />
                Clear
              </button>
            )}
          </div>

          <div className="max-h-64 space-y-1 overflow-y-auto">
            {options.map((option) => {
              const isSelected = selected.includes(option)

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleValue(option)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                >
                  <span className="truncate pr-3">{option}</span>
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border",
                      isSelected
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-transparent"
                    )}
                  >
                    <Check className="size-3.5" />
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export { MultiSelect }
