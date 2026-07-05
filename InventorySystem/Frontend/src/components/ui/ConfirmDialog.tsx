import React from "react"
import { createPortal } from "react-dom"
import { AlertTriangle, Trash2 } from "lucide-react"
import { Button } from "./Button"
import { cn } from "../../utils"

type ConfirmVariant = "danger" | "warning"

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
  onConfirm: () => void
  onCancel: () => void
}

const variantConfig: Record<
  ConfirmVariant,
  {
    icon: React.ReactNode
    iconBg: string
    iconColor: string
    confirmVariant: "danger" | "primary"
  }
> = {
  danger: {
    icon: <Trash2 size={22} />,
    iconBg:
      "bg-rose-100 dark:bg-rose-950/40",
    iconColor: "text-rose-600 dark:text-rose-400",
    confirmVariant: "danger",
  },
  warning: {
    icon: <AlertTriangle size={22} />,
    iconBg: "bg-amber-100 dark:bg-amber-950/40",
    iconColor: "text-amber-600 dark:text-amber-400",
    confirmVariant: "danger",
  },
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  const { icon, iconBg, iconColor, confirmVariant } = variantConfig[variant]

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/20 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/60 animate-in">
        {/* Accent stripe */}
        <div
          className={cn(
            "h-1 w-full",
            variant === "danger"
              ? "bg-gradient-to-r from-rose-500 to-red-500"
              : "bg-gradient-to-r from-amber-400 to-orange-500"
          )}
        />

        <div className="p-6">
          {/* Icon + Title */}
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl",
                iconBg,
                iconColor
              )}
            >
              {icon}
            </div>
            <div className="pt-0.5">
              <h3
                id="confirm-dialog-title"
                className="text-base font-bold text-slate-900 dark:text-slate-50"
              >
                {title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {description}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={confirmVariant}
              size="sm"
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
