import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Loader2, AlertCircle, AlertTriangle, ChevronUp, Minus, Calendar, MessageSquare, Trash2, ArrowUpDown, Archive, ArchiveRestore, Eye, EyeOff, ArchiveX } from 'lucide-react'
import { tasksApi, type CreateTaskInput, type TaskSort } from '@/api/tasks'
import { projectsApi } from '@/api/projects'
import { useAuthStore } from '@/stores/auth.store'
import { LabelBadges } from '@/components/LabelBadges'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn, getInitials, formatDate } from '@/lib/utils'
import type { Task, TaskStatus, TaskPriority } from '@/types'
import { TaskDetailDialog } from '@/features/tasks/TaskDetailDialog'

export const Route = createFileRoute('/_app/projects/$projectId/list')({
  component: ListView,
})

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  REVIEW: 'Review',
  BLOCKED: 'Blocked',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
}

const PRIORITY_ICONS: Record<TaskPriority, React.ReactNode> = {
  URGENT: <AlertCircle className="h-3.5 w-3.5 text-red-500" />,
  HIGH: <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />,
  MEDIUM: <ChevronUp className="h-3.5 w-3.5 text-yellow-500" />,
  LOW: <Minus className="h-3.5 w-3.5 text-green-500" />,
}

const SORT_OPTIONS: { value: TaskSort; label: string }[] = [
  { value: 'createdAt', label: 'Date de création' },
  { value: 'movedAt', label: 'Date de déplacement' },
  { value: 'dueDate', label: "Date d'échéance" },
  { value: 'priority', label: 'Priorité' },
  { value: 'position', label: 'Position' },
]

