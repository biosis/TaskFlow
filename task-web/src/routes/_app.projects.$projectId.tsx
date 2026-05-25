import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from '@tanstack/react-router'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { LayoutGrid, List, Settings, ArrowLeft } from 'lucide-react'
import { projectsApi } from '@/api/projects'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/projects/$projectId')({
  component: ProjectLayout,
})

function ProjectLayout() {
  const { projectId } = Route.useParams()
  const routerState = useRouterState()
  const pathname = routerState.location.pathname
  const navigate = useNavigate()

  const { data: project, isLoading } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.get(projectId),
  })

  const { data: allProjectsData } = useInfiniteQuery({
    queryKey: ['projects'],
    queryFn: ({ pageParam }) => projectsApi.list({ cursor: pageParam as string | undefined }),
    getNextPageParam: (last) => last.nextCursor,
    initialPageParam: undefined as string | undefined,
  })
  const allProjects = allProjectsData?.pages.flatMap((p) => p.items) ?? []

  const tabs = [
    { to: '/projects/$projectId', params: { projectId }, label: 'Board', icon: LayoutGrid, exact: true },
    { to: '/projects/$projectId/list', params: { projectId }, label: 'List', icon: List },
    { to: '/projects/$projectId/settings', params: { projectId }, label: 'Settings', icon: Settings },
  ]

  const isActive = (to: string, exact?: boolean) => {
    const resolved = to.replace('$projectId', projectId)
    return exact ? pathname === resolved : pathname.startsWith(resolved)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b px-6 py-3 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Link to="/projects">
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-muted-foreground px-2">
              <ArrowLeft className="h-3.5 w-3.5" /> Projects
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-between">
          {isLoading ? (
            <Skeleton className="h-6 w-48" />
          ) : (
            <div>
              <h1 className="text-lg font-semibold">{project?.name}</h1>
              {project?.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{project.description}</p>
              )}
            </div>
          )}
          {allProjects.length > 1 && (
            <Select
              value=""
              onValueChange={(id) => void navigate({ to: '/projects/$projectId', params: { projectId: id } })}
            >
              <SelectTrigger className="h-8 text-xs w-44 bg-secondary/50 border-border">
                <SelectValue placeholder="Aller à un projet..." />
              </SelectTrigger>
              <SelectContent>
                {allProjects.filter((p) => p.id !== projectId).map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {/* Tabs */}
        <div className="flex items-center gap-1 mt-3">
          {tabs.map(({ to, params, label, icon: Icon, exact }) => (
            <Link key={label} to={to} params={params}>
              <button
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors',
                  isActive(to.replace('$projectId', projectId), exact)
                    ? 'bg-secondary text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            </Link>
          ))}
        </div>
      </div>
      <Outlet />
    </div>
  )
}
