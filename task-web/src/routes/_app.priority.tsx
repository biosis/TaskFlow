import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import {
  Flag,
  Calendar,
  AlertCircle,
  AlertTriangle,
  Minus,
  ChevronUp,
} from 'lucide-react'
import { tasksApi } from '@/api/tasks'
import { projectsApi } from '@/api/projects'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, getInitials, formatDate } from '@/lib/utils'
import type { GlobalTask, TaskPriority } from '@/types'
import { TaskDetailDialog } from '@/features/tasks/TaskDetailDialog'

export const Route = createFileRoute('/_app/priority')({
  component: PriorityPage,
})

const PRIORITY_COLUMNS: { id: TaskPriority; label: string }[] = [
  { id: 'URGENT', label: 'Urgent' },
  { id: 'HIGH', label: 'High' },
  { id: 'MEDIUM', label: 'Medium' },
  { id: 'LOW', label: 'Low' },
]

const PRIORITY_ICONS: Record<TaskPriority, React.ReactNode> = {
  URGENT: <AlertCircle className="h-4 w-4 text-red-500" />,
  HIGH: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  MEDIUM: <ChevronUp className="h-4 w-4 text-yellow-500" />,
  LOW: <Minus className="h-4 w-4 text-green-500" />,
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  URGENT: 'border-red-200 dark:border-red-900/50',
  HIGH: 'border-orange-200 dark:border-orange-900/50',
  MEDIUM: 'border-yellow-200 dark:border-yellow-900/50',
  LOW: 'border-green-200 dark:border-green-900/50',
}

const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
}

const STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
}

function PriorityPage() {
  const qc = useQueryClient()
  const [filterProjectId, setFilterProjectId] = useState<string | undefined>()
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [draggingTask, setDraggingTask] = useState<GlobalTask | null>(null)
  const [customOrder, setCustomOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('priority-board-order')
      return saved ? (JSON.parse(saved) as string[]) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    if (customOrder.length > 0) {
      localStorage.setItem('priority-board-order', JSON.stringify(customOrder))
    }
  }, [customOrder])

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'list-all'],
    queryFn: () => projectsApi.list(),
    staleTime: 5 * 60_000,
  })

  const queryKey = ['tasks', 'global', { projectId: filterProjectId }]

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => tasksApi.listGlobal({ projectId: filterProjectId }),
    staleTime: 60_000,
  })

  const allTasks = data?.items ?? []

  const sortedTasks = useMemo(() => {
    if (customOrder.length === 0) return allTasks
    const orderMap = new Map(customOrder.map((id, i) => [id, i]))
    return [...allTasks].sort((a, b) => {
      const posA = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER
      const posB = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER
      return posA - posB
    })
  }, [allTasks, customOrder])

  const updatePriority = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: TaskPriority }) =>
      tasksApi.update(id, { priority }),
    onMutate: async ({ id, priority }) => {
      await qc.cancelQueries({ queryKey: ['tasks', 'global'] })
      const prev = qc.getQueryData<{ items: GlobalTask[] }>(queryKey)
      qc.setQueryData(queryKey, (old: { items: GlobalTask[] } | undefined) => ({
        items: old?.items.map((t) => (t.id === id ? { ...t, priority } : t)) ?? [],
      }))
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(queryKey, ctx?.prev)
      toast.error('Failed to update priority')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks', 'global'] }),
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragStart = (event: DragStartEvent) => {
    const task = sortedTasks.find((t) => t.id === event.active.id)
    if (task) setDraggingTask(task)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingTask(null)
    const { active, over } = event
    if (!over) return
    const task = sortedTasks.find((t) => t.id === active.id)
    if (!task) return

    const isColumnDrop = PRIORITY_COLUMNS.some((c) => c.id === over.id)
    const targetPriority = isColumnDrop
      ? (over.id as TaskPriority)
      : (sortedTasks.find((t) => t.id === over.id)?.priority ?? task.priority)

    if (task.priority !== targetPriority) {
      updatePriority.mutate({ id: task.id, priority: targetPriority })
    }

    if (!isColumnDrop && active.id !== over.id) {
      const ids = sortedTasks.map((t) => t.id)
      const oldIndex = ids.indexOf(active.id as string)
      const newIndex = ids.indexOf(over.id as string)
      if (oldIndex !== -1 && newIndex !== -1) {
        setCustomOrder(arrayMove(ids, oldIndex, newIndex))
      }
    }
  }

  const projects = projectsData?.items ?? []
  const activeTask = activeTaskId ? sortedTasks.find((t) => t.id === activeTaskId) : null

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="border-b px-6 py-4 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Flag className="h-4 w-4" />
            Priority Board
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Drag tasks between columns to change their priority — TODO &amp; In Progress only
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={filterProjectId ?? 'all'}
            onValueChange={(v) => setFilterProjectId(v === 'all' ? undefined : v)}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex gap-4 p-6">
          {PRIORITY_COLUMNS.map((col) => (
            <div key={col.id} className="w-72 shrink-0">
              <Skeleton className="h-5 w-24 mb-3" />
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 p-6 h-full min-w-max">
            <DndContext
              sensors={sensors}
              collisionDetection={(args) => {
                const pointer = pointerWithin(args)
                return pointer.length > 0 ? pointer : rectIntersection(args)
              }}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {PRIORITY_COLUMNS.map((col) => (
                <PriorityColumn
                  key={col.id}
                  column={col}
                  tasks={sortedTasks.filter((t) => t.priority === col.id)}
                  onTaskClick={(id) => setActiveTaskId(id)}
                />
              ))}
              <DragOverlay>
                {draggingTask && <PriorityTaskCard task={draggingTask} isDragging />}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center justify-center flex-1 text-center pb-20">
          <AlertCircle className="h-10 w-10 text-destructive/40 mb-3" />
          <p className="font-medium text-sm">Failed to load tasks</p>
          <p className="text-xs text-muted-foreground mt-1">Check the server logs or your network connection.</p>
        </div>
      )}

      {!isLoading && !isError && allTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 text-center pb-20">
          <Flag className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-sm">No active tasks</p>
          <p className="text-xs text-muted-foreground mt-1">
            {filterProjectId
              ? 'No TODO or In Progress tasks in this project.'
              : 'No TODO or In Progress tasks across your projects.'}
          </p>
        </div>
      )}

      {activeTask && (
        <TaskDetailDialog
          taskId={activeTask.id}
          projectId={activeTask.projectId}
          onClose={() => setActiveTaskId(null)}
        />
      )}
    </div>
  )
}

