import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { DndContext, DragOverlay, pointerWithin, rectIntersection, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { Plus, Loader2, GripVertical, MessageSquare, Calendar, AlertCircle, AlertTriangle, Minus, ChevronUp, ArrowRightLeft, ArrowUpDown, Eye, EyeOff, Archive, ArchiveRestore } from 'lucide-react'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn, getInitials, formatDate } from '@/lib/utils'
import type { Task, TaskStatus, TaskPriority, Project } from '@/types'
import { TaskDetailDialog } from '@/features/tasks/TaskDetailDialog'

export const Route = createFileRoute('/_app/projects/$projectId/')({
  component: BoardPage,
})

const COLUMNS: { id: TaskStatus; label: string; dotClass: string }[] = [
  { id: 'TODO', label: 'To Do', dotClass: 'bg-slate-400' },
  { id: 'IN_PROGRESS', label: 'In Progress', dotClass: 'bg-blue-500' },
  { id: 'REVIEW', label: 'Review', dotClass: 'bg-purple-500' },
  { id: 'BLOCKED', label: 'Blocked', dotClass: 'bg-red-500' },
  { id: 'DONE', label: 'Done', dotClass: 'bg-green-500' },
  { id: 'CANCELLED', label: 'Cancelled', dotClass: 'bg-gray-400' },
]


const PRIORITY_ICONS: Record<TaskPriority, React.ReactNode> = {
  URGENT: <AlertCircle className="h-3 w-3 text-red-500" />,
  HIGH: <AlertTriangle className="h-3 w-3 text-orange-500" />,
  MEDIUM: <ChevronUp className="h-3 w-3 text-yellow-500" />,
  LOW: <Minus className="h-3 w-3 text-green-500" />,
}

const SORT_OPTIONS: { value: TaskSort; label: string }[] = [
  { value: 'createdAt', label: 'Date de création' },
  { value: 'movedAt', label: 'Date de déplacement' },
  { value: 'dueDate', label: 'Date d\'échéance' },
  { value: 'priority', label: 'Priorité' },
  { value: 'position', label: 'Position' },
]

