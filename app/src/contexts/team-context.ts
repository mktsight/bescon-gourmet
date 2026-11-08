import { createContext, useContext } from 'react'
import type { MyTeam } from '../services/api'

export type TeamStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface TeamContextType {
  teams: MyTeam[]
  currentTeam: MyTeam | null
  status: TeamStatus
  loadError: string | null
  switchTeam: (teamId: string) => void
  createTeam: (name: string, passphrase: string) => Promise<void>
  joinTeam: (teamId: string, passphrase: string) => Promise<void>
  leaveTeam: (teamId: string) => Promise<void>
  refreshTeams: (opts?: { silent?: boolean }) => Promise<void>
  /** 現在のチームの表示情報だけを更新する */
  updateTeamInfo: (partial: Partial<Pick<MyTeam, 'memberCount' | 'name'>>) => void
}

export const TeamContext = createContext<TeamContextType | null>(null)

export function useTeam() {
  const ctx = useContext(TeamContext)
  if (!ctx) throw new Error('useTeam must be used within TeamProvider')
  return ctx
}
