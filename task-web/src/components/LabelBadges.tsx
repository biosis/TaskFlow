import { cn } from '@/lib/utils'
import type { Label } from '@/types'

type RawLabel = Label | { label: Label; labelId?: string; taskId?: string }

function normalize(l: RawLabel): Label {
  if ('name' in l && 'color' in l) return l as Label
  return (l as { label: Label }).label
}

interface LabelBadgesProps {
  labels: RawLabel[]
  max?: number
  variant?: 'pill' | 'dot'
  className?: string
}

export function LabelBadges({ labels, max = 3, variant = 'pill', className }: LabelBadgesProps) {
  if (!labels || labels.length === 0) return null
  const normalized = labels.map(normalize).filter(Boolean)
  if (normalized.length === 0) return null
  const visible = normalized.slice(0, max)
  const overflow = normalized.length - max
  if (variant === 'dot') {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {visible.map((label) => (
          <span
            key={label.id}
            title={label.name}
            className="h-2 w-2 rounded-full ring-1 ring-white/20 shrink-0"
            style={{ backgroundColor: label.color }}
          />
        ))}
        {overflow > 0 && (
          <span className="text-[9px] font-medium text-muted-foreground leading-none">
            +{overflow}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {visible.map((label) => (
        <span
          key={label.id}
          className="inline-flex items-center gap-1 rounded-sm px-1.5 py-px text-[10px] font-medium leading-tight tracking-wide"
          style={{ backgroundColor: label.color + '20', color: label.color }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{ backgroundColor: label.color }}
          />
          {label.name}
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-[10px] font-medium text-muted-foreground">+{overflow}</span>
      )}
    </div>
  )
}
