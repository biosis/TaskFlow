import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { ClipboardList, ChevronLeft, ChevronRight, Copy, Check, Loader2, FileDown } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { useAuthStore } from '@/stores/auth.store'
import { projectsApi } from '@/api/projects'
import { tasksApi } from '@/api/tasks'
import { Button } from '@/components/ui/button'
import { cn, statusColor, priorityColor } from '@/lib/utils'
import type { Task, TaskStatus } from '@/types'

export const Route = createFileRoute('/_app/daily-report')({
  component: DailyReportPage,
})

const STATUS_LABEL: Record<TaskStatus, string> = {
  DONE: 'Terminé',
  IN_PROGRESS: 'En cours',
  REVIEW: 'En révision',
  BLOCKED: 'Bloqué',
  TODO: 'À faire',
  CANCELLED: 'Annulé',
}

const STATUS_ORDER: TaskStatus[] = ['DONE', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'TODO', 'CANCELLED']

const PRIORITY_LABEL: Record<string, string> = {
  URGENT: 'Urgent',
  HIGH: 'Haute',
  MEDIUM: 'Moyenne',
  LOW: 'Basse',
}

function dayBounds(d: Date) {
  const start = new Date(d)
  start.setHours(0, 0, 0, 0)
  const end = new Date(d)
  end.setHours(23, 59, 59, 999)
  return { start: start.getTime(), end: end.getTime() }
}