function ListView() {
  const { projectId } = Route.useParams()
  const qc = useQueryClient()
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM')
  const [status, setStatus] = useState<TaskStatus>('TODO')
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([])
  const [sort, setSort] = useState<TaskSort>('movedAt')
  const [showArchived, setShowArchived] = useState(false)

  const { user } = useAuthStore()
  const archiveThresholdMs = (user?.archiveThresholdDays ?? 14) * 24 * 60 * 60 * 1000

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', projectId, { sort, archived: showArchived ? 'include' : 'exclude' }],
    queryFn: () => tasksApi.list(projectId, { sort, limit: 100, archived: showArchived ? 'include' : 'exclude' }),
  })

  const { data: projectLabels } = useQuery({
    queryKey: ['projects', projectId, 'labels'],
    queryFn: () => projectsApi.labels.list(projectId),
    enabled: createOpen,
  })

  const deleteTask = useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      toast.success('Task deleted')
    },
    onError: () => toast.error('Failed to delete task'),
  })

  const archiveTask = useMutation({
    mutationFn: tasksApi.archive,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      toast.success('Tâche archivée')
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? 'Impossible d\'archiver la tâche'),
  })

  const archiveOld = useMutation({
    mutationFn: () => tasksApi.archiveOld(projectId),
    onSuccess: ({ archivedCount }) => {
      void qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      toast.success(archivedCount > 0
        ? `${archivedCount} tâche${archivedCount > 1 ? 's' : ''} archivée${archivedCount > 1 ? 's' : ''}`
        : 'Aucune tâche à archiver')
    },
    onError: () => toast.error('Impossible d\'archiver les anciennes tâches'),
  })

  const unarchiveTask = useMutation({
    mutationFn: tasksApi.unarchive,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      toast.success('Tâche désarchivée')
    },
    onError: () => toast.error('Impossible de désarchiver la tâche'),
  })

  const create = useMutation({
    mutationFn: (data: CreateTaskInput) => tasksApi.create(projectId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      toast.success('Task created')
      setTitle('')
      setSelectedLabelIds([])
      setCreateOpen(false)
    },
    onError: () => toast.error('Failed to create task'),
  })

  const tasks = (data?.items ?? []).filter((t) => !t.parentId)

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-6 py-3 flex items-center justify-between border-b shrink-0">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{tasks.length} tasks</p>
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={sort} onValueChange={(v) => setSort(v as TaskSort)}>
              <SelectTrigger className="h-7 text-xs w-44 border-none shadow-none bg-muted/50 hover:bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs transition-colors border',
              showArchived
                ? 'text-amber-700 border-amber-300 bg-amber-50'
                : 'text-muted-foreground border-border bg-muted/50 hover:bg-muted',
            )}
          >
            {showArchived ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            Archivées
          </button>
          <button
            onClick={() => archiveOld.mutate()}
            disabled={archiveOld.isPending}
            title="Archiver les tâches terminées ou annulées depuis plus de 2 semaines"
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs transition-colors border text-muted-foreground border-border bg-muted/50 hover:bg-muted disabled:opacity-50"
          >
            {archiveOld.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArchiveX className="h-3 w-3" />}
            Archiver
          </button>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Add task
        </Button>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="font-medium">No tasks yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add your first task to get started</p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Add task
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-8"></th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Task</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-32">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-28">Priority</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-32">Assignees</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-28">Due date</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task, idx) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isLast={idx === tasks.length - 1}
                    onClick={() => setActiveTaskId(task.id)}
                    onDelete={() => deleteTask.mutate(task.id)}
                    onArchive={() => archiveTask.mutate(task.id)}
                    onUnarchive={() => unarchiveTask.mutate(task.id)}
                    archiveThresholdMs={archiveThresholdMs}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create task</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input placeholder="Task title..." value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as TaskPriority[]).map((p) => (
                      <SelectItem key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          {projectLabels && projectLabels.length > 0 && (
            <div className="space-y-1.5 py-2">
              <Label>Labels</Label>
              <div className="flex flex-wrap gap-1.5">
                {projectLabels.map((label) => {
                  const selected = selectedLabelIds.includes(label.id)
                  return (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() =>
                        setSelectedLabelIds((prev) =>
                          selected ? prev.filter((id) => id !== label.id) : [...prev, label.id],
                        )
                      }
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-opacity',
                        selected ? 'opacity-100' : 'opacity-40 hover:opacity-70',
                      )}
                      style={{ backgroundColor: label.color + '30', color: label.color }}
                    >
                      {label.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => create.mutate({ title, status, priority, labelIds: selectedLabelIds })}
              disabled={!title.trim() || create.isPending}
            >
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeTaskId && (
        <TaskDetailDialog taskId={activeTaskId} projectId={projectId} onClose={() => setActiveTaskId(null)} />
      )}
    </div>
  )
}

const ARCHIVABLE_STATUSES: string[] = ['DONE', 'CANCELLED']

function TaskRow({
  task, isLast, onClick, onDelete, onArchive, onUnarchive, archiveThresholdMs,
}: {
  task: Task; isLast: boolean; onClick: () => void; onDelete: () => void
  onArchive: () => void; onUnarchive: () => void; archiveThresholdMs: number
}) {
  const isArchived = !!task.archivedAt
  const isOldEnough = Date.now() - new Date(task.createdAt).getTime() > archiveThresholdMs
  const isArchivable = !isArchived && isOldEnough && ARCHIVABLE_STATUSES.includes(task.status)

  return (
    <tr
      className={cn(
        'group hover:bg-muted/30 cursor-pointer transition-colors',
        !isLast && 'border-b',
        isArchived && 'opacity-60',
      )}
      onClick={onClick}
    >
      <td className="px-4 py-3">{PRIORITY_ICONS[task.priority]}</td>
      <td className="px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            {task.description ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-medium truncate max-w-sm">{task.title}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    {task.description}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <span className="font-medium truncate max-w-sm">{task.title}</span>
            )}
            {isArchived && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                <Archive className="h-2.5 w-2.5" />Archivée
              </span>
            )}
            {task._count?.comments ? (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <MessageSquare className="h-3 w-3" />{task._count.comments}
              </span>
            ) : null}
          </div>
          <LabelBadges labels={task.labels ?? []} max={3} className="mt-1" />
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusBadgeClass(task.status))}>
          {STATUS_LABELS[task.status]}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{task.priority.toLowerCase()}</td>
      <td className="px-4 py-3">
        <div className="flex -space-x-1.5">
          {task.assignees?.slice(0, 3).map((u) => (
            <Avatar key={u.id} className="h-5 w-5 border-2 border-background">
              <AvatarFallback className="text-[8px]">{getInitials(u.displayName)}</AvatarFallback>
            </Avatar>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {task.dueDate ? (
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(task.dueDate)}</span>
        ) : '—'}
      </td>
      <td className="px-2 py-3">
        <div className="flex items-center gap-0.5">
          {isArchived ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 text-amber-600 hover:text-amber-700"
              title="Désarchiver"
              onClick={(e) => { e.stopPropagation(); onUnarchive() }}
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
            </Button>
          ) : isArchivable ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-amber-600"
              title="Archiver"
              onClick={(e) => { e.stopPropagation(); onArchive() }}
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete() }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}

function statusBadgeClass(status: TaskStatus) {
  switch (status) {
    case 'TODO': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    case 'IN_PROGRESS': return 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
    case 'BLOCKED': return 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
    case 'DONE': return 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300'
    case 'CANCELLED': return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
}