function PriorityColumn({
  column,
  tasks,
  onTaskClick,
}: {
  column: { id: TaskPriority; label: string }
  tasks: GlobalTask[]
  onTaskClick: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div className="w-72 shrink-0 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        {PRIORITY_ICONS[column.id]}
        <span className="text-sm font-medium">{column.label}</span>
        <span className="ml-auto text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {tasks.length}
        </span>
      </div>
      <ScrollArea className="flex-1">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div
            ref={setNodeRef}
            className={cn(
              'flex flex-col gap-2 min-h-[200px] p-2 rounded-lg transition-colors border-2',
              PRIORITY_COLORS[column.id],
              isOver ? 'bg-accent/40' : 'bg-muted/30',
            )}
          >
            {tasks.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">Drop tasks here</p>
            )}
            {tasks.map((task) => (
              <SortablePriorityTaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task.id)}
              />
            ))}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  )
}

function SortablePriorityTaskCard({
  task,
  onClick,
}: {
  task: GlobalTask
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <PriorityTaskCard task={task} onClick={onClick} isDragging={isDragging} />
    </div>
  )
}

function PriorityTaskCard({
  task,
  onClick,
  isDragging = false,
}: {
  task: GlobalTask
  onClick?: () => void
  isDragging?: boolean
}) {
  const projectColor = task.project.color ?? '#888888'

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-card border rounded-lg p-3 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all select-none',
        isDragging && 'shadow-lg opacity-80 rotate-1',
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full truncate max-w-[140px]"
          style={{
            backgroundColor: projectColor + '25',
            color: projectColor,
          }}
        >
          {task.project.name}
        </span>
        <span
          className={cn(
            'text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0',
            STATUS_COLORS[task.status] ?? 'bg-muted text-muted-foreground',
          )}
        >
          {STATUS_LABELS[task.status] ?? task.status}
        </span>
      </div>

      <p className="text-sm font-medium leading-snug line-clamp-2 mb-2">{task.title}</p>

      <div className="flex items-center justify-between text-muted-foreground">
        {task.dueDate ? (
          <span className="flex items-center gap-1 text-[10px]">
            <Calendar className="h-3 w-3" />
            {formatDate(task.dueDate)}
          </span>
        ) : (
          <span />
        )}
        {task.assignees.length > 0 && (
          <div className="flex -space-x-1.5">
            {task.assignees.slice(0, 3).map((u) => (
              <Avatar key={u.id} className="h-5 w-5 border-2 border-card">
                <AvatarFallback className="text-[8px]">{getInitials(u.displayName)}</AvatarFallback>
              </Avatar>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
