import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchAllTeams, teamErrorMessage, type TeamSummary } from '../services/api'
import { normalizeForSearch, validatePassphrase, validateTeamName } from '../services/team-validation'
import { useTeam } from '../contexts/team-context'

const inputCls = 'w-full bg-sp-card2 border border-sp-border text-white rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition placeholder:text-sp-muted'

/** 合言葉入力欄（表示トグルつき）。ログイン用パスワードとして自動入力・保存されないようにする */
export function PassphraseField({ value, onChange, autoComplete, placeholder = '合言葉（6〜64文字）', autoFocus = false }: {
  value: string
  onChange: (v: string) => void
  autoComplete: 'new-password' | 'off'
  placeholder?: string
  autoFocus?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        name="team-passphrase"
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={64}
        className={`${inputCls} pr-16`}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-sp-muted"
      >
        {show ? '隠す' : '表示'}
      </button>
    </div>
  )
}

export function CreateTeamForm({ onDone }: { onDone: () => void }) {
  const { createTeam } = useTeam()
  const [name, setName] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy.current) return
    const invalid = validateTeamName(name) ?? validatePassphrase(passphrase)
    if (invalid) { setError(invalid); return }
    busy.current = true
    setSubmitting(true)
    setError('')
    try {
      await createTeam(name.normalize('NFC').trim().replace(/\s+/g, ' '), passphrase)
      onDone()
    } catch (err) {
      setError(teamErrorMessage(err))
    }
    busy.current = false
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs text-sp-muted font-semibold uppercase tracking-widest block mb-2">チーム名</label>
        <input
          type="text"
          name="team-name"
          autoComplete="off"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={30}
          placeholder="例：ベスコングルメ部"
          className={inputCls}
        />
      </div>
      <div>
        <label className="text-xs text-sp-muted font-semibold uppercase tracking-widest block mb-2">合言葉</label>
        <PassphraseField value={passphrase} onChange={setPassphrase} autoComplete="new-password" />
        <p className="text-xs text-sp-muted mt-2">8文字以上、推測されにくいものを推奨。メンバーに共有してください</p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-primary text-white rounded-2xl py-4 font-black disabled:opacity-60"
      >
        {submitting ? '作成中...' : 'チームを作成'}
      </button>
    </form>
  )
}

export function JoinTeamPanel({ onDone }: { onDone: () => void }) {
  const { teams, joinTeam } = useTeam()
  const [all, setAll] = useState<TeamSummary[]>([])
  const [truncated, setTruncated] = useState(false)
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [query, setQuery] = useState('')
  const [serverResult, setServerResult] = useState<{ q: string; items: TeamSummary[] } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const searchSeq = useRef(0)

  // パネルを開いたとき一覧を1回だけ取得する
  useEffect(() => {
    let cancelled = false
    fetchAllTeams()
      .then(r => {
        if (cancelled) return
        setAll(r.items)
        setTruncated(r.truncated)
        setListState('ready')
      })
      .catch(() => { if (!cancelled) setListState('error') })
    return () => { cancelled = true }
  }, [])

  const q = query.trim()

  // 一覧が200件を超えているときだけ、デバウンスしてサーバー検索（最適化。絞り込みの正はクライアント側）
  useEffect(() => {
    if (!truncated || !q) return
    const my = ++searchSeq.current
    const timer = setTimeout(() => {
      fetchAllTeams(q)
        .then(r => { if (my === searchSeq.current) setServerResult({ q, items: r.items }) })
        .catch(() => {})
    }, 300)
    return () => clearTimeout(timer)
  }, [truncated, q])

  const joinedIds = useMemo(() => new Set(teams.map(t => t.teamId)), [teams])

  const visible = useMemo(() => {
    if (!q) return all
    if (truncated && serverResult && serverResult.q === q && serverResult.items.length > 0) return serverResult.items
    const nq = normalizeForSearch(q)
    return all.filter(t => normalizeForSearch(t.name).includes(nq))
  }, [all, q, truncated, serverResult])

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (busy.current || !selectedId) return
    const invalid = validatePassphrase(passphrase)
    if (invalid) { setError(invalid); return }
    busy.current = true
    setSubmitting(true)
    setError('')
    try {
      await joinTeam(selectedId, passphrase)
      onDone()
    } catch (err) {
      setError(teamErrorMessage(err))
    }
    busy.current = false
    setSubmitting(false)
  }

  function select(teamId: string) {
    setSelectedId(prev => (prev === teamId ? null : teamId))
    setPassphrase('')
    setError('')
  }

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="チーム名で検索"
        autoComplete="off"
        className={inputCls}
      />
      {listState === 'loading' && <p className="text-center text-sp-muted text-sm py-6">読み込み中...</p>}
      {listState === 'error' && <p className="text-center text-sm text-red-400 py-6">チーム一覧を読み込めませんでした</p>}
      {listState === 'ready' && visible.length === 0 && (
        <p className="text-center text-sp-muted text-sm py-6">該当するチームがありません</p>
      )}
      <div className="space-y-2">
        {visible.map(t => {
          const joined = t.joined === true || joinedIds.has(t.teamId)
          const selected = selectedId === t.teamId
          return (
            <div key={t.teamId} className={`rounded-2xl ${selected ? 'bg-primary/10 border border-primary/20' : 'bg-sp-card2'}`}>
              <button
                type="button"
                disabled={joined}
                onClick={() => select(t.teamId)}
                className="w-full text-left p-4 flex items-center gap-3 disabled:opacity-60"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-black text-white text-sm truncate">{t.name}</div>
                  <div className="text-xs text-sp-muted mt-0.5 truncate">メンバー{t.memberCount}人 ・ 作成者: {t.createdByName}</div>
                </div>
                {joined && <span className="text-[10px] font-black bg-sp-card text-sp-muted rounded-full px-2 py-1 shrink-0">参加中</span>}
              </button>
              {selected && !joined && (
                <form onSubmit={handleJoin} className="px-4 pb-4 space-y-3">
                  <PassphraseField value={passphrase} onChange={setPassphrase} autoComplete="off" placeholder="合言葉" autoFocus />
                  {error && <p className="text-sm text-red-400">{error}</p>}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-primary text-white rounded-2xl py-3 font-black text-sm disabled:opacity-60"
                  >
                    {submitting ? '参加中...' : '参加する'}
                  </button>
                </form>
              )}
            </div>
          )
        })}
      </div>
      {truncated && (
        <p className="text-xs text-sp-muted text-center">チームが多いため一部のみ表示しています。名前で検索して絞り込んでください</p>
      )}
    </div>
  )
}
