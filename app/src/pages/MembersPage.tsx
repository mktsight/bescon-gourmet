import { useState, useEffect } from 'react'
import TabBar from '../components/TabBar'
import { getMembers, getMember } from '../services/api'

interface Member {
  userId: string
  name: string
  bio?: string
  iconUrl?: string | null
}

interface MemberDetail {
  userId: string
  name: string
  bio?: string
  recentPosts?: Array<{ exerciseType: string; distance: number; calories: number; createdAt: string }>
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<MemberDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { const r = await getMembers(); setMembers(r.items) } catch {}
    setLoading(false)
  }

  async function handleSelect(userId: string) {
    setDetailLoading(true)
    setSelected({ userId, name: '', recentPosts: [] })
    try { setSelected(await getMember(userId)) } catch {}
    setDetailLoading(false)
  }

  return (
    <div className="min-h-screen bg-app-bg pb-24">
      <header className="bg-app-bg border-b border-sp-border px-5 py-4 sticky top-0 z-10">
        <h1 className="text-xl font-black text-white tracking-tight">メンバー</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {loading ? (
          <div className="text-center py-16 text-sp-muted">読み込み中...</div>
        ) : (
          <div className="space-y-2">
            {members.map(m => (
              <button key={m.userId} onClick={() => handleSelect(m.userId)}
                className="w-full bg-sp-card rounded-2xl border border-sp-border p-4 flex items-center gap-3 hover:border-primary/30 transition-colors text-left">
                <div className="w-12 h-12 rounded-2xl bg-sp-card2 flex items-center justify-center text-lg font-black text-white shrink-0">
                  {(m.name ?? '?').slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-white">{m.name}</div>
                  {m.bio && <div className="text-xs text-sp-muted truncate">{m.bio}</div>}
                </div>
                <span className="text-sp-muted text-xl">›</span>
              </button>
            ))}
          </div>
        )}
      </main>

      {selected && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={() => setSelected(null)}>
          <div className="bg-sp-card w-full max-w-lg rounded-t-3xl p-6 max-h-[70vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-sp-border rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-xl font-black text-primary">
                  {(selected.name ?? '?').slice(0, 1)}
                </div>
                <div>
                  <div className="font-black text-white">{selected.name}</div>
                  {selected.bio && <div className="text-xs text-sp-muted">{selected.bio}</div>}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-sp-muted text-2xl w-8 h-8 flex items-center justify-center rounded-full bg-sp-card2">×</button>
            </div>
            <h3 className="font-black text-sm text-sp-muted uppercase tracking-wide mb-3">最近の活動</h3>
            {detailLoading ? (
              <div className="text-center py-4 text-sp-muted text-sm">読み込み中...</div>
            ) : (selected.recentPosts?.length ?? 0) === 0 ? (
              <div className="text-center py-4 text-sp-muted text-sm">まだ記録がありません</div>
            ) : (
              <div className="space-y-2">
                {selected.recentPosts?.map((p, i) => (
                  <div key={i} className="bg-sp-card2 rounded-2xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{p.exerciseType === 'running' ? '🏃' : '🚶'}</span>
                      <div>
                        <div className="text-sm font-black text-white">{p.distance}km</div>
                        <div className="text-xs text-sp-muted">{new Date(p.createdAt).toLocaleDateString('ja-JP')}</div>
                      </div>
                    </div>
                    <div className="text-accent font-black text-sm">{p.calories}kcal</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <TabBar />
    </div>
  )
}
