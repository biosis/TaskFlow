import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getInitials } from '@/lib/utils'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

export const Route = createFileRoute('/_app/admin/users/')({
  component: AdminUsers,
})

type StatusFilter = 'active' | 'deleted' | 'all'

function AdminUsers() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('active')

  const handleSearch = (value: string) => {
    setSearch(value)
    clearTimeout((handleSearch as unknown as { timer: ReturnType<typeof setTimeout> }).timer)
    ;(handleSearch as unknown as { timer: ReturnType<typeof setTimeout> }).timer = setTimeout(() => {
      setDebouncedSearch(value)
      setPage(1)
    }, 300)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, debouncedSearch, status],
    queryFn: () => adminApi.listUsers({ page, limit: 20, search: debouncedSearch || undefined, status }),
    staleTime: 30_000,
  })

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou email…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(['active', 'all', 'deleted'] as StatusFilter[]).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? 'default' : 'outline'}
              onClick={() => { setStatus(s); setPage(1) }}
            >
              {s === 'active' ? 'Actifs' : s === 'deleted' ? 'Supprimés' : 'Tous'}
            </Button>
          ))}
        </div>
        {data && (
          <span className="text-sm text-muted-foreground ml-auto">
            {data.total} compte{data.total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Utilisateur</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rôle</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Inscrit le</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Dernière connexion</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              : data?.items.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={u.avatarUrl} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(u.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <Link
                          to="/admin/users/$userId"
                          params={{ userId: u.id }}
                          className="font-medium truncate max-w-[160px] hover:underline"
                        >
                          {u.displayName}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">
                      {u.email}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {u.deletedAt ? (
                        <Badge variant="destructive">Supprimé</Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          Actif
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('fr-FR') : '—'}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Précédent
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Suivant
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}
