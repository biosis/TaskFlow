import { createFileRoute } from '@tanstack/react-router'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Loader2, FolderKanban, Users, CheckSquare, MoreHorizontal, Trash2, AlertCircle, Clock, Ban, Pencil, Archive, ArchiveRestore, ChevronDown, ChevronRight } from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { projectsApi } from '@/api/projects'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/utils'
import type { Project, TaskStatus, TaskPriority } from '@/types'

export const Route = createFileRoute('/_app/projects/')({
  component: ProjectsPage,
})

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
})
type CreateForm = z.infer<typeof createSchema>

function ProjectsPage() {
  const [open, setOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['projects'],
    queryFn: ({ pageParam }) => projectsApi.list({ cursor: pageParam as string | undefined }),
    getNextPageParam: (last) => last.nextCursor,
    initialPageParam: undefined as string | undefined,
  })

  const { data: archivedData, isLoading: archivedLoading } = useInfiniteQuery({
    queryKey: ['projects', 'archived'],
    queryFn: ({ pageParam }) => projectsApi.list({ cursor: pageParam as string | undefined, archived: true }),
    getNextPageParam: (last) => last.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled: showArchived,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  })

  const createProject = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project created')
      reset()
      setOpen(false)
    },
    onError: () => toast.error('Failed to create project'),
  })

  const deleteProject = useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project deleted')
    },
    onError: () => toast.error('Failed to delete project'),
  })

  const archiveProject = useMutation({
    mutationFn: projectsApi.archive,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Projet archivé')
    },
    onError: () => toast.error("Échec de l'archivage"),
  })

  const unarchiveProject = useMutation({
    mutationFn: projectsApi.unarchive,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Projet restauré')
    },
    onError: () => toast.error('Échec de la restauration'),
  })

  const projects = data?.pages.flatMap((p) => p.items) ?? []
  const archivedProjects = archivedData?.pages.flatMap((p) => p.items) ?? []

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your projects and track progress</p>
        </div>
        <div className="flex items-center gap-3">
          {projects.length > 0 && (
            <Select onValueChange={(id) => void navigate({ to: '/projects/$projectId', params: { projectId: id } })}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Aller à un projet…" />
              </SelectTrigger>
              <SelectContent>
                {[...projects].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> New project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create project</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit((d) => createProject.mutate(d))}>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label>Project name</Label>
                  <Input placeholder="My awesome project" {...register('name')} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
                  <Textarea placeholder="What's this project about?" rows={3} {...register('description')} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createProject.isPending}>
                  {createProject.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-48 mt-1" /></CardHeader>
                <CardContent><Skeleton className="h-4 w-full" /></CardContent>
                <CardFooter><Skeleton className="h-4 w-24" /></CardFooter>
              </Card>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <FolderKanban className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-medium">No projects yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Create your first project to get started</p>
            <Button className="mt-4" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> New project
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onDelete={() => deleteProject.mutate(project.id)}
                  onArchive={() => archiveProject.mutate(project.id)}
                />
              ))}
            </div>
            {hasNextPage && (
              <div className="flex justify-center mt-6">
                <Button variant="outline" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
                  {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
                  Load more
                </Button>
              </div>
            )}
          </>
        )}

        {/* Archived projects section */}
        <div>
          <button
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Archive className="h-4 w-4" />
            Projets archivés
            {showArchived && archivedProjects.length > 0 && (
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">{archivedProjects.length}</span>
            )}
          </button>

          {showArchived && (
            archivedLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : archivedProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun projet archivé.</p>
            ) : (
              <div className="space-y-2">
                {archivedProjects.map((project) => (
                  <div key={project.id} className="flex items-center justify-between px-4 py-3 rounded-lg border bg-muted/30">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{project.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Archivé {project.archivedAt ? formatDate(project.archivedAt) : ''}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 shrink-0 ml-4"
                      disabled={unarchiveProject.isPending}
                      onClick={() => unarchiveProject.mutate(project.id)}
                    >
                      {unarchiveProject.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      )}
                      Restaurer
                    </Button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; pill: string; bg: string; Icon: typeof Clock }> = {
  TODO:        { label: 'À faire',  pill: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',              bg: 'bg-slate-400',           Icon: Clock },
  IN_PROGRESS: { label: 'En cours', pill: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',               bg: 'bg-blue-500',            Icon: Loader2 },
  REVIEW:      { label: 'Revue',    pill: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',        bg: 'bg-purple-500',          Icon: CheckSquare },
  BLOCKED:     { label: 'Bloqué',   pill: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',                   bg: 'bg-red-500',             Icon: AlertCircle },
  DONE:        { label: 'Terminé',  pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',   bg: 'bg-emerald-500',         Icon: CheckSquare },
  CANCELLED:   { label: 'Annulé',  pill: 'bg-muted text-muted-foreground',                                                  bg: 'bg-muted-foreground/40', Icon: Ban },
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  URGENT: { label: 'Urgent', color: 'bg-red-500' },
  HIGH: { label: 'Haute', color: 'bg-orange-400' },
  MEDIUM: { label: 'Moyenne', color: 'bg-yellow-400' },
  LOW: { label: 'Basse', color: 'bg-green-400' },
}

function ProjectCard({ project, onDelete, onArchive }: { project: Project; onDelete: () => void; onArchive: () => void }) {
  const [editOpen, setEditOpen] = useState(false)
  const qc = useQueryClient()

  const { register: regEdit, handleSubmit: handleEdit, reset: resetEdit, formState: { errors: editErrors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: project.name, description: project.description ?? '' },
  })

  const updateProject = useMutation({
    mutationFn: (d: CreateForm) => projectsApi.update(project.id, d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Projet mis à jour')
      setEditOpen(false)
    },
    onError: () => toast.error('Échec de la mise à jour'),
  })

  const { data: stats } = useQuery({
    queryKey: ['project-stats', project.id],
    queryFn: () => projectsApi.stats(project.id),
    staleTime: 60_000,
  })

  const total = stats ? Object.values(stats.byStatus).reduce((a, b) => a + b, 0) : 0
  const done = stats?.byStatus['DONE'] ?? 0
  const completion = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <>
    <Card className="group overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FolderKanban className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base truncate">{project.name}</CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { resetEdit({ name: project.name, description: project.description ?? '' }); setEditOpen(true) }}>
                <Pencil className="h-4 w-4 mr-2" /> Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onArchive}>
                <Archive className="h-4 w-4 mr-2" /> Archiver
              </DropdownMenuItem>
              {(project._count?.tasks ?? 0) === 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                    <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {project.description && (
          <CardDescription className="line-clamp-2 mt-1">{project.description}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="pb-3 flex-1 space-y-3">
        {/* Meta row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {project._count && (
            <>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />{project._count.members} membres
              </span>
              <span className="flex items-center gap-1">
                <CheckSquare className="h-3.5 w-3.5" />{project._count.tasks} tâches
              </span>
            </>
          )}
        </div>

        {/* Dashboard section */}
        {!stats ? (
          <div className="space-y-2">
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex gap-1.5">
              {[40, 60, 50, 70, 45].map((w, i) => <Skeleton key={i} className={`h-3.5 rounded-full`} style={{ width: `${w}px` }} />)}
            </div>
          </div>
        ) : total === 0 ? (
          <p className="text-xs text-muted-foreground italic">Aucune tâche pour l'instant</p>
        ) : (
          <div className="space-y-2">
            {/* Completion bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex">
                {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((s) => {
                  const count = stats.byStatus[s] ?? 0
                  if (count === 0) return null
                  const pct = (count / total) * 100
                  return (
                    <div
                      key={s}
                      className={`${STATUS_CONFIG[s].bg} h-full transition-all`}
                      style={{ width: `${pct}%` }}
                      title={`${STATUS_CONFIG[s].label}: ${count}`}
                    />
                  )
                })}
              </div>
              <span className="text-xs font-medium tabular-nums text-muted-foreground shrink-0">{completion}%</span>
            </div>

            {/* Status pills */}
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((s) => {
                const count = stats.byStatus[s] ?? 0
                if (count === 0) return null
                const cfg = STATUS_CONFIG[s]
                return (
                  <span
                    key={s}
                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.pill}`}
                  >
                    <cfg.Icon className="h-3 w-3" />
                    {count} {cfg.label}
                  </span>
                )
              })}
            </div>

            {/* Priority bar */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground shrink-0">Priorité:</span>
              <div className="flex gap-1">
                {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map((p) => {
                  const count = stats.byPriority[p] ?? 0
                  if (count === 0) return null
                  return (
                    <span
                      key={p}
                      className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded text-white ${PRIORITY_CONFIG[p].color}`}
                      title={PRIORITY_CONFIG[p].label}
                    >
                      {count}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-3 border-t flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Créé {formatDate(project.createdAt)}</span>
        <Link to="/projects/$projectId" params={{ projectId: project.id }}>
          <Button size="sm" variant="ghost" className="h-7 text-xs">Ouvrir →</Button>
        </Link>
      </CardFooter>
    </Card>

    <Dialog open={editOpen} onOpenChange={setEditOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier le projet</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleEdit((d) => updateProject.mutate(d))}>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Nom du projet</Label>
              <Input {...regEdit('name')} />
              {editErrors.name && <p className="text-xs text-destructive">{editErrors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground">(optionnel)</span></Label>
              <Textarea rows={3} {...regEdit('description')} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={updateProject.isPending}>
              {updateProject.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}
