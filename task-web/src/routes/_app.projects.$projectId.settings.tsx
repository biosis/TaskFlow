import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, UserMinus } from 'lucide-react'
import { projectsApi } from '@/api/projects'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, getInitials } from '@/lib/utils'
import type { ProjectRole, ProjectMember, Label as LabelType } from '@/types'

export const Route = createFileRoute('/_app/projects/$projectId/settings')({
  component: ProjectSettings,
})

const ROLE_LABEL: Record<ProjectRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
}

const ROLE_COLOR: Record<ProjectRole, string> = {
  OWNER: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  ADMIN: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  MEMBER: 'bg-secondary text-secondary-foreground',
  VIEWER: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
}

function ProjectSettings() {
  const { projectId } = Route.useParams()
  const { user } = useAuthStore()
  const qc = useQueryClient()

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.get(projectId),
  })

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => projectsApi.members.list(projectId),
  })

  const { data: labels, isLoading: labelsLoading } = useQuery({
    queryKey: ['projects', projectId, 'labels'],
    queryFn: () => projectsApi.labels.list(projectId),
  })

  const myRole = members?.find((m) => m.userId === user?.id)?.role
  const canEdit = myRole === 'OWNER' || myRole === 'ADMIN'
  const isOwner = myRole === 'OWNER'

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b px-6 py-4 shrink-0">
        <h2 className="text-lg font-semibold">Project Settings</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Manage project details, members, and labels</p>
      </div>

      <div className="p-6 max-w-2xl">
        <Tabs defaultValue="general">
          <TabsList className="mb-6">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="labels">Labels</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            {projectLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-8 w-24" />
              </div>
            ) : (
              <GeneralSection
                key={project?.id}
                projectId={projectId}
                name={project?.name ?? ''}
                description={project?.description ?? ''}
                canEdit={canEdit}
                onSaved={() => qc.invalidateQueries({ queryKey: ['projects', projectId] })}
              />
            )}
          </TabsContent>

          <TabsContent value="members">
            <MembersSection
              projectId={projectId}
              members={members ?? []}
              isLoading={membersLoading}
              canEdit={canEdit}
              currentUserId={user?.id ?? ''}
              onChanged={() => qc.invalidateQueries({ queryKey: ['projects', projectId, 'members'] })}
            />
          </TabsContent>

          <TabsContent value="labels">
            <LabelsSection
              projectId={projectId}
              labels={labels ?? []}
              isLoading={labelsLoading}
              canEdit={canEdit}
              onChanged={() => qc.invalidateQueries({ queryKey: ['projects', projectId, 'labels'] })}
            />
          </TabsContent>
        </Tabs>

        {isOwner && (
          <>
            <Separator className="my-8" />
            <DangerSection projectId={projectId} />
          </>
        )}
      </div>
    </div>
  )
}

function GeneralSection({
  projectId,
  name: initialName,
  description: initialDescription,
  canEdit,
  onSaved,
}: {
  projectId: string
  name: string
  description: string
  canEdit: boolean
  onSaved: () => void
}) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)

  const isDirty = name.trim() !== initialName || description.trim() !== initialDescription

  const update = useMutation({
    mutationFn: () =>
      projectsApi.update(projectId, {
        name: name.trim() || undefined,
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Project updated')
      onSaved()
    },
    onError: () => toast.error('Failed to update project'),
  })

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!canEdit}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Project description..."
          rows={3}
          className="resize-none"
          disabled={!canEdit}
        />
      </div>
      {canEdit && (
        <Button
          size="sm"
          disabled={!isDirty || !name.trim() || update.isPending}
          onClick={() => update.mutate()}
        >
          {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          Save changes
        </Button>
      )}
    </div>
  )
}

