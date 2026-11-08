import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useRecord } from './RecordContext'
import { TeamContext, type TeamContextType, type TeamStatus } from './team-context'
import { pickInitialTeam, readLocalLast, writeLocalLast } from './team-last'
import {
  createTeam as apiCreateTeam,
  fetchMyTeams,
  joinTeam as apiJoinTeam,
  leaveTeam as apiLeaveTeam,
  saveLastTeam,
  setNotMemberHandler,
  teamErrorMessage,
  type MyTeam,
} from '../services/api'

const LOCAL_ADD_WINDOW_MS = 30_000
const NOT_MEMBER_THROTTLE_MS = 5_000

type Snapshot = {
  uid: string | null
  teams: MyTeam[]
  currentTeamId: string | null
  status: TeamStatus
  loadError: string | null
}
const emptySnapshot = (uid: string | null): Snapshot => ({
  uid, teams: [], currentTeamId: null, status: uid ? 'loading' : 'idle', loadError: null,
})

const byJoinedAt = (a: MyTeam, b: MyTeam) => (a.joinedAt < b.joinedAt ? -1 : a.joinedAt > b.joinedAt ? 1 : 0)

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { close } = useRecord()
  const userId = user?.userId ?? null

  // 状態は userId ごとのスナップショット。ユーザーが変わると描画時に空へ戻る（effect 内で setState しない）
  const [snap, setSnap] = useState<Snapshot>(() => emptySnapshot(userId))
  const view = useMemo(() => (snap.uid === userId ? snap : emptySnapshot(userId)), [snap, userId])
  const { teams, currentTeamId, status, loadError } = view

  // 変化する値は ref 経由で読み、各コールバックの依存を安定した参照だけにする
  const teamsRef = useRef<MyTeam[]>([])
  const currentIdRef = useRef<string | null>(null)
  const userIdRef = useRef<string | null>(null)
  const genRef = useRef(0)
  const loadedRef = useRef(false)
  const inflightRef = useRef<Promise<void> | null>(null)
  const serverLastAtRef = useRef<string | null>(null)
  const localAddedRef = useRef(new Map<string, number>())
  const saveRef = useRef<{ running: boolean; pending: string | null }>({ running: false, pending: null })
  const notMemberAtRef = useRef(0)

  const update = useCallback((uid: string, patch: Partial<Snapshot>) => {
    setSnap(prev => ({ ...(prev.uid === uid ? prev : emptySnapshot(uid)), ...patch }))
  }, [])
  const setTeams = useCallback((next: MyTeam[]) => {
    teamsRef.current = next
    const uid = userIdRef.current
    if (uid) update(uid, { teams: next })
  }, [update])
  const setCurrent = useCallback((teamId: string | null) => {
    currentIdRef.current = teamId
    const uid = userIdRef.current
    if (uid) update(uid, { currentTeamId: teamId })
  }, [update])

  // 最後に選んだチームの保存。直列化し、実行中に来た呼び出しは最新の1件だけ保留する
  const enqueueSave = useCallback((teamId: string) => {
    const uid = userIdRef.current
    if (!uid) return
    const gen = genRef.current
    const s = saveRef.current
    s.pending = teamId
    if (s.running) return
    s.running = true
    void (async () => {
      try {
        while (s.pending) {
          const tid = s.pending
          s.pending = null
          try {
            const r = await saveLastTeam(tid)
            if (gen !== genRef.current) return
            serverLastAtRef.current = r.lastTeamAt
            const cur = readLocalLast(uid)?.teamId ?? tid
            writeLocalLast(uid, { teamId: cur, synced: cur === tid, baseAt: r.lastTeamAt })
          } catch {
            console.warn('saveLastTeam failed')
          }
        }
      } finally {
        s.running = false
      }
    })()
  }, [])

  // switchTeam と同じ経路: state 更新 + モーダルを閉じる → localStorage へ先行書き込み → 保存
  const commitSelection = useCallback((teamId: string) => {
    const uid = userIdRef.current
    if (!uid) return
    setCurrent(teamId)
    close()
    writeLocalLast(uid, { teamId, synced: false, baseAt: serverLastAtRef.current })
    enqueueSave(teamId)
  }, [close, enqueueSave, setCurrent])

  // 取得の本体。state の更新は応答後だけ（呼び出し側の effect で同期的に state を変えない）
  const runRefresh = useCallback((): Promise<void> => {
    if (inflightRef.current) return inflightRef.current
    const uid = userIdRef.current
    if (!uid) return Promise.resolve()
    const gen = genRef.current
    const isStale = () => gen !== genRef.current || uid !== userIdRef.current
    let self: Promise<void> | undefined
    self = (async () => {
      try {
        const res = await fetchMyTeams()
        if (isStale()) return
        serverLastAtRef.current = res.lastTeamAt

        // GSI の結果整合で直前の参加が欠ける場合に備え、30秒以内にローカルで追加した分を和集合にする
        const now = Date.now()
        for (const [id, at] of localAddedRef.current) {
          if (now - at > LOCAL_ADD_WINDOW_MS) localAddedRef.current.delete(id)
        }
        const serverIds = new Set(res.items.map(t => t.teamId))
        const extra = teamsRef.current.filter(t => localAddedRef.current.has(t.teamId) && !serverIds.has(t.teamId))
        const merged = [...res.items, ...extra].sort(byJoinedAt)
        setTeams(merged)

        const cur = currentIdRef.current
        if (!cur || !merged.some(t => t.teamId === cur)) {
          const server = { lastTeamId: res.lastTeamId, lastTeamAt: res.lastTeamAt }
          const pick = pickInitialTeam(merged, server, readLocalLast(uid))
          if (!pick.team) {
            setCurrent(null)
          } else if (loadedRef.current) {
            // 現在のチームが無くなった（脱退・別端末での脱退など）: 切替と同じ経路
            commitSelection(pick.team.teamId)
          } else {
            setCurrent(pick.team.teamId)
            if (pick.resend) {
              enqueueSave(pick.team.teamId)
            } else if (pick.team.teamId === res.lastTeamId) {
              writeLocalLast(uid, { teamId: pick.team.teamId, synced: true, baseAt: res.lastTeamAt })
            }
          }
        }
        loadedRef.current = true
        update(uid, { loadError: null, status: 'ready' })
      } catch (e) {
        if (isStale()) return
        if (!loadedRef.current) {
          update(uid, { loadError: teamErrorMessage(e), status: 'error' })
        } else {
          console.warn('refreshTeams failed')
        }
      } finally {
        if (inflightRef.current === self) inflightRef.current = null
      }
    })()
    inflightRef.current = self
    return self
  }, [commitSelection, enqueueSave, setCurrent, setTeams, update])

  const refreshTeams = useCallback((opts?: { silent?: boolean }): Promise<void> => {
    const uid = userIdRef.current
    // 初回ロードのやり直し（エラー画面の再読み込み）だけ 'loading' に戻す。silent は status を変えない
    if (uid && !opts?.silent && !loadedRef.current && !inflightRef.current) {
      update(uid, { status: 'loading', loadError: null })
    }
    return runRefresh()
  }, [runRefresh, update])

  // ユーザー確定・変更・ログアウトで内部状態（ref）を初期化し、確定したら初回ロード。
  // 古い応答は連番（genRef）とユーザー ID の照合で捨てる
  useEffect(() => {
    genRef.current += 1
    userIdRef.current = userId
    inflightRef.current = null
    loadedRef.current = false
    serverLastAtRef.current = null
    localAddedRef.current = new Map()
    saveRef.current = { running: false, pending: null }
    teamsRef.current = []
    currentIdRef.current = null
    if (userId) void runRefresh()
  }, [userId, runRefresh])

  // NOT_A_MEMBER を受けたら所属を再取得する（連続して呼ばれないよう 5 秒間は無視）
  useEffect(() => {
    setNotMemberHandler(() => {
      const now = Date.now()
      if (now - notMemberAtRef.current < NOT_MEMBER_THROTTLE_MS) return
      notMemberAtRef.current = now
      void refreshTeams({ silent: true })
    })
    return () => setNotMemberHandler(null)
  }, [refreshTeams])

  const switchTeam = useCallback((teamId: string) => {
    if (!teamsRef.current.some(t => t.teamId === teamId)) return
    commitSelection(teamId)
  }, [commitSelection])

  const addAndSwitch = useCallback((team: MyTeam) => {
    localAddedRef.current.set(team.teamId, Date.now())
    setTeams([...teamsRef.current.filter(t => t.teamId !== team.teamId), team].sort(byJoinedAt))
    commitSelection(team.teamId)
  }, [commitSelection, setTeams])

  const createTeam = useCallback(async (name: string, passphrase: string) => {
    const gen = genRef.current
    const res = await apiCreateTeam(name, passphrase)
    if (gen !== genRef.current) return
    addAndSwitch(res.team)
  }, [addAndSwitch])

  const joinTeam = useCallback(async (teamId: string, passphrase: string) => {
    const gen = genRef.current
    const res = await apiJoinTeam(teamId, passphrase)
    if (gen !== genRef.current) return
    addAndSwitch(res.team)
  }, [addAndSwitch])

  const leaveTeam = useCallback(async (teamId: string) => {
    const gen = genRef.current
    await apiLeaveTeam(teamId)
    if (gen !== genRef.current) return
    localAddedRef.current.delete(teamId)
    const next = teamsRef.current.filter(t => t.teamId !== teamId)
    setTeams(next)
    if (currentIdRef.current === teamId) {
      close()
      const pick = pickInitialTeam(next, { lastTeamId: null, lastTeamAt: null }, null)
      setCurrent(pick.team?.teamId ?? null)
    }
  }, [close, setCurrent, setTeams])

  const updateTeamInfo = useCallback((partial: Partial<Pick<MyTeam, 'memberCount' | 'name'>>) => {
    const cur = currentIdRef.current
    if (!cur) return
    setTeams(teamsRef.current.map(t => (t.teamId === cur ? { ...t, ...partial } : t)))
  }, [setTeams])

  const currentTeam = useMemo(
    () => teams.find(t => t.teamId === currentTeamId) ?? null,
    [teams, currentTeamId],
  )

  const value = useMemo<TeamContextType>(() => ({
    teams, currentTeam, status, loadError,
    switchTeam, createTeam, joinTeam, leaveTeam, refreshTeams, updateTeamInfo,
  }), [teams, currentTeam, status, loadError, switchTeam, createTeam, joinTeam, leaveTeam, refreshTeams, updateTeamInfo])

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>
}
