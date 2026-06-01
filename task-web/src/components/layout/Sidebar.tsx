import { Link, useRouterState, useParams } from '@tanstack/react-router'
import { LayoutDashboard, FolderKanban, Settings, LogOut, ChevronLeft, ChevronRight, ClipboardList, Flag, Palette, Shield } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useQuery, useMutation } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { getInitials } from '@/lib/utils'
import { authApi } from '@/api/auth'
import { projectsApi } from '@/api/projects'
import { usersApi } from '@/api/users'
import { queryClient } from '@/api/client'
import { useNavigate } from '@tanstack/react-router'

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'nord', label: 'Nord' },
  { value: 'solarized', label: 'Solarized' },
  { value: 'forest', label: 'Forest' },
]

export function Sidebar() {
  const { user, clearAuth, setUser } = useAuthStore()
  const { sidebarOpen, toggleSidebar } = useUiStore()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const themeMutation = useMutation({
    mutationFn: (v: string | null) => usersApi.updateMe({ theme: v }),
    onSuccess: (updated) => setUser(updated),
  })

  const handleThemeChange = (value: string | null) => {
    const prev = theme
    setTheme(value ?? 'system')
    themeMutation.mutate(value, {
      onError: () => setTheme(prev ?? 'system'),
    })
  }
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    clearAuth()
    queryClient.clear()
    void navigate({ to: '/login' })
  }

  const { projectId: currentProjectId } = useParams({ strict: false })

  const { data: currentProject, isLoading: projectLoading } = useQuery({
    queryKey: ['projects', currentProjectId],
    queryFn: () => projectsApi.get(currentProjectId!),
    enabled: !!currentProjectId,
    staleTime: 5 * 60_000,
  })

  const navItems = [
    { to: '/projects', icon: FolderKanban, label: 'Projects' },
    { to: '/daily-report', icon: ClipboardList, label: 'Daily Report' },
    { to: '/priority', icon: Flag, label: 'Priorities' },
    { to: '/settings', icon: Settings, label: 'Settings' },
    ...(user?.role === 'ADMIN' ? [{ to: '/admin', icon: Shield, label: 'Admin' }] : []),
  ]

  return (
    <aside
      className={cn(
        'relative flex flex-col border-r bg-card transition-all duration-200',
        sidebarOpen ? 'w-[240px]' : 'w-[56px]',
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center gap-2 px-3 py-4 border-b', sidebarOpen ? 'justify-between' : 'justify-center')}>
        {sidebarOpen && (
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <LayoutDashboard className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm">TaskFlow</span>
          </div>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleSidebar}>
          <ChevronLeft className={cn('h-4 w-4 transition-transform', !sidebarOpen && 'rotate-180')} />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = pathname.startsWith(to)
          return (
            <div key={to}>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link
                    to={to}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                      active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      !sidebarOpen && 'justify-center px-2',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {sidebarOpen && label}
                  </Link>
                </TooltipTrigger>
                {!sidebarOpen && <TooltipContent side="right">{label}</TooltipContent>}
              </Tooltip>

              {/* Current project breadcrumb */}
              {to === '/projects' && currentProjectId && (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: currentProjectId }}
                      className={cn(
                        'flex items-center gap-2 rounded-md py-1.5 text-xs font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50',
                        sidebarOpen ? 'px-2 ml-4' : 'justify-center px-2',
                      )}
                    >
                      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                      {sidebarOpen && (
                        projectLoading ? (
                          <Skeleton className="h-3 w-24" />
                        ) : (
                          <span className="truncate">{currentProject?.name}</span>
                        )
                      )}
                    </Link>
                  </TooltipTrigger>
                  {!sidebarOpen && (
                    <TooltipContent side="right">
                      {projectLoading ? 'Chargement…' : currentProject?.name}
                    </TooltipContent>
                  )}
                </Tooltip>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom: theme + user */}
      <div className="border-t p-2 space-y-1">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size={sidebarOpen ? 'sm' : 'icon'}
                  className={cn('w-full', sidebarOpen ? 'justify-start gap-3 px-2' : 'h-9 w-9')}
                >
                  <Palette className="h-4 w-4 shrink-0" />
                  {sidebarOpen && <span className="text-sm">Theme</span>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end">
                {THEMES.map(({ value, label }) => (
                  <DropdownMenuItem
                    key={value}
                    onClick={() => handleThemeChange(value)}
                    className={cn(theme === value && 'bg-accent text-accent-foreground')}
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleThemeChange(null)}>
                  System default
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipTrigger>
          {!sidebarOpen && <TooltipContent side="right">Theme</TooltipContent>}
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={sidebarOpen ? 'sm' : 'icon'}
              className={cn('w-full text-destructive hover:text-destructive', sidebarOpen ? 'justify-start gap-3 px-2' : 'h-9 w-9')}
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              {sidebarOpen && <span className="text-sm">Sign out</span>}
            </Button>
          </TooltipTrigger>
          {!sidebarOpen && <TooltipContent side="right">Sign out</TooltipContent>}
        </Tooltip>

        {user && (
          <div className={cn('flex items-center gap-2 px-2 py-2 rounded-md', sidebarOpen ? '' : 'justify-center')}>
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarImage src={user.avatarUrl} />
              <AvatarFallback className="text-[10px]">{getInitials(user.displayName)}</AvatarFallback>
            </Avatar>
            {sidebarOpen && (
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{user.displayName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
