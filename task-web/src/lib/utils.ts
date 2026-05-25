import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d)
}

export function formatRelative(date: string | Date | undefined | null): string {
  if (!date) return '—'
  const then = new Date(date).getTime()
  if (isNaN(then)) return '—'
  const now = Date.now()
  const diff = now - then
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(date)
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function priorityColor(priority: string): string {
  switch (priority) {
    case 'URGENT': return 'text-red-600 bg-red-50 dark:bg-red-950/30'
    case 'HIGH': return 'text-orange-600 bg-orange-50 dark:bg-orange-950/30'
    case 'MEDIUM': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30'
    case 'LOW': return 'text-green-600 bg-green-50 dark:bg-green-950/30'
    default: return 'text-muted-foreground bg-muted'
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'TODO': return 'text-slate-600 bg-slate-100 dark:bg-slate-800'
    case 'IN_PROGRESS': return 'text-blue-600 bg-blue-50 dark:bg-blue-950/30'
    case 'REVIEW': return 'text-purple-600 bg-purple-50 dark:bg-purple-950/30'
    case 'BLOCKED': return 'text-red-600 bg-red-50 dark:bg-red-950/30'
    case 'DONE': return 'text-green-600 bg-green-50 dark:bg-green-950/30'
    case 'CANCELLED': return 'text-gray-500 bg-gray-100 dark:bg-gray-800'
    default: return 'text-muted-foreground bg-muted'
  }
}
