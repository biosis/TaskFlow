import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth.store'
import { AppLayout } from '@/components/layout/AppLayout'
import { authApi } from '@/api/auth'
import { setAccessToken } from '@/api/client'

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const store = useAuthStore.getState()
    if (!store.isAuthenticated) {
      try {
        const { accessToken } = await authApi.refresh()
        setAccessToken(accessToken)
        const user = await authApi.me()
        store.setAuth(user, accessToken)
      } catch {
        throw redirect({ to: '/login' })
      }
    }
  },
  component: AppLayout,
})
