import { Sun, Moon } from 'lucide-react'
import { useSettingsStore } from '../stores/settingsStore'

export function ThemeToggle() {
  const { theme, toggleTheme } = useSettingsStore()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      className="
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
        text-slate-400 dark:text-slate-400 text-gray-500
        hover:bg-dark-hover dark:hover:bg-dark-hover hover:bg-gray-100
        hover:text-slate-100 dark:hover:text-slate-100 hover:text-gray-900
        transition-all duration-150
      "
      title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
      <span>{isDark ? '라이트 모드' : '다크 모드'}</span>
    </button>
  )
}
