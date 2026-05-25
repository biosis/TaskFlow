import axios from 'axios'
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
})

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
})

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

let refreshPromise: Promise<string> | null = null

async function doRefresh(): Promise<string> {
  const res = await axios.post<{ accessToken: string }>('/api/v1/auth/refresh', {}, { withCredentials: true })
  return res.data.accessToken
}

api.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    const err = error as { config?: { _retry?: boolean; headers: Record<string, string> }; response?: { status: number } }
    const config = err.config
    if (err.response?.status === 401 && config && !config._retry) {
      config._retry = true
      try {
        if (!refreshPromise) {
          refreshPromise = doRefresh().finally(() => { refreshPromise = null })
        }
        const newToken = await refreshPromise
        setAccessToken(newToken)
        config.headers.Authorization = `Bearer ${newToken}`
        return api(config as unknown as Parameters<typeof api>[0])
      } catch {
        setAccessToken(null)
        queryClient.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export default api
