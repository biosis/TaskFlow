import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef } from 'react'
import { toast } from 'sonner'
import {
  Loader2, Trash2, Send, AlertCircle, AlertTriangle, ChevronUp, Minus,
  Check, X, Paperclip, Download, File, Plus, ArrowRightLeft, Archive, ArchiveRestore,
} from 'lucide-react'
import { tasksApi } from '@/api/tasks'
import { projectsApi } from '@/api/projects'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn, getInitials, formatRelative } from '@/lib/utils'
import type { TaskStatus, TaskPriority, Attachment } from '@/types'

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'DONE', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; icon: React.ReactNode }[] = [
  { value: 'URGENT', label: 'Urgent', icon: <AlertCircle className="h-3.5 w-3.5 text-red-500" /> },
  { value: 'HIGH', label: 'High', icon: <AlertTriangle className="h-3.5 w-3.5 text-orange-500" /> },
  { value: 'MEDIUM', label: 'Medium', icon: <ChevronUp className="h-3.5 w-3.5 text-yellow-500" /> },
  { value: 'LOW', label: 'Low', icon: <Minus className="h-3.5 w-3.5 text-green-500" /> },
]

const ACCEPTED_TYPES = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf', '.txt', '.csv',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
].join(',')

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function TaskDetailDialog({
  taskId,
  projectId,
  onClose,
}: {
  taskId: string
  projectId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [descriptionDraft, setDescriptionDraft] = useState<string | undefined>(undefined)
  const [comment, setComment] = useState('')
  const [newSubtask, setNewSubtask] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [moveProjectId, setMoveProjectId] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: task, isLoading } = useQuery({
    queryKey: ['tasks', projectId, taskId],
    queryFn: () => tasksApi.get(taskId),
    enabled: !!taskId,
  })

  const descriptionValue = descriptionDraft ?? (task?.description ?? '')
  const isDescriptionDirty = descriptionDraft !== undefined && descriptionDraft !== (task?.description ?? '')

  const { data: subtasks, isLoading: subtasksLoading } = useQuery({
    queryKey: ['tasks', taskId, 'subtasks'],
    queryFn: () => tasksApi.subtasks.list(taskId),
    enabled: !!taskId,
  })

  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ['tasks', taskId, 'comments'],
    queryFn: () => tasksApi.comments.list(taskId),
    enabled: !!taskId,
  })

  const { data: attachments, isLoading: attachmentsLoading } = useQuery({
    queryKey: ['tasks', taskId, 'attachments'],
    queryFn: () => tasksApi.attachments.list(taskId),
    enabled: !!taskId,
  })

  const updateTask = useMutation({
    mutationFn: (data: Parameters<typeof tasksApi.update>[1]) => tasksApi.update(taskId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      void qc.invalidateQueries({ queryKey: ['tasks', projectId, taskId] })
      setDescriptionDraft(undefined)
      toast.success('Task updated')
    },
    onError: () => toast.error('Failed to update task'),
  })

  const deleteTask = useMutation({
    mutationFn: () => tasksApi.delete(taskId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      toast.success('Task deleted')
      onClose()
    },
    onError: () => toast.error('Failed to delete task'),
  })

  const archiveTask = useMutation({
    mutationFn: () => tasksApi.archive(taskId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      void qc.invalidateQueries({ queryKey: ['tasks', projectId, taskId] })
      toast.success('Tâche archivée')
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? 'Impossible d\'archiver la tâche'),
  })

  const unarchiveTask = useMutation({
    mutationFn: () => tasksApi.unarchive(taskId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      void qc.invalidateQueries({ queryKey: ['tasks', projectId, taskId] })
      toast.success('Tâche désarchivée')
    },
    onError: () => toast.error('Impossible de désarchiver la tâche'),
  })

  const createSubtask = useMutation({
    mutationFn: (title: string) => tasksApi.subtasks.create(projectId, taskId, title),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks', taskId, 'subtasks'] })
      void qc.invalidateQueries({ queryKey: ['tasks', projectId, taskId] })
      setNewSubtask('')
    },
    onError: () => toast.error('Failed to create subtask'),
  })

  const toggleSubtask = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      tasksApi.subtasks.update(id, { status: status === 'DONE' ? 'TODO' : 'DONE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tasks', taskId, 'subtasks'] }),
    onError: () => toast.error('Failed to update subtask'),
  })

  const deleteSubtask = useMutation({
    mutationFn: (id: string) => tasksApi.subtasks.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks', taskId, 'subtasks'] })
      void qc.invalidateQueries({ queryKey: ['tasks', projectId, taskId] })
    },
    onError: () => toast.error('Failed to delete subtask'),
  })

  const addComment = useMutation({
    mutationFn: () => tasksApi.comments.create(taskId, comment),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks', taskId, 'comments'] })
      setComment('')
    },
    onError: () => toast.error('Failed to add comment'),
  })

  const uploadAttachment = useMutation({
    mutationFn: (file: File) =>
      tasksApi.attachments.upload(taskId, file, setUploadProgress),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks', taskId, 'attachments'] })
      setUploadProgress(0)
      toast.success('File attached')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setUploadProgress(0)
      const msg = err.response?.data?.message ?? 'Failed to upload file'
      toast.error(msg)
    },
  })

  const deleteAttachment = useMutation({
    mutationFn: (id: string) => tasksApi.attachments.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks', taskId, 'attachments'] })
      toast.success('Attachment removed')
    },
    onError: () => toast.error('Failed to remove attachment'),
  })

  const { data: projectMembers } = useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => projectsApi.members.list(projectId),
    enabled: !!task,
  })

  const { data: projectLabels } = useQuery({
    queryKey: ['projects', projectId, 'labels'],
    queryFn: () => projectsApi.labels.list(projectId),
    enabled: !!task,
  })

  const { data: allProjectsData } = useInfiniteQuery({
    queryKey: ['projects'],
    queryFn: ({ pageParam }) => projectsApi.list({ cursor: pageParam as string | undefined }),
    getNextPageParam: (last) => last.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!task,
  })
  const allProjects = allProjectsData?.pages.flatMap((p) => p.items) ?? []
  const otherProjects = allProjects.filter((p) => p.id !== projectId)

  const moveTask = useMutation({
    mutationFn: () => tasksApi.move(taskId, moveProjectId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks', projectId] })
      toast.success('Tâche déplacée')
      onClose()
    },
    onError: () => toast.error('Échec du déplacement'),
  })

  const invalidateTask = () => {
    void qc.invalidateQueries({ queryKey: ['tasks', projectId, taskId] })
    void qc.invalidateQueries({ queryKey: ['tasks', projectId] })
  }

  const addAssignee = useMutation({
    mutationFn: (userId: string) => tasksApi.assignees.add(taskId, userId),
    onSuccess: invalidateTask,
    onError: () => toast.error('Failed to add assignee'),
  })

  const removeAssignee = useMutation({
    mutationFn: (userId: string) => tasksApi.assignees.remove(taskId, userId),
    onSuccess: invalidateTask,
    onError: () => toast.error('Failed to remove assignee'),
  })

  const addLabel = useMutation({
    mutationFn: (labelId: string) => tasksApi.labels.add(taskId, labelId),
    onSuccess: invalidateTask,
    onError: () => toast.error('Failed to add label'),
  })

  const removeLabel = useMutation({
    mutationFn: (labelId: string) => tasksApi.labels.remove(taskId, labelId),
    onSuccess: invalidateTask,
    onError: () => toast.error('Failed to remove label'),
  })

  const handleTitleSave = () => {
    if (titleValue.trim() && titleValue !== task?.title) {
      updateTask.mutate({ title: titleValue.trim() })
    }
    setEditingTitle(false)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    uploadAttachment.mutate(file)
  }

  const handleDownload = async (attachment: Attachment) => {
    try {
      const blob = await tasksApi.attachments.download(attachment.id)
      triggerBrowserDownload(blob, attachment.filename)
    } catch {
      toast.error('Failed to download file')
    }
  }

  const isUploading = uploadAttachment.isPending

  return (
    <Dialog open={!!taskId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        {isLoading || !task ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            {task.archivedAt && (
              <div className="flex items-center gap-2 px-6 py-2 bg-amber-50 border-b text-sm text-amber-700 shrink-0">
                <Archive className="h-3.5 w-3.5" />
                <span>Cette tâche est archivée</span>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-amber-700 underline"
                  onClick={() => unarchiveTask.mutate()}
                  disabled={unarchiveTask.isPending}
                >
                  {unarchiveTask.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Désarchiver'}
                </Button>
              </div>
            )}
            <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
              <div className="flex items-start justify-between gap-3">
                {editingTitle ? (
                  <Input
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditingTitle(false) }}
                    autoFocus
                    className="text-lg font-semibold h-auto py-1 px-2"
                  />
                ) : (
                  <DialogTitle
                    className="text-lg font-semibold cursor-text hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 transition-colors"
                    onClick={() => { setTitleValue(task.title); setEditingTitle(true) }}
                  >
                    {task.title}
                  </DialogTitle>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  {!task.archivedAt && ['DONE', 'CANCELLED'].includes(task.status) &&
                    Date.now() - new Date(task.createdAt).getTime() > 14 * 24 * 60 * 60 * 1000 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-amber-600"
                      title="Archiver la tâche"
                      onClick={() => archiveTask.mutate()}
                      disabled={archiveTask.isPending}
                    >
                      {archiveTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteTask.mutate()}
                    disabled={deleteTask.isPending}
                  >
                    {deleteTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <div className="flex flex-1 min-h-0">
              {/* Main content */}
              <ScrollArea className="flex-1 px-6">
                <div className="pb-6 space-y-4">
                  {/* Description */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</p>
                    <Textarea
                      placeholder="Add a description..."
                      value={descriptionValue}
                      onChange={(e) => setDescriptionDraft(e.target.value)}
                      rows={4}
                      className="resize-none text-sm"
                    />
                    {isDescriptionDirty && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          disabled={updateTask.isPending}
                          onClick={() => updateTask.mutate({ description: descriptionDraft })}
                        >
                          {updateTask.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-xs"
                          onClick={() => setDescriptionDraft(undefined)}
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Subtasks */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Sous-tâches {subtasks?.length ? `(${subtasks.length})` : ''}
                    </p>
                    {subtasksLoading ? (
                      <div className="space-y-1.5">
                        <Skeleton className="h-7 w-full" />
                        <Skeleton className="h-7 w-3/4" />
                      </div>
                    ) : !subtasks?.length ? (
                      <p className="text-sm text-muted-foreground">Aucune sous-tâche</p>
                    ) : (
                      <div className="space-y-1">
                        {[...subtasks].sort((a, b) => {
                          if (a.status === 'DONE' && b.status !== 'DONE') return 1
                          if (a.status !== 'DONE' && b.status === 'DONE') return -1
                          return 0
                        }).map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40 group/subtask transition-colors"
                          >
                            <button
                              className={cn(
                                'h-4 w-4 rounded border shrink-0 flex items-center justify-center transition-colors',
                                s.status === 'DONE'
                                  ? 'bg-primary border-primary'
                                  : 'border-muted-foreground/50 hover:border-primary',
                              )}
                              onClick={() => toggleSubtask.mutate({ id: s.id, status: s.status })}
                              disabled={toggleSubtask.isPending}
                            >
                              {s.status === 'DONE' && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                            </button>
                            <span
                              className={cn(
                                'flex-1 text-sm',
                                s.status === 'DONE' && 'line-through text-muted-foreground',
                              )}
                            >
                              {s.title}
                            </span>
                            {s.status !== 'DONE' && (
                              <button
                                className="opacity-0 group-hover/subtask:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                                onClick={() => deleteSubtask.mutate(s.id)}
                                disabled={deleteSubtask.isPending}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Input
                        placeholder="Ajouter une sous-tâche..."
                        value={newSubtask}
                        onChange={(e) => setNewSubtask(e.target.value)}
                        className="h-8 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newSubtask.trim()) {
                            createSubtask.mutate(newSubtask.trim())
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        className="h-8 shrink-0"
                        disabled={!newSubtask.trim() || createSubtask.isPending}
                        onClick={() => createSubtask.mutate(newSubtask.trim())}
                      >
                        {createSubtask.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Attachments */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Attachments {attachments?.length ? `(${attachments.length})` : ''}
                      </p>
                      <label className="cursor-pointer">
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          accept={ACCEPTED_TYPES}
                          onChange={handleFileSelect}
                          disabled={isUploading}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 text-xs pointer-events-none"
                          disabled={isUploading}
                          tabIndex={-1}
                          asChild
                        >
                          <span>
                            {isUploading
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <Paperclip className="h-3 w-3" />}
                            {isUploading ? `${uploadProgress}%` : 'Attach file'}
                          </span>
                        </Button>
                      </label>
                    </div>

                    {attachmentsLoading ? (
                      <div className="space-y-1.5">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : !attachments?.length ? (
                      <p className="text-sm text-muted-foreground">No attachments yet</p>
                    ) : (
                      <div className="space-y-1">
                        {attachments.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-muted/30 hover:bg-muted/60 group transition-colors"
                          >
                            <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{a.filename}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {formatBytes(a.size)} · {formatRelative(a.createdAt)}
                              </p>
                            </div>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                title="Download"
                                onClick={() => void handleDownload(a)}
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                title="Remove"
                                disabled={deleteAttachment.isPending}
                                onClick={() => deleteAttachment.mutate(a.id)}
                              >
                                {deleteAttachment.isPending
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <Trash2 className="h-3 w-3" />}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload progress bar */}
                    {isUploading && (
                      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-200"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Comments */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Comments {comments?.length ? `(${comments.length})` : ''}
                    </p>
                    {commentsLoading ? (
                      <div className="space-y-3">
                        {Array.from({ length: 2 }).map((_, i) => (
                          <div key={i} className="flex gap-2">
                            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                            <Skeleton className="h-16 flex-1 rounded-lg" />
                          </div>
                        ))}
                      </div>
                    ) : comments?.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No comments yet</p>
                    ) : (
                      <div className="space-y-3">
                        {comments?.map((c) => (
                          <div key={c.id} className="flex gap-2.5">
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarFallback className="text-[10px]">{getInitials(c.author.displayName)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium">{c.author.displayName}</span>
                                <span className="text-[10px] text-muted-foreground">{formatRelative(c.createdAt)}</span>
                              </div>
                              <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm">{c.body}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <Textarea
                        placeholder="Write a comment..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={2}
                        className="resize-none text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && comment.trim()) {
                            addComment.mutate()
                          }
                        }}
                      />
                      <Button
                        size="icon"
                        className="h-9 w-9 shrink-0 self-end"
                        disabled={!comment.trim() || addComment.isPending}
                        onClick={() => addComment.mutate()}
                      >
                        {addComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </ScrollArea>

              {/* Sidebar metadata */}
              <div className="w-52 shrink-0 border-l px-4 py-4 space-y-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <Select value={task.status} onValueChange={(v) => updateTask.mutate({ status: v as TaskStatus })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Priority</p>
                  <Select value={task.priority} onValueChange={(v) => updateTask.mutate({ priority: v as TaskPriority })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value} className="text-xs">
                          <span className="flex items-center gap-1.5">{p.icon}{p.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Assignees — interactive */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Assignees</p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5">
                          <Plus className="h-3 w-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-52 p-1.5" align="end">
                        {(() => {
                          const assigned = new Set(task.assignees.map((u) => u.id))
                          const available = (projectMembers ?? []).filter((m) => !assigned.has(m.userId))
                          return available.length === 0 ? (
                            <p className="text-xs text-muted-foreground px-2 py-1.5">All members assigned</p>
                          ) : (
                            available.map((m) => (
                              <button
                                key={m.userId}
                                className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors"
                                onClick={() => addAssignee.mutate(m.userId)}
                                disabled={addAssignee.isPending}
                              >
                                <Avatar className="h-5 w-5 shrink-0">
                                  <AvatarFallback className="text-[8px]">{getInitials(m.user.displayName)}</AvatarFallback>
                                </Avatar>
                                <span className="truncate text-xs">{m.user.displayName}</span>
                              </button>
                            ))
                          )
                        })()}
                      </PopoverContent>
                    </Popover>
                  </div>
                  {task.assignees.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No assignees</p>
                  ) : (
                    <div className="space-y-1">
                      {task.assignees.map((u) => (
                        <div key={u.id} className="flex items-center gap-2 group/assignee">
                          <Avatar className="h-5 w-5 shrink-0">
                            <AvatarFallback className="text-[8px]">{getInitials(u.displayName)}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs flex-1 truncate">{u.displayName}</span>
                          <button
                            className="opacity-0 group-hover/assignee:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            onClick={() => removeAssignee.mutate(u.id)}
                            disabled={removeAssignee.isPending}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Labels — interactive toggle */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Labels</p>
                  {!projectLabels || projectLabels.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No labels in project</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {projectLabels.map((label) => {
                        const isActive = task.labels.some(
                          (l) => l.id === label.id || (l as { labelId?: string }).labelId === label.id,
                        )
                        const isPending = addLabel.isPending || removeLabel.isPending
                        return (
                          <button
                            key={label.id}
                            className={cn(
                              'flex items-center gap-1.5 w-full rounded-md px-2 py-1 text-[11px] font-medium transition-all text-left',
                              isActive
                                ? 'ring-1 ring-inset opacity-100'
                                : 'opacity-50 hover:opacity-80',
                            )}
                            style={
                              isActive
                                ? { backgroundColor: label.color + '25', color: label.color }
                                : { backgroundColor: label.color + '15', color: label.color }
                            }
                            onClick={() => isActive ? removeLabel.mutate(label.id) : addLabel.mutate(label.id)}
                            disabled={isPending}
                          >
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: label.color }}
                            />
                            <span className="flex-1 truncate">{label.name}</span>
                            {isActive && <Check className="h-3 w-3 shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Due date</p>
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      className={cn(
                        'flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring',
                        task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE'
                          ? 'text-destructive'
                          : 'text-foreground',
                      )}
                      value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => updateTask.mutate({ dueDate: e.target.value || null })}
                    />
                    {task.dueDate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => updateTask.mutate({ dueDate: null })}
                        title="Clear due date"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {otherProjects.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Déplacer vers</p>
                    <Select value={moveProjectId} onValueChange={setMoveProjectId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Choisir un projet…" />
                      </SelectTrigger>
                      <SelectContent>
                        {otherProjects.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 gap-1.5 text-xs"
                      disabled={!moveProjectId || moveTask.isPending}
                      onClick={() => moveTask.mutate()}
                    >
                      {moveTask.isPending
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <ArrowRightLeft className="h-3 w-3" />}
                      Déplacer
                    </Button>
                  </div>
                )}

                <Separator />
                <div className="text-[10px] text-muted-foreground space-y-1">
                  <p>Created {formatRelative(task.createdAt)}</p>
                  <p>Updated {formatRelative(task.updatedAt)}</p>
                  {task.movedAt && <p>Moved {formatRelative(task.movedAt)}</p>}
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
