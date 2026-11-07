import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import TabBar from '../components/TabBar'
import { fetchEvent, joinEvent, leaveEvent, type Event } from '../services/api'

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [exType, setExType] = useState<'walking' | 'running'>('walking')
  const [showJoinModal, setShowJoinModal] = useState(false)

  useEffect(() => { if (id) load(id) }, [id])

  async function load(eventId: string) {
    setLoading(true)
    try { setEvent(await fetchEvent(eventId)) } catch {}
    setLoading(false)
  }

  async function handleJoin() {
    if (!id) return
    setJoining(true)
    try {
      const r = await joinEvent(id, exType)
      setEvent(prev => prev ? { ...prev, joinedByMe: true, participantCount: r.participantCount, myExerciseType: exType } : prev)
      setShowJoinModal(false)
    } catch {}
    setJoining(false)
  }

  async function handleLeave() {
    if (!id) return
    setJoining(true)
    try {
      const r = await leaveEvent(id)
      setEvent(prev => prev ? { ...prev, joinedByMe: false, participantCount: r.participantCount } : prev)
    } catch {}
    setJoining(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center">
      <div className="text-sp-muted text-sm">読み込み中...</div>
    </div>
  )

  if (!event) return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center">
      <div className="text-sp-muted text-sm">イベントが見つかりません</div>
    </div>
  )

  const walkers = event.participants?.filter(p => p.exerciseType === 'walking') ?? []
  const runners = event.participants?.filter(p => p.exerciseType === 'running') ?? []

  return (
    <div className="min-h-screen bg-app-bg pb-24">
      <header className="bg-app-bg border-b border-sp-border px-5 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate('/events')} className="text-primary font-bold text-sm">← 戻る</button>
        <h1 className="text-sm font-black text-white flex-1 truncate">{event.title}</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-3">
        <div className="bg-sp-card rounded-3xl border border-sp-border p-5 space-y-3">
          {event.date && (
            <div className="flex items-center gap-2.5 text-sm">
              <span className="text-base">📅</span>
              <span className="font-black text-white">{event.date}{event.time ? ` ${event.time}` : ''}</span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-2.5 text-sm text-sp-muted">
              <span className="text-base">📍</span><span>{event.location}</span>
            </div>
          )}
          {event.restaurantName && (
            <div className="flex items-center gap-2.5 text-sm text-sp-muted">
              <span className="text-base">🍽️</span><span>{event.restaurantName}</span>
            </div>
          )}
          {event.description && (
            <p className="text-sm text-sp-muted leading-relaxed pt-3 border-t border-sp-border">{event.description}</p>
          )}
        </div>

        {(event.walkingRoute || event.runningRoute) && (
          <div className="bg-sp-card rounded-3xl border border-sp-border p-5 space-y-3">
            <h3 className="font-black text-white text-sm">コース情報</h3>
            {event.walkingRoute && (
              <div className="bg-sp-card2 rounded-2xl p-3.5">
                <div className="text-xs font-bold text-sp-blue uppercase tracking-wide mb-1.5">🚶 ウォーキングコース</div>
                <p className="text-sm text-sp-muted">{event.walkingRoute}</p>
              </div>
            )}
            {event.runningRoute && (
              <div className="bg-sp-card2 rounded-2xl p-3.5">
                <div className="text-xs font-bold text-primary uppercase tracking-wide mb-1.5">🏃 ランニングコース</div>
                <p className="text-sm text-sp-muted">{event.runningRoute}</p>
              </div>
            )}
          </div>
        )}

        <div className="bg-sp-card rounded-3xl border border-sp-border p-5">
          <h3 className="font-black text-white mb-4">
            参加者 <span className="text-primary">{event.participantCount}</span>名
          </h3>
          {walkers.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-bold text-sp-blue uppercase tracking-wide mb-2">🚶 ウォーキング組 ({walkers.length}名)</div>
              <div className="flex flex-wrap gap-1.5">
                {walkers.map(p => (
                  <span key={p.userId} className="bg-sp-blue/20 text-sp-blue text-xs rounded-full px-3 py-1.5 font-semibold">{p.userName}</span>
                ))}
              </div>
            </div>
          )}
          {runners.length > 0 && (
            <div>
              <div className="text-xs font-bold text-primary uppercase tracking-wide mb-2">🏃 ランニング組 ({runners.length}名)</div>
              <div className="flex flex-wrap gap-1.5">
                {runners.map(p => (
                  <span key={p.userId} className="bg-primary/20 text-primary text-xs rounded-full px-3 py-1.5 font-semibold">{p.userName}</span>
                ))}
              </div>
            </div>
          )}
          {event.participantCount === 0 && (
            <p className="text-sm text-sp-muted text-center py-3">まだ参加者がいません。最初に参加しましょう！</p>
          )}
        </div>

        {event.joinedByMe ? (
          <button onClick={handleLeave} disabled={joining}
            className="w-full bg-sp-card2 text-sp-muted border border-sp-border rounded-2xl py-4 font-bold text-sm transition-opacity disabled:opacity-60">
            {joining ? '...' : '参加をキャンセルする'}
          </button>
        ) : (
          <button onClick={() => setShowJoinModal(true)}
            className="w-full bg-primary text-white rounded-2xl py-4 font-black text-lg shadow-lg shadow-primary/30">
            🙋 参加する
          </button>
        )}
      </main>

      {showJoinModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={() => setShowJoinModal(false)}>
          <div className="bg-sp-card w-full max-w-lg rounded-t-3xl px-5 pt-5 pb-10" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-sp-border rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-white">どちらで参加しますか？</h2>
              <button onClick={() => setShowJoinModal(false)} className="w-8 h-8 flex items-center justify-center text-sp-muted rounded-full bg-sp-card2 text-lg">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(['walking', 'running'] as const).map(t => (
                <button key={t} onClick={() => setExType(t)}
                  className={`py-4 rounded-2xl font-black text-sm transition-all ${exType === t ? 'bg-primary text-white' : 'bg-sp-card2 text-sp-muted border border-sp-border'}`}>
                  {t === 'walking' ? '🚶 ウォーキング' : '🏃 ランニング'}
                </button>
              ))}
            </div>
            <button onClick={handleJoin} disabled={joining}
              className="w-full bg-primary text-white rounded-2xl py-4 font-black transition-opacity disabled:opacity-60">
              {joining ? '参加中...' : '参加する'}
            </button>
          </div>
        </div>
      )}

      <TabBar />
    </div>
  )
}
