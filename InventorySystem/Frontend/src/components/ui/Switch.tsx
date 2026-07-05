import { cn } from "../../utils"

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export function Switch({ checked, onChange, label, disabled = false }: SwitchProps) {
  return (
    <label className="inline-flex items-center space-x-3.5 cursor-pointer select-none">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div
          className={cn(
            "w-10 h-6 bg-slate-200 rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-[18px] after:w-[18px] after:transition-all after:duration-300 dark:border-slate-600 peer-checked:bg-gradient-to-r peer-checked:from-indigo-600 peer-checked:to-violet-600 shadow-inner transition-colors duration-300",
            disabled ? "opacity-50 cursor-not-allowed" : ""
          )}
        />
      </div>
      {label && (
        <span className="text-sm font-bold text-slate-600 dark:text-slate-350">
          {label}
        </span>
      )}
    </label>
  )
}