function BoardPage() {
  const { projectId } = Route.useParams()
  const qc = useQueryClient()
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [draggingTask, setDraggingTask] = useState<Task | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createStatus, setCreateStatus] = useState<TaskStatus>('TODO')
  const [sort, setSort] = useState<TaskSort>('movedAt')
  const [hiddenColumns, setHiddenColumns] = useState<Set<TaskStatus>>(new Set())
  const [showArchived, setShowArchived] = useState(false)

  const toggleColumn = (id: TaskStatus) =>
    setHiddenColumns((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const { user } = useAuthStore()
  const archiveThresholdMs = (user?.archiveThresholdDays ?? 14) * 24 * 60 * 60 * 1000

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', projectId, { sort, archived: 'include' }],
    queryFn: () => tasksApi.list(projectId, { sort, limit: 100, archived: 'include' }),
  })

  const updateTask = useMutation({
    mutationFn: ({ id, ...rest }: { id: string; status: TaskStatus }) => tasksApi.update(id, rest),
    onMutate: async ({ id, status }) => {
      const key = ['tasks', projectId, { sort, archived: 'include' }]
      await qc.cancelQueries({ queryKey: ['tasks', projectId] })
      const prev = qc.getQueryData<{ items: Task[] }>(key)
      const now = new Date().toISOString()
      qc.setQueryData(key, (old: { items: Task[]; nextCursor?: string } | undefined) => ({
        ...old,
        items: old?.items.map((t) => (t.id === id ? { ...t, status, movedAt: now } : t)) ?? [],
      }))
      return { prev }
    },
    onError: (_, __, ctx) => {
      qc.setQueryData(['tasks', projectId, { sort, archived: 'include' }], ctx?.prev)
      toast.error('Failed to update task')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
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

  const allTasks = (data?.items ?? []).filter((t) => !t.parentId)
  const tasks = allTasks.filter((t) => !t.archivedAt)
  const archivedTasks = allTasks.filter((t) => t.archivedAt)

  const activeTasksByStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragStart = (event: { active: { id: string | number } }) => {
    const task = tasks.find((t) => t.id === event.active.id)
    if (task) setDraggingTask(task)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingTask(null)
    const { active, over } = event
    if (!over) return
    const task = tasks.find((t) => t.id === active.id)
    if (!task) return
    let target: TaskStatus
    if (COLUMNS.some((c) => c.id === over.id)) {
      target = over.id as TaskStatus
    } else {
      const overTask = tasks.find((t) => t.id === over.id)
      if (!overTask) return
      target = overTask.status as TaskStatus
    }
    if (task.status === target) return
    updateTask.mutate({ id: task.id, status: target })
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
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
        </div>
        <div className="flex items-center gap-2">
          {([{ id: 'REVIEW', label: 'Review', dotClass: 'bg-purple-500' }, { id: 'BLOCKED', label: 'Blocked', dotClass: 'bg-red-500' }, { id: 'CANCELLED', label: 'Cancelled', dotClass: 'bg-gray-400' }] as Pick<typeof COLUMNS[number], 'id' | 'label' | 'dotClass'>[]).map((col) => {
            const hidden = hiddenColumns.has(col.id as TaskStatus)
            return (
              <button
                key={col.id}
                onClick={() => toggleColumn(col.id as TaskStatus)}
                className={cn(
                  'flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs transition-colors border',
                  hidden
                    ? 'text-muted-foreground border-border bg-muted/30 opacity-60'
                    : 'text-foreground border-border bg-muted/50 hover:bg-muted',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', col.dotClass)} />
                {col.label}
                {hidden
                  ? <EyeOff className="h-3 w-3 ml-0.5" />
                  : <Eye className="h-3 w-3 ml-0.5" />
                }
              </button>
            )
          })}
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs transition-colors border',
              showArchived
                ? 'text-amber-700 border-amber-300 bg-amber-50'
                : 'text-muted-foreground border-border bg-muted/50 hover:bg-muted',
            )}
          >
            <Archive className="h-3 w-3" />
            Archivées
            {archivedTasks.length > 0 && (
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none',
                showArchived ? 'bg-amber-200 text-amber-800' : 'bg-muted text-muted-foreground',
              )}>
                {archivedTasks.length}
              </span>
            )}
            {showArchived ? <Eye className="h-3 w-3 ml-0.5" /> : <EyeOff className="h-3 w-3 ml-0.5" />}
          </button>
          <button
            onClick={() => archiveOld.mutate()}
            disabled={archiveOld.isPending}
            title="Archiver les tâches terminées ou annulées depuis plus de 2 semaines"
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs transition-colors border text-muted-foreground border-border bg-muted/50 hover:bg-muted disabled:opacity-50"
          >
            {archiveOld.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
            Archiver
          </button>
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Add task
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 p-6 h-full min-w-max">
          {isLoading ? (
            COLUMNS.map((col) => (
              <div key={col.id} className="w-72 space-y-3">
                <Skeleton className="h-6 w-24" />
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
              </div>
            ))
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={(args) => {
                const pointer = pointerWithin(args)
                return pointer.length > 0 ? pointer : rectIntersection(args)
              }}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {COLUMNS.filter((col) => !hiddenColumns.has(col.id)).map((col) => (
                <BoardColumn
                  key={col.id}
                  column={col}
                  tasks={activeTasksByStatus(col.id)}
                  archiveThresholdMs={archiveThresholdMs}
                  onTaskClick={(id) => setActiveTaskId(id)}
                  onAddTask={() => { setCreateStatus(col.id); setCreateOpen(true) }}
                  onArchive={(id) => archiveTask.mutate(id)}
                />
              ))}
              {showArchived && (
                <ArchivedColumn
                  tasks={archivedTasks}
                  onTaskClick={(id) => setActiveTaskId(id)}
                  onUnarchive={(id) => unarchiveTask.mutate(id)}
                />
              )}
              <DragOverlay>
                {draggingTask && <TaskCard task={draggingTask} isDragging />}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </div>

      <CreateTaskDialog
        projectId={projectId}
        open={createOpen}
        defaultStatus={createStatus}
        onOpenChange={setCreateOpen}
      />

      {activeTaskId && (
        <TaskDetailDialog
          taskId={activeTaskId}
          projectId={projectId}
          onClose={() => setActiveTaskId(null)}
        />
      )}
    </div>
  )
}

const BOARD_ARCHIVABLE_STATUSES: string[] = ['DONE', 'CANCELLED']

function BoardColumn({
  column,
  tasks,
  archiveThresholdMs,
  onTaskClick,
  onAddTask,
  onArchive,
}: {
  column: (typeof COLUMNS)[number]
  tasks: Task[]
  archiveThresholdMs: number
  onTaskClick: (id: string) => void
  onAddTask: () => void
  onArchive: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  return (
    <div className="w-72 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', column.dotClass)} />
          <span className="text-sm font-medium">{column.label}</span>
          <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">{tasks.length}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAddTask}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div
            ref={setNodeRef}
            className={cn(
              'flex flex-col gap-2 min-h-[200px] p-2 rounded-lg transition-colors',
              isOver ? 'bg-accent/40' : 'bg-muted',
            )}
          >
            {tasks.map((task) => {
              const isOldEnough = Date.now() - new Date(task.createdAt).getTime() > archiveThresholdMs
              const isArchivable = isOldEnough && BOARD_ARCHIVABLE_STATUSES.includes(task.status)
              return (
                <SortableTaskCard
                  key={task.id}
                  task={task}
                  onClick={() => onTaskClick(task.id)}
                  onArchive={isArchivable ? () => onArchive(task.id) : undefined}
                />
              )
            })}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  )
}

const STATUS_LABELS: Partial<Record<TaskStatus, string>> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  REVIEW: 'Review',
  BLOCKED: 'Blocked',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
}

function ArchivedColumn({
  tasks,
  onTaskClick,
  onUnarchive,
}: {
  tasks: Task[]
  onTaskClick: (id: string) => void
  onUnarchive: (id: string) => void
}) {
  return (
    <div className="w-72 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Archive className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-medium">Archivées</span>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">{tasks.length}</span>
      </div>
      <ScrollArea>
        <div className="flex flex-col gap-2 min-h-[200px] p-2 rounded-lg bg-amber-50/60 border border-amber-200/60">
          {tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Aucune tâche archivée</p>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task.id)}
                isArchived
                statusLabel={STATUS_LABELS[task.status]}
                onUnarchive={() => onUnarchive(task.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function SortableTaskCard({ task, onClick, onArchive }: { task: Task; onClick: () => void; onArchive?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      <TaskCard task={task} onClick={onClick} dragHandleProps={{ ...attributes, ...listeners }} onArchive={onArchive} />
    </div>
  )
}

export function TaskCard({
  task,
  onClick,
  isDragging,
  dragHandleProps,
  isArchived,
  statusLabel,
  onArchive,
  onUnarchive,
}: {
  task: Task
  onClick?: () => void
  isDragging?: boolean
  dragHandleProps?: Record<string, unknown>
  isArchived?: boolean
  statusLabel?: string
  onArchive?: () => void
  onUnarchive?: () => void
}) {
  return (
    <div
      className={cn(
        'bg-card border rounded-lg p-3 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all group',
        isDragging && 'shadow-lg rotate-1',
        isArchived && 'opacity-60',
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-1.5">
        {!isArchived && (
          <button
            className="mt-0.5 opacity-0 group-hover:opacity-40 hover:!opacity-80 transition-opacity cursor-grab active:cursor-grabbing"
            {...dragHandleProps}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-1.5 mb-2">
            <span className="mt-0.5 shrink-0">{PRIORITY_ICONS[task.priority]}</span>
            {task.description ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-sm font-medium leading-tight line-clamp-2">{task.title}</p>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    {task.description}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <p className="text-sm font-medium leading-tight line-clamp-2">{task.title}</p>
            )}
            {isArchived && (
              <span className="shrink-0 ml-auto inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                {statusLabel ?? <Archive className="h-2.5 w-2.5" />}
              </span>
            )}
          </div>

          <LabelBadges labels={task.labels ?? []} max={2} className="mb-2" />

          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              {task._count?.comments ? (
                <span className="flex items-center gap-0.5 text-[10px]">
                  <MessageSquare className="h-3 w-3" />{task._count.comments}
                </span>
              ) : null}
              {task.dueDate && (
                <span className="flex items-center gap-0.5 text-[10px]">
                  <Calendar className="h-3 w-3" />{formatDate(task.dueDate)}
                </span>
              )}
              <span className="flex items-center gap-0.5 text-[10px]">
                {task.movedAt
                  ? <><ArrowRightLeft className="h-3 w-3" />{formatDate(task.movedAt)}</>
                  : <><Calendar className="h-3 w-3" />{formatDate(task.createdAt)}</>
                }
              </span>
            </div>
            <div className="flex items-center gap-1">
              {isArchived && onUnarchive && (
                <button
                  className="opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity text-amber-600"
                  title="Désarchiver"
                  onClick={(e) => { e.stopPropagation(); onUnarchive() }}
                >
                  <ArchiveRestore className="h-3.5 w-3.5" />
                </button>
              )}
              {!isArchived && onArchive && (
                <button
                  className="opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity text-muted-foreground hover:text-amber-600"
                  title="Archiver"
                  onClick={(e) => { e.stopPropagation(); onArchive() }}
                >
                  <Archive className="h-3.5 w-3.5" />
                </button>
              )}
              {task.assignees && task.assignees.length > 0 && (
                <div className="flex -space-x-1.5">
                  {task.assignees.slice(0, 3).map((user) => (
                    <Avatar key={user.id} className="h-5 w-5 border-2 border-card">
                      <AvatarFallback className="text-[8px]">{getInitials(user.displayName)}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CreateTaskDialog({
  projectId,
  open,
  defaultStatus,
  onOpenChange,
}: {
  projectId: string
  open: boolean
  defaultStatus: TaskStatus
  onOpenChange: (v: boolean) => void
}) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM')
  const [status, setStatus] = useState<TaskStatus>(defaultStatus)
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([])

  const { data: projectLabels } = useQuery({
    queryKey: ['projects', projectId, 'labels'],
    queryFn: () => projectsApi.labels.list(projectId),
    enabled: open,
  })

  const create = useMutation({
    mutationFn: (data: CreateTaskInput) => tasksApi.create(projectId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      toast.success('Task created')
      setTitle('')
      setSelectedLabelIds([])
      onOpenChange(false)
    },
    onError: () => toast.error('Failed to create task'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                  {COLUMNS.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
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
          <div className="space-y-1.5">
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => create.mutate({ title, status, priority, labelIds: selectedLabelIds })}
            disabled={!title.trim() || create.isPending}
          >
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
