import { useEffect, useRef, useState } from 'react'
import TabBar from '../components/TabBar'
import Avatar from '../components/Avatar'
import BottomSheet from '../components/BottomSheet'
import { CreateTeamForm, JoinTeamPanel, PassphraseField } from '../components/TeamForms'
import { useAuth } from '../contexts/AuthContext'
import { useTeam } from '../contexts/team-context'
import { changePassphrase, fetchTeamMembers, teamErrorMessage, type MyTeam, type TeamMember } from '../services/api'
import { validatePassphrase } from '../services/team-validation'

type MembersState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; myRole: 'owner' | 'member'; items: TeamMember[] }

function RoleBadge({ role }: { role: 'owner' | 'member' }) {
  return (
    <span className={`text-[10px] font-black rounded-full px-2 py-0.5 shrink-0 ${role === 'owner' ? 'bg-primary/20 text-primary' : 'bg-sp-card2 text-sp-muted'}`}>
      {role === 'owner' ? 'オーナー' : 'メンバー'}
    </span>
  )
}

function PassphraseChangeForm({ teamId }: { teamId: string }) {
  const [open, setOpen] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const busy = useRef(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy.current) return
    const invalid = validatePassphrase(passphrase)
    if (invalid) { setError(invalid); return }
    busy.current = true
    setSubmitting(true)
    setError('')
    try {
      await changePassphrase(teamId, passphrase)
      setPassphrase('')
      setOpen(false)
      setDone(true)
    } catch (err) {
      setError(teamErrorMessage(err))
    }
    busy.current = false
    setSubmitting(false)
  }

  if (!open) {
    return (
      <div>
        <button onClick={() => { setOpen(true); setDone(false) }} className="text-xs font-semibold text-sp-blue">合言葉を変更</button>
        {done && <span className="ml-3 text-xs text-sp-muted">合言葉を変更しました</span>}
      </div>
    )
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <PassphraseField value={passphrase} onChange={setPassphrase} autoComplete="new-password" placeholder="新しい合言葉（6〜64文字）" autoFocus />
      <p className="text-xs text-sp-muted">8文字以上、推測されにくいものを推奨。既存のメンバーには影響しません</p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => { setOpen(false); setPassphrase(''); setError('') }} className="flex-1 bg-sp-card2 text-sp-muted rounded-2xl py-3 text-sm font-bold">キャンセル</button>
        <button type="submit" disabled={submitting} className="flex-[2] bg-primary text-white rounded-2xl py-3 text-sm font-black disabled:opacity-60">
          {submitting ? '変更中...' : '変更する'}
        </button>
      </div>
    </form>
  )
}

function LeaveButton({ team, memberTotal }: { team: MyTeam; memberTotal: number }) {
  const { leaveTeam } = useTeam()
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const isLast = memberTotal <= 1

  async function handleLeave() {
    if (busy.current) return
    busy.current = true
    setSubmitting(true)
    setError('')
    try {
      await leaveTeam(team.teamId)
    } catch (err) {
      setError(teamErrorMessage(err))
      setConfirming(false)
    }
    busy.current = false
    setSubmitting(false)
  }

  if (isLast) {
    return (
      <div>
        <button disabled className="text-xs font-semibold text-sp-muted opacity-60">チームを抜ける</button>
        <p className="text-xs text-sp-muted mt-1">最後の1人はチームを抜けられません</p>
      </div>
    )
  }
  if (confirming) {
    return (
      <div className="bg-sp-card2 rounded-2xl p-4 space-y-3">
        <p className="text-sm text-white">「{team.name}」を抜けますか？投稿はチームに残り、再参加には合言葉が必要です。</p>
        <div className="flex gap-2">
          <button onClick={() => setConfirming(false)} disabled={submitting} className="flex-1 bg-sp-card text-sp-muted rounded-2xl py-3 text-sm font-bold">キャンセル</button>
          <button onClick={handleLeave} disabled={submitting} className="flex-1 bg-red-500/80 text-white rounded-2xl py-3 text-sm font-black disabled:opacity-60">
            {submitting ? '処理中...' : '抜ける'}
          </button>
        </div>
      </div>
    )
  }
  return (
    <div>
      <button onClick={() => setConfirming(true)} className="text-xs font-semibold text-red-400">チームを抜ける</button>
      {error && <p className="text-sm text-red-400 mt-1">{error}</p>}
    </div>
  )
}

