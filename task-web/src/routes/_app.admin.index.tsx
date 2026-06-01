import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import { Users, UserCheck, UserPlus, FolderOpen, CheckSquare } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { TaskStatus } from '@/types'

export const Route = createFileRoute('/_app/admin/')({
  component: AdminDashboard,
})

function AdminDashboard() {
  const STATUS_LABELS: Record<TaskStatus, string> = {
    TODO: 'À faire',
    IN_PROGRESS: 'En cours',
    REVIEW: 'En revue',
    BLOCKED: 'Bloqué',
    DONE: 'Terminé',
    CANCELLED: 'Annulé',
  }

  const STATUS_COLORS: Record<TaskStatus, string> = {
    TODO: 'bg-slate-400',
    IN_PROGRESS: 'bg-blue-500',
    REVIEW: 'bg-yellow-500',
    BLOCKED: 'bg-red-500',
    DONE: 'bg-green-500',
    CANCELLED: 'bg-gray-400',
  }
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.getStats,
    staleTime: 60_000,
  })

  const kpis = [
    {
      label: 'Utilisateurs total',
      value: stats?.users.total,
      icon: Users,
      sub: `${stats?.users.deleted ?? 0} supprimé(s)`,
    },
    {
      label: 'Comptes actifs',
      value: stats?.users.active,
      icon: UserCheck,
      sub: `dont ${stats?.users.admins ?? 0} admin(s)`,
    },
    {
      label: 'Nouveaux (30j)',
      value: stats?.newUsersLast30Days,
      icon: UserPlus,
      sub: 'inscriptions récentes',
    },
    {
      label: 'Projets actifs',
      value: stats?.projects.active,
      icon: FolderOpen,
      sub: `${stats?.projects.archived ?? 0} archivé(s)`,
    },
  ]

  const taskStatuses = Object.keys(STATUS_LABELS) as TaskStatus[]
  const totalTasks = stats?.tasks.total ?? 0

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, sub }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{value ?? 0}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Tasks by status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              Tâches par statut
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)
            ) : (
              taskStatuses.map((status) => {
                const count = stats?.tasks.byStatus?.[status] ?? 0
                const pct = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className="w-24 text-xs text-muted-foreground shrink-0">
                      {STATUS_LABELS[status]}
                    </span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${STATUS_COLORS[status]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Projects summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Récapitulatif projets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)
            ) : (
              [
                { label: 'Total projets', value: stats?.projects.total ?? 0 },
                { label: 'Projets actifs', value: stats?.projects.active ?? 0 },
                { label: 'Projets archivés', value: stats?.projects.archived ?? 0 },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
