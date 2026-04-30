'use client'

import { create } from 'zustand'

type Tab = 'search' | 'top10' | 'stats' | 'profile'

interface AppState {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  selectedScammer: any | null
  setSelectedScammer: (scammer: any | null) => void
  isCreateModalOpen: boolean
  setCreateModalOpen: (open: boolean) => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  drunkMode: boolean
  setDrunkMode: (v: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'search',
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectedScammer: null,
  setSelectedScammer: (scammer) => set({ selectedScammer: scammer }),
  isCreateModalOpen: false,
  setCreateModalOpen: (open) => set({ isCreateModalOpen: open }),
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),
  drunkMode: false,
  setDrunkMode: (v) => set({ drunkMode: v }),
}))
