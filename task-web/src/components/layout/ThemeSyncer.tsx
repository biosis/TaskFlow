import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useAuthStore } from '@/stores/auth.store'

export function ThemeSyncer() {
  const userTheme = useAuthStore((s) => s.user?.theme)
  const { setTheme } = useTheme()

  useEffect(() => {
    if (userTheme) setTheme(userTheme)
  }, [userTheme, setTheme])

  return null
}