function MembersSection({
  projectId,
  members,
  isLoading,
  canEdit,
  currentUserId,
  onChanged,
}: {
  projectId: string
  members: ProjectMember[]
  isLoading: boolean
  canEdit: boolean
  currentUserId: string
  onChanged: () => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER')

  const addMember = useMutation({
    mutationFn: () => projectsApi.members.add(projectId, { email, role }),
    onSuccess: () => {
      toast.success('Member added')
      setEmail('')
      setRole('MEMBER')
      onChanged()
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const msg = err.response?.data?.message ?? 'Failed to add member'
      toast.error(msg)
    },
  })

  const updateRole = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: string }) =>
      projectsApi.members.update(projectId, userId, newRole),
    onSuccess: () => { toast.success('Role updated'); onChanged() },
    onError: () => toast.error('Failed to update role'),
  })

  const removeMember = useMutation({
    mutationFn: (userId: string) => projectsApi.members.remove(projectId, userId),
    onSuccess: () => { toast.success('Member removed'); onChanged() },
    onError: () => toast.error('Failed to remove member'),
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {canEdit && (
        <div className="rounded-lg border p-4 space-y-3">
          <p className="text-sm font-medium">Invite member</p>
          <div className="flex gap-2">
            <Input
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && email.trim()) addMember.mutate()
              }}
            />
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="MEMBER">Member</SelectItem>
                <SelectItem value="VIEWER">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!email.trim() || addMember.isPending}
              onClick={() => addMember.mutate()}
            >
              {addMember.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {members.length} member{members.length !== 1 ? 's' : ''}
        </p>
        <div className="space-y-1">
          {members.map((member) => {
            const isCurrentUser = member.userId === currentUserId
            const isOwnerRow = member.role === 'OWNER'
            const canModify = canEdit && !isOwnerRow

            return (
              <div
                key={member.userId}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-[11px]">
                    {getInitials(member.user.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {member.user.displayName}
                    {isCurrentUser && (
                      <span className="text-xs text-muted-foreground ml-1.5">(you)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                </div>
                {canModify ? (
                  <Select
                    value={member.role}
                    onValueChange={(v) => updateRole.mutate({ userId: member.userId, newRole: v })}
                  >
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="MEMBER">Member</SelectItem>
                      <SelectItem value="VIEWER">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span
                    className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      ROLE_COLOR[member.role],
                    )}
                  >
                    {ROLE_LABEL[member.role]}
                  </span>
                )}
                {canModify && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    disabled={removeMember.isPending}
                    onClick={() => removeMember.mutate(member.userId)}
                    title="Remove member"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#6366f1', '#8b5cf6', '#ec4899', '#64748b',
]

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            className={cn(
              'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
              value === c ? 'border-foreground scale-110' : 'border-transparent',
            )}
            style={{ backgroundColor: c }}
            onClick={() => onChange(c)}
          />
        ))}
        <label
          title="Custom color"
          className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/40 hover:border-muted-foreground cursor-pointer flex items-center justify-center overflow-hidden relative"
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
          <span className="text-[8px] text-muted-foreground font-bold leading-none">+</span>
        </label>
      </div>
    </div>
  )
}

function LabelsSection({
  projectId,
  labels,
  isLoading,
  canEdit,
  onChanged,
}: {
  projectId: string
  labels: LabelType[]
  isLoading: boolean
  canEdit: boolean
  onChanged: () => void
}) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6366f1')

  const createLabel = useMutation({
    mutationFn: () => projectsApi.labels.create(projectId, { name: newName.trim(), color: newColor }),
    onSuccess: () => {
      toast.success('Label created')
      setNewName('')
      setNewColor('#6366f1')
      onChanged()
    },
    onError: () => toast.error('Failed to create label'),
  })

  const deleteLabel = useMutation({
    mutationFn: (id: string) => projectsApi.labels.delete(id),
    onSuccess: () => { toast.success('Label deleted'); onChanged() },
    onError: () => toast.error('Failed to delete label'),
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {canEdit && (
        <div className="rounded-lg border p-4 space-y-3">
          <p className="text-sm font-medium">New label</p>
          <ColorPicker value={newColor} onChange={setNewColor} />
          <div className="flex gap-2 items-center">
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium shrink-0 transition-colors"
              style={{ backgroundColor: newColor + '25', color: newColor }}
            >
              {newName || 'Preview'}
            </span>
            <Input
              placeholder="Label name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim()) createLabel.mutate()
              }}
            />
            <Button
              size="sm"
              disabled={!newName.trim() || createLabel.isPending}
              onClick={() => createLabel.mutate()}
            >
              {createLabel.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {labels.length === 0 ? (
        <p className="text-sm text-muted-foreground">No labels yet.</p>
      ) : (
        <div className="space-y-1">
          {labels.map((label) => (
            <LabelRow
              key={label.id}
              label={label}
              canEdit={canEdit}
              onDeleted={() => deleteLabel.mutate(label.id)}
              onSaved={onChanged}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function LabelRow({
  label,
  canEdit,
  onDeleted,
  onSaved,
}: {
  label: LabelType
  canEdit: boolean
  onDeleted: () => void
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(label.name)
  const [color, setColor] = useState(label.color)
  const isDirty = name.trim() !== label.name || color !== label.color

  const update = useMutation({
    mutationFn: () =>
      projectsApi.labels.update(label.id, { name: name.trim() || undefined, color }),
    onSuccess: () => { toast.success('Label updated'); onSaved(); setEditing(false) },
    onError: () => toast.error('Failed to update label'),
  })

  const handleCancel = () => {
    setName(label.name)
    setColor(label.color)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="rounded-lg border p-3 space-y-3">
        <ColorPicker value={color} onChange={setColor} />
        <div className="flex gap-2 items-center">
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium shrink-0 transition-colors"
            style={{ backgroundColor: color + '25', color }}
          >
            {name || 'Preview'}
          </span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-7 flex-1 text-sm"
            autoFocus
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-7 text-xs px-3"
            disabled={!name.trim() || !isDirty || update.isPending}
            onClick={() => update.mutate()}
          >
            {update.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs px-3" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/40 group transition-colors">
      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
      <span
        className="flex-1 text-sm px-2 py-0.5 rounded-full inline-block w-fit cursor-default"
        style={{ backgroundColor: label.color + '25', color: label.color }}
      >
        {label.name}
      </span>
      {canEdit && (
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onDeleted}
            title="Delete label"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}

function DangerSection({ projectId }: { projectId: string }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')

  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.get(projectId),
  })

  const deleteProject = useMutation({
    mutationFn: () => projectsApi.delete(projectId),
    onSuccess: () => {
      toast.success('Project deleted')
      qc.removeQueries({ queryKey: ['projects', projectId] })
      void navigate({ to: '/projects' })
    },
    onError: () => toast.error('Failed to delete project'),
  })

  const confirmText = project?.name ?? ''
  const isConfirmed = confirm === confirmText
  const taskCount = project?._count?.tasks ?? 0
  const hasTasks = taskCount > 0

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-destructive uppercase tracking-wide">Danger zone</h2>
      <div className="rounded-lg border border-destructive/30 p-4">
        <p className="text-sm font-medium">Delete project</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {hasTasks
            ? `Ce projet contient ${taskCount} tâche${taskCount > 1 ? 's' : ''}. Supprimez ou archivez toutes les tâches avant de pouvoir supprimer le projet.`
            : 'Permanently delete this project. This cannot be undone.'}
        </p>
        <Button
          variant="destructive"
          size="sm"
          className="mt-3"
          disabled={hasTasks}
          onClick={() => setOpen(true)}
        >
          Delete project
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirm('') }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Type <strong className="text-foreground">{confirmText}</strong> to confirm deletion.
          </p>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={confirmText}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!isConfirmed || deleteProject.isPending}
              onClick={() => deleteProject.mutate()}
            >
              {deleteProject.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