function formatDay(d: Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

function isToday(d: Date) {
  const { start, end } = dayBounds(new Date())
  const t = d.getTime()
  return t >= start && t <= end
}

function DailyReportPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [date, setDate] = useState(() => new Date())
  const [copied, setCopied] = useState(false)

  const { start: dayStart, end: dayEnd } = useMemo(() => dayBounds(date), [date])
  const todaySelected = isToday(date)

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', 'list-all'],
    queryFn: () => projectsApi.list(),
    staleTime: 5 * 60_000,
  })
  const projects = projectsData?.items ?? []

  const taskQueries = useQueries({
    queries: projects.map((project) => ({
      queryKey: ['tasks', project.id, 'daily', user?.id],
      queryFn: () =>
        tasksApi.list(project.id, {
          sort: 'movedAt',
          limit: 100,
        }),
      staleTime: 60_000,
    })),
  })

  const isLoading = projectsLoading || taskQueries.some((q) => q.isLoading && q.fetchStatus !== 'idle')

  const ACTIVE_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED']

  const isRelevantOnDay = (task: Task) => {
    // Active tasks always appear on today's report
    if (todaySelected && ACTIVE_STATUSES.includes(task.status)) return true
    // Tasks completed, created, or moved on the selected day
    const updated = new Date(task.updatedAt).getTime()
    const created = new Date(task.createdAt).getTime()
    const moved = task.movedAt ? new Date(task.movedAt).getTime() : null
    return (
      (updated >= dayStart && updated <= dayEnd) ||
      (created >= dayStart && created <= dayEnd) ||
      (moved !== null && moved >= dayStart && moved <= dayEnd)
    )
  }

  const tasksByStatus = useMemo(() => {
    const grouped: Partial<Record<TaskStatus, Array<{ task: Task; projectName: string }>>> = {}
    projects.forEach((project, i) => {
      const items = (taskQueries[i]?.data?.items ?? []).filter((t) => !t.parentId)
      for (const task of items) {
        if (!isRelevantOnDay(task)) continue
        const s = task.status
        if (!grouped[s]) grouped[s] = []
        grouped[s]!.push({ task, projectName: project.name })
      }
    })
    return grouped
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, taskQueries, dayStart, dayEnd, todaySelected])

  const totalTasks = Object.values(tasksByStatus).reduce((n, arr) => n + (arr?.length ?? 0), 0)

  const goToPrev = () =>
    setDate((d) => {
      const n = new Date(d)
      n.setDate(n.getDate() - 1)
      return n
    })

  const goToNext = () =>
    setDate((d) => {
      const n = new Date(d)
      n.setDate(n.getDate() + 1)
      return n
    })

  const exportPdf = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const margin = 20
    const contentW = pageW - margin * 2
    let y = margin

    const STATUS_COLORS_RGB: Record<TaskStatus, [number, number, number]> = {
      DONE:        [22, 163, 74],
      IN_PROGRESS: [37, 99, 235],
      REVIEW:      [147, 51, 234],
      BLOCKED:     [220, 38, 38],
      TODO:        [100, 116, 139],
      CANCELLED:   [107, 114, 128],
    }
    const PRIORITY_COLORS_RGB: Record<string, [number, number, number]> = {
      URGENT: [220, 38, 38],
      HIGH:   [234, 88, 12],
      MEDIUM: [202, 138, 4],
      LOW:    [22, 163, 74],
    }

    const checkPage = (needed: number) => {
      if (y + needed > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage()
        y = margin
      }
    }

    // Title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(17, 24, 39)
    doc.text('Daily Report', margin, y)
    y += 7

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128)
    doc.text(formatDay(date), margin, y)
    y += 6

    // Separator
    doc.setDrawColor(229, 231, 235)
    doc.setLineWidth(0.4)
    doc.line(margin, y, pageW - margin, y)
    y += 8

    if (totalTasks === 0) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(10)
      doc.setTextColor(156, 163, 175)
      doc.text('Aucune activité ce jour.', margin, y)
    } else {
      for (const status of STATUS_ORDER) {
        const items = tasksByStatus[status]
        if (!items?.length) continue

        checkPage(14)

        // Section header
        const [sr, sg, sb] = STATUS_COLORS_RGB[status]
        doc.setFillColor(sr, sg, sb)
        doc.roundedRect(margin, y - 4, 2.5, 6, 0.5, 0.5, 'F')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(sr, sg, sb)
        doc.text(STATUS_LABEL[status], margin + 5, y)

        doc.setFont('helvetica', 'normal')
        doc.setTextColor(156, 163, 175)
        doc.text(`${items.length} tâche${items.length > 1 ? 's' : ''}`, margin + 5 + doc.getTextWidth(STATUS_LABEL[status]) + 3, y)
        y += 7

        // Task rows
        for (const { task, projectName } of items) {
          checkPage(10)

          doc.setFillColor(249, 250, 251)
          doc.roundedRect(margin, y - 4, contentW, 9, 1, 1, 'F')
          doc.setDrawColor(229, 231, 235)
          doc.setLineWidth(0.2)
          doc.roundedRect(margin, y - 4, contentW, 9, 1, 1, 'S')

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(9)
          doc.setTextColor(17, 24, 39)
          const titleMaxW = contentW - 45
          const titleLines = doc.splitTextToSize(task.title, titleMaxW)
          doc.text(titleLines[0], margin + 3, y)

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(156, 163, 175)
          doc.text(projectName, margin + 3 + doc.getTextWidth(titleLines[0]) + 2, y)

          // Priority badge
          const [pr, pg, pb] = PRIORITY_COLORS_RGB[task.priority] ?? [107, 114, 128]
          const priorityLabel = PRIORITY_LABEL[task.priority] ?? task.priority
          const badgeW = doc.getTextWidth(priorityLabel) + 4
          const badgeX = margin + contentW - badgeW - 3
          doc.setFillColor(pr, pg, pb)
          doc.setGState(doc.GState({ opacity: 0.12 }))
          doc.roundedRect(badgeX, y - 3, badgeW, 5, 1, 1, 'F')
          doc.setGState(doc.GState({ opacity: 1 }))
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(7.5)
          doc.setTextColor(pr, pg, pb)
          doc.text(priorityLabel, badgeX + 2, y)

          y += 9
        }
        y += 4
      }
    }

    const slug = formatDay(date).replace(/\s+/g, '-')
    doc.save(`daily-report-${slug}.pdf`)
  }

  const copyReport = () => {
    const lines: string[] = [`Daily Report — ${formatDay(date)}`, '']
    for (const status of STATUS_ORDER) {
      const items = tasksByStatus[status]
      if (!items?.length) continue
      lines.push(`### ${STATUS_LABEL[status]}`)
      for (const { task, projectName } of items) {
        lines.push(`- [${projectName}] ${task.title}`)
      }
      lines.push('')
    }
    if (totalTasks === 0) lines.push('Aucune activité ce jour.')
    void navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b px-6 py-4 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Daily Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Résumé de vos activités du jour</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={copyReport}
            disabled={isLoading || totalTasks === 0}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copié !' : 'Copier'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={exportPdf}
            disabled={isLoading || totalTasks === 0}
          >
            <FileDown className="h-4 w-4" />
            Exporter PDF
          </Button>
        </div>
      </div>

      {/* Date navigation */}
      <div className="px-6 py-3 border-b flex items-center gap-2 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium capitalize min-w-[240px] text-center">
          {todaySelected && "Aujourd'hui — "}
          {formatDay(date)}
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={todaySelected} onClick={goToNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!todaySelected && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground ml-1"
            onClick={() => setDate(new Date())}
          >
            Aujourd'hui
          </Button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : totalTasks === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-medium">Aucune activité</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Aucune tâche assignée modifiée ou créée ce jour.
            </p>
          </div>
        ) : (
          <div className="space-y-6 max-w-2xl">
            {STATUS_ORDER.map((status) => {
              const items = tasksByStatus[status]
              if (!items?.length) return null
              return (
                <section key={status}>
                  <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex px-2 py-0.5 rounded text-xs font-medium',
                        statusColor(status),
                      )}
                    >
                      {STATUS_LABEL[status]}
                    </span>
                    <span className="text-muted-foreground font-normal">
                      {items.length} tâche{items.length > 1 ? 's' : ''}
                    </span>
                  </h2>
                  <div className="space-y-1.5">
                    {items.map(({ task, projectName }) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm bg-card hover:bg-accent/30 transition-colors cursor-pointer"
                        onClick={() => void navigate({ to: '/projects/$projectId', params: { projectId: task.projectId } })}
                      >
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{task.title}</span>
                          <span className="text-xs text-muted-foreground ml-2">{projectName}</span>
                        </div>
                        <span
                          className={cn(
                            'text-xs px-1.5 py-0.5 rounded font-medium shrink-0',
                            priorityColor(task.priority),
                          )}
                        >
                          {PRIORITY_LABEL[task.priority] ?? task.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
