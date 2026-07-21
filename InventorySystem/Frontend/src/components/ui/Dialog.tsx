import React, { useEffect } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "../../utils"

interface DialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  size?: "sm" | "md" | "lg" | "xl"
}

export function Dialog({ open, onClose, children, title, size = "md" }: DialogProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with a premium dark blur */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-md transition-opacity duration-300 ease-out"
        onClick={onClose}
      />

      {/* Dialog container with slide-up zoom in */}
      <div
        className={cn(
          "relative z-10 w-full overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[90vh] animate-in",
          {
            "max-w-md": size === "sm",
            "max-w-xl": size === "md",
            "max-w-3xl": size === "lg",
            "max-w-5xl": size === "xl",
          }
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100/80 p-6 dark:border-slate-800/80">
          {title && (
            <h3 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {title}
            </h3>
          )}
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-all duration-200 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>,
    document.body
  )
}
