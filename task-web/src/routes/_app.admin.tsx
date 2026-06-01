import { createFileRoute, redirect, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth.store'
import { LayoutDashboard, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/admin')({
  beforeLoad: () => {
    const { user } = useAuthStore.getState()
    if (user?.role !== 'ADMIN') throw redirect({ to: '/projects' })
  },
  component: AdminLayout,
})

function AdminLayout() {
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  const tabs = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { to: '/admin/users', icon: Users, label: 'Utilisateurs', exact: false },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Administration</h1>
        <nav className="flex gap-1 mt-3">
          {tabs.map(({ to, icon: Icon, label, exact }) => {
            const active = exact ? pathname === to : pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <Outlet />
      </div>
    </div>
  )
}
