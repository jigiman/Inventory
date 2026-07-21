import React from "react"
import { cn } from "../../utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline"
  size?: "sm" | "md" | "lg"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-semibold tracking-wide transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:pointer-events-none cursor-pointer active:scale-[0.98]",
          {
            "bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-500/10 hover:shadow-lg hover:shadow-indigo-500/20 focus:ring-indigo-500": variant === "primary",
            "bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700/80 focus:ring-slate-500": variant === "secondary",
            "bg-rose-600 text-white hover:bg-rose-500 shadow-md shadow-rose-500/10 hover:shadow-lg hover:shadow-rose-500/20 focus:ring-red-500": variant === "danger",
            "bg-transparent text-slate-600 hover:bg-slate-50 dark:text-slate-350 dark:hover:bg-slate-800/60 focus:ring-slate-500": variant === "ghost",
            "border border-slate-200/80 bg-transparent text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/40 focus:ring-indigo-500": variant === "outline",
          },
          {
            "px-3.5 py-1.5 text-xs rounded-lg": size === "sm",
            "px-5 py-2.5 text-sm": size === "md",
            "px-7 py-3.5 text-base": size === "lg",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
