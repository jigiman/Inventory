import React from "react"
import { cn } from "../../utils"

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-slate-200/60 bg-white/95 p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/90 backdrop-blur-sm transition-all duration-300 hover:shadow-md hover:border-slate-300/60 dark:hover:border-slate-700/80",
        className
      )}
      {...props}
    />
  )
)
Card.displayName = "Card"