function TeamPageContent({ team }: { team: MyTeam }) {
  const { teams, switchTeam, updateTeamInfo } = useTeam()
  const { user } = useAuth()
  const [members, setMembers] = useState<MembersState>({ status: 'loading' })
  const [sheet, setSheet] = useState<'create' | 'join' | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const teamId = team.teamId
  // cancelled が古い応答を捨てる連番ガードの役目をする
  useEffect(() => {
    let cancelled = false
    fetchTeamMembers(teamId)
      .then(r => {
        if (cancelled) return
        setMembers({ status: 'ready', myRole: r.myRole, items: r.items })
        updateTeamInfo({ memberCount: r.team.memberCount })
      })
      .catch(() => { if (!cancelled) setMembers({ status: 'error' }) })
    return () => { cancelled = true }
  }, [teamId, reloadKey, updateTeamInfo])

  function retry() {
    setMembers({ status: 'loading' })
    setReloadKey(k => k + 1)
  }

  const myRole = members.status === 'ready' ? members.myRole : team.role
  const memberTotal = members.status === 'ready' ? members.items.length : team.memberCount

  return (
    <div className="min-h-screen bg-app-bg pb-28">
      <header className="sticky top-0 z-10 bg-app-bg border-b border-sp-border px-5 py-4">
        <h1 className="text-xl font-black text-white tracking-tight">チーム</h1>
      </header>
      <main className="max-w-lg mx-auto px-4 pt-4 space-y-6">
        {/* 現在のチーム */}
        <section className="bg-sp-card rounded-3xl border border-sp-border p-5 space-y-3" data-testid="current-team-card">
          <div className="text-xl font-black text-white break-words">{team.name}</div>
          <div className="text-xs text-sp-muted">メンバー{team.memberCount}人 ・ 作成者: {team.createdByName}</div>
          {myRole === 'owner' && <PassphraseChangeForm teamId={teamId} />}
          <LeaveButton team={team} memberTotal={memberTotal} />
        </section>

        {/* メンバー */}
        <section>
          <h2 className="pb-2 text-xs font-semibold uppercase tracking-widest text-sp-muted">メンバー</h2>
          {members.status === 'loading' && <div className="text-center text-sp-muted text-sm py-6">読み込み中...</div>}
          {members.status === 'error' && (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-red-400">メンバーを読み込めませんでした</p>
              <button onClick={retry} className="bg-sp-card2 text-white rounded-2xl px-5 py-2 text-sm font-bold">再読み込み</button>
            </div>
          )}
          {members.status === 'ready' && (
            <div className="space-y-2" data-testid="member-list">
              {members.items.map(m => (
                <div key={m.userId} className="bg-sp-card rounded-2xl border border-sp-border p-3 flex items-center gap-3">
                  <Avatar
                    src={m.iconUrl}
                    name={m.name}
                    lazy
                    className="w-12 h-12 rounded-2xl"
                    fallbackClassName="bg-sp-card2 text-lg text-white"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-white truncate">{m.name}</span>
                      {m.userId === user?.userId && <span className="text-[10px] font-semibold text-sp-muted shrink-0">あなた</span>}
                    </div>
                    {m.bio && <div className="text-xs text-sp-muted truncate mt-0.5">{m.bio}</div>}
                  </div>
                  <RoleBadge role={m.role} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* マイチーム */}
        <section>
          <h2 className="pb-2 text-xs font-semibold uppercase tracking-widest text-sp-muted">マイチーム</h2>
          <div className="space-y-2" data-testid="my-teams">
            {teams.map(t => {
              const current = t.teamId === teamId
              return (
                <button
                  key={t.teamId}
                  onClick={() => switchTeam(t.teamId)}
                  className={`w-full text-left rounded-2xl p-4 flex items-center gap-3 ${current ? 'bg-primary/10 border border-primary/20' : 'bg-sp-card border border-sp-border'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-white text-sm truncate">{t.name}</div>
                    <div className="text-xs text-sp-muted mt-0.5">メンバー{t.memberCount}人</div>
                  </div>
                  {current && <span className="text-primary font-black shrink-0">✓</span>}
                </button>
              )
            })}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <button onClick={() => setSheet('create')} className="bg-sp-card border border-sp-border text-white rounded-2xl py-4 text-sm font-black">＋ チームを作成</button>
            <button onClick={() => setSheet('join')} className="bg-sp-card border border-sp-border text-white rounded-2xl py-4 text-sm font-black">🔑 チームに参加</button>
          </div>
        </section>
      </main>

      {sheet === 'create' && (
        <BottomSheet title="チームを作成" onClose={() => setSheet(null)}>
          <CreateTeamForm onDone={() => setSheet(null)} />
        </BottomSheet>
      )}
      {sheet === 'join' && (
        <BottomSheet title="チームに参加" onClose={() => setSheet(null)}>
          <JoinTeamPanel onDone={() => setSheet(null)} />
        </BottomSheet>
      )}
      <TabBar />
    </div>
  )
}

export default function TeamPage() {
  const { currentTeam } = useTeam()
  if (!currentTeam) return null
  return <TeamPageContent team={currentTeam} />
}
