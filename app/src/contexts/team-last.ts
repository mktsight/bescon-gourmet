import type { MyTeam } from '../services/api'

/** この端末で最後に選んだチーム。baseAt は選択時点で端末が知っていたサーバーの lastTeamAt */
export type LocalLast = { teamId: string; synced: boolean; baseAt: string | null }

const keyOf = (userId: string) => `bescon.lastTeamId.${userId}`

export function readLocalLast(userId: string): LocalLast | null {
  try {
    const raw = localStorage.getItem(keyOf(userId))
    if (!raw) return null
    const v: unknown = JSON.parse(raw)
    if (!v || typeof v !== 'object') return null
    const o = v as Record<string, unknown>
    if (typeof o.teamId !== 'string' || o.teamId === '') return null
    if (typeof o.synced !== 'boolean') return null
    if (o.baseAt !== null && typeof o.baseAt !== 'string') return null
    return { teamId: o.teamId, synced: o.synced, baseAt: o.baseAt }
  } catch {
    return null
  }
}

export function writeLocalLast(userId: string, value: LocalLast): void {
  try {
    localStorage.setItem(keyOf(userId), JSON.stringify(value))
  } catch {
    // Safari のプライベートモードなどでは保存できないが、動作には影響させない
  }
}

/**
 * 初期チームの決定。優先順位:
 * 1. この端末のサーバー未反映の選択（baseAt がサーバーの lastTeamAt と一致 = その後だれも書いていない）
 * 2. サーバーの lastTeamId  3. 端末の値  4. joinedAt が最も古いチーム  5. なし
 */
export function pickInitialTeam(
  teams: MyTeam[],
  server: { lastTeamId: string | null; lastTeamAt: string | null },
  local: LocalLast | null,
): { team: MyTeam | null; resend: boolean } {
  const find = (id: string | null | undefined) => (id ? teams.find(t => t.teamId === id) : undefined)

  const localTeam = local ? find(local.teamId) : undefined
  if (local && localTeam && !local.synced && local.baseAt === server.lastTeamAt) {
    return { team: localTeam, resend: true }
  }
  const serverTeam = find(server.lastTeamId)
  if (serverTeam) return { team: serverTeam, resend: false }
  if (local && localTeam) return { team: localTeam, resend: !local.synced }

  let oldest: MyTeam | null = null
  for (const t of teams) {
    if (!oldest || t.joinedAt < oldest.joinedAt) oldest = t
  }
  return { team: oldest, resend: false }
}
