import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getInitials } from '@/lib/utils'
import { ArrowLeft, CheckSquare, FolderOpen, MessageSquare, Activity } from 'lucide-react'
import type { TaskStatus } from '@/types'

export const Route = createFileRoute('/_app/admin/users/$userId')({
  component: AdminUserStatsPage,
})

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

const TASK_STATUSES = Object.keys(STATUS_LABELS) as TaskStatus[]

function StatusBreakdown({ byStatus, total }: { byStatus: Partial<Record<TaskStatus, number>>; total: number }) {
  return (
    <div className="space-y-3">
      {TASK_STATUSES.map((status) => {
        const count = byStatus[status] ?? 0
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        return (
          <div key={status} className="flex items-center gap-3">
            <span className="w-24 text-xs text-muted-foreground shrink-0">{STATUS_LABELS[status]}</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${STATUS_COLORS[status]}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

function AdminUserStatsPage() {
  const { userId } = Route.useParams()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'users', userId, 'stats'],
    queryFn: () => adminApi.getUserStats(userId),
    staleTime: 60_000,
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status
      return status !== 404 && failureCount < 2
    },
  })

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Utilisateur introuvable.</p>
        <Button variant="outline" asChild>
          <Link to="/admin/users">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à la liste
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/admin/users">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Utilisateurs
        </Link>
      </Button>

      {/* User header */}
      <div className="flex items-center gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          </>
        ) : data ? (
          <>
            <Avatar className="h-14 w-14">
              <AvatarImage src={data.user.avatarUrl} />
              <AvatarFallback>{getInitials(data.user.displayName)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-semibold">{data.user.displayName}</h2>
                <Badge variant={data.user.role === 'ADMIN' ? 'default' : 'secondary'}>{data.user.role}</Badge>
                {data.user.deletedAt ? (
                  <Badge variant="destructive">Supprimé</Badge>
                ) : (
                  <Badge variant="outline" className="text-green-600 border-green-600">Actif</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{data.user.email}</p>
              <p className="text-xs text-muted-foreground">
                Inscrit le {new Date(data.user.createdAt).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </>
        ) : null}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Tasks created */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              Tâches créées
              {!isLoading && data && (
                <span className="ml-auto text-lg font-bold">{data.tasksCreated.total}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-5 w-full mb-3" />)
            ) : data ? (
              <StatusBreakdown byStatus={data.tasksCreated.byStatus} total={data.tasksCreated.total} />
            ) : null}
          </CardContent>
        </Card>

        {/* Tasks assigned */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              Tâches assignées
              {!isLoading && data && (
                <span className="ml-auto text-lg font-bold">{data.tasksAssigned.total}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-5 w-full mb-3" />)
            ) : data ? (
              <StatusBreakdown byStatus={data.tasksAssigned.byStatus} total={data.tasksAssigned.total} />
            ) : null}
          </CardContent>
        </Card>

        {/* Projects */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Projets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)
            ) : data ? (
              [
                { label: 'Propriétaire de', value: data.projects.owned },
                { label: 'Membre de', value: data.projects.memberOf },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold">
                    {value} projet{value !== 1 ? 's' : ''}
                  </span>
                </div>
              ))
            ) : null}
          </CardContent>
        </Card>

        {/* Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Activité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)
            ) : data ? (
              [
                { label: 'Commentaires', icon: MessageSquare, value: data.commentsCount },
                { label: 'Événements', icon: Activity, value: data.activitiesCount },
              ].map(({ label, icon: Icon, value }) => (
                <div key={label} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
