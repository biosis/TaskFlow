import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff, Archive, Palette } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuthStore } from '@/stores/auth.store'
import { usersApi } from '@/api/users'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
})

const THEMES = [
  { value: 'light', label: 'Light', description: 'Clean white', bg: 'hsl(220,20%,95%)' },
  { value: 'dark', label: 'Dark', description: 'Deep navy', bg: 'hsl(224,71%,3%)' },
  { value: 'nord', label: 'Nord', description: 'Arctic polar night', bg: 'hsl(220,16%,22%)' },
  { value: 'solarized', label: 'Solarized', description: 'Warm ivory', bg: 'hsl(44,87%,94%)' },
  { value: 'forest', label: 'Forest', description: 'Earthy greens', bg: 'hsl(130,15%,14%)' },
]

function SettingsPage() {
  const { user, setUser, clearAuth } = useAuthStore()
  const { theme, setTheme } = useTheme()

  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '')
  const [archiveThresholdDays, setArchiveThresholdDays] = useState(String(user?.archiveThresholdDays ?? 14))

  const parsedThreshold = parseInt(archiveThresholdDays, 10)
  const thresholdValid = !isNaN(parsedThreshold) && parsedThreshold >= 1 && parsedThreshold <= 365
  const isThresholdDirty = thresholdValid && parsedThreshold !== (user?.archiveThresholdDays ?? 14)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')

  const isProfileDirty =
    displayName.trim() !== (user?.displayName ?? '') ||
    (avatarUrl.trim() || '') !== (user?.avatarUrl ?? '')

  const updateProfile = useMutation({
    mutationFn: () =>
      usersApi.updateMe({
        displayName: displayName.trim() || undefined,
        avatarUrl: avatarUrl.trim() || null,
      }),
    onSuccess: (updated) => {
      setUser(updated)
      toast.success('Profile updated')
    },
    onError: () => toast.error('Failed to update profile'),
  })

  const updateArchiveThreshold = useMutation({
    mutationFn: () => usersApi.updateMe({ archiveThresholdDays: parsedThreshold }),
    onSuccess: (updated) => {
      setUser(updated)
      toast.success('Délai d\'archivage mis à jour')
    },
    onError: () => toast.error('Échec de la mise à jour'),
  })

  const updateTheme = useMutation({
    mutationFn: (v: string | null) => usersApi.updateMe({ theme: v }),
    onSuccess: (updated) => {
      setUser(updated)
      toast.success('Theme saved')
    },
    onError: () => toast.error('Failed to save theme'),
  })

  const handleThemeSelect = (value: string | null) => {
    const prev = theme
    setTheme(value ?? 'system')
    updateTheme.mutate(value, {
      onError: () => setTheme(prev ?? 'system'),
    })
  }

  const changePassword = useMutation({
    mutationFn: () => usersApi.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      toast.success('Password changed — please log in again')
      setCurrentPassword('')
      setNewPassword('')
      clearAuth()
      window.location.href = '/login'
    },
    onError: () => toast.error('Current password is incorrect'),
  })

  const deleteAccount = useMutation({
    mutationFn: () => usersApi.deleteMe(deletePassword),
    onSuccess: () => {
      clearAuth()
      window.location.href = '/login'
    },
    onError: () => toast.error('Incorrect password'),
  })

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account preferences</p>
      </div>

      <div className="p-6 max-w-lg space-y-8">
        {/* Profile */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Profile</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Avatar URL</Label>
              <Input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={user?.email ?? ''} disabled className="opacity-60" />
            </div>
            <Button
              size="sm"
              disabled={!isProfileDirty || updateProfile.isPending}
              onClick={() => updateProfile.mutate()}
            >
              {updateProfile.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Save changes
            </Button>
          </div>
        </section>

        <Separator />

        {/* Archivage */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Archivage</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Archive className="h-3.5 w-3.5" />
                Délai d'archivage automatique (jours)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={archiveThresholdDays}
                  onChange={(e) => setArchiveThresholdDays(e.target.value)}
                  className="w-28"
                />
                <span className="text-xs text-muted-foreground">
                  Les tâches DONE / CANCELLED créées il y a plus de {thresholdValid ? parsedThreshold : '…'} jour{parsedThreshold !== 1 ? 's' : ''} peuvent être archivées.
                </span>
              </div>
              {archiveThresholdDays !== '' && !thresholdValid && (
                <p className="text-xs text-destructive">Valeur entre 1 et 365 requise</p>
              )}
            </div>
            <Button
              size="sm"
              disabled={!isThresholdDirty || updateArchiveThreshold.isPending}
              onClick={() => updateArchiveThreshold.mutate()}
            >
              {updateArchiveThreshold.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Save changes
            </Button>
          </div>
        </section>

        <Separator />

        {/* Appearance */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5" />
            Appearance
          </h2>
          <p className="text-xs text-muted-foreground">Choose a theme. Your choice syncs across devices.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {THEMES.map(({ value, label, description, bg }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleThemeSelect(value)}
                className={cn(
                  'rounded-lg border-2 p-3 text-left transition-colors hover:border-primary/60',
                  theme === value ? 'border-primary' : 'border-border',
                )}
              >
                <div className="h-8 w-full rounded mb-2" style={{ background: bg }} />
                <p className="text-xs font-medium">{label}</p>
                <p className="text-[10px] text-muted-foreground">{description}</p>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            onClick={() => handleThemeSelect(null)}
          >
            Reset to system default
          </button>
        </section>

        <Separator />

        {/* Security */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Security</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Current password</Label>
              <div className="relative">
                <Input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCurrent((v) => !v)}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>New password</Label>
              <div className="relative">
                <Input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNew((v) => !v)}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {newPassword.length > 0 && newPassword.length < 8 && (
                <p className="text-xs text-destructive">At least 8 characters required</p>
              )}
            </div>
            <Button
              size="sm"
              disabled={!currentPassword || newPassword.length < 8 || changePassword.isPending}
              onClick={() => changePassword.mutate()}
            >
              {changePassword.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Change password
            </Button>
          </div>
        </section>

        <Separator />

        {/* Danger zone */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-destructive uppercase tracking-wide">Danger zone</h2>
          <div className="rounded-lg border border-destructive/30 p-4">
            <p className="text-sm font-medium">Delete account</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently delete your account. This action cannot be undone.
            </p>
            <Button
              variant="destructive"
              size="sm"
              className="mt-3"
              onClick={() => setDeleteOpen(true)}
            >
              Delete account
            </Button>
          </div>
        </section>
      </div>

      <Dialog
        open={deleteOpen}
        onOpenChange={(v) => {
          setDeleteOpen(v)
          if (!v) setDeletePassword('')
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This is irreversible. Enter your password to confirm.
          </p>
          <Input
            type="password"
            placeholder="Your password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && deletePassword) deleteAccount.mutate()
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!deletePassword || deleteAccount.isPending}
              onClick={() => deleteAccount.mutate()}
            >
              {deleteAccount.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
