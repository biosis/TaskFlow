import { create } from 'zustand'

interface UiState {
  sidebarOpen: boolean
  activeTaskId: string | null
  setSidebarOpen: (v: boolean) => void
  toggleSidebar: () => void
  openTask: (id: string) => void
  closeTask: () => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  activeTaskId: null,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  openTask: (id) => set({ activeTaskId: id }),
  closeTask: () => set({ activeTaskId: null }),
}))
