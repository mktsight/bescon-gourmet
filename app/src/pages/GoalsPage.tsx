import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TabBar from '../components/TabBar'
import { fetchGoals, createGoal, updateGoal, deleteGoal } from '../services/api'
import type { Goal } from '../services/api'

const GOAL_TYPES = [
  { value: 'distance', label: '距離', unit: 'km', icon: '📍' },
  { value: 'duration', label: '時間', unit: '分', icon: '⏱️' },
  { value: 'calories', label: 'カロリー', unit: 'kcal', icon: '🔥' },
  { value: 'count', label: '回数', unit: '回', icon: '📊' },
]

const PERIODS = [
  { value: 'weekly', label: '週間' },
  { value: 'monthly', label: '月間' },
]

function getUnit(type: string) {
  return GOAL_TYPES.find(t => t.value === type)?.unit ?? ''
}

function getIcon(type: string) {
  return GOAL_TYPES.find(t => t.value === type)?.icon ?? '🎯'
}

function ProgressBar({ current, target }: { current: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
  return (
    <div>
      <div className="flex justify-between text-xs text-sp-muted mb-2">
        <span className="font-semibold">{current} / {target}</span>
        <span className="font-black text-white">{pct}%</span>
      </div>
      <div className="h-2 bg-sp-card2 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-accent' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function GoalsPage() {
  const navigate = useNavigate()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'distance', period: 'monthly', targetValue: '' })
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetchGoals()
      setGoals(res.items)
    } catch {}
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.targetValue) return
    setSubmitting(true)
    try {
      const g = await createGoal({ type: form.type, period: form.period, targetValue: Number(form.targetValue) })
      setGoals(prev => [...prev, g])
      setForm({ type: 'distance', period: 'monthly', targetValue: '' })
      setShowForm(false)
    } catch {}
    setSubmitting(false)
  }

  async function handleUpdateProgress(goal: Goal) {
    const v = Number(editValue)
    if (isNaN(v)) return
    try {
      const updated = await updateGoal(goal.goalId, { currentValue: v })
      setGoals(prev => prev.map(g => g.goalId === goal.goalId ? updated : g))
    } catch {}
    setEditingId(null)
  }

  async function handleDelete(goalId: string) {
    if (!confirm('この目標を削除しますか？')) return
    try {
      await deleteGoal(goalId)
      setGoals(prev => prev.filter(g => g.goalId !== goalId))
    } catch {}
  }

  return (
    <div className="min-h-screen bg-app-bg pb-24">
      <header className="bg-app-bg border-b border-sp-border px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/mypage')} className="text-primary font-bold text-sm">← 戻る</button>
          <h1 className="text-xl font-black text-white tracking-tight">目標管理</h1>
        </div>
        <button onClick={() => setShowForm(true)}
          className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-black hover:bg-primary-dark transition-colors">
          + 目標
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-3">
        {loading ? (
          <div className="text-center py-16 text-sp-muted text-sm">読み込み中...</div>
        ) : goals.length === 0 ? (
          <div className="bg-sp-card rounded-3xl border border-sp-border p-10 text-center">
            <div className="text-5xl mb-3">🎯</div>
            <p className="text-white font-black">目標を設定しよう！</p>
            <p className="text-sp-muted text-sm mt-1">運動の目標を設定して、達成度を確認できます</p>
          </div>
        ) : (
          goals.map(g => (
            <div key={g.goalId} className="bg-sp-card rounded-3xl border border-sp-border p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/20 rounded-2xl flex items-center justify-center text-xl">
                    {getIcon(g.type)}
                  </div>
                  <div>
                    <div className="font-black text-sm text-white">
                      {GOAL_TYPES.find(t => t.value === g.type)?.label}
                      <span className="ml-1.5 text-xs font-normal text-sp-muted">
                        {PERIODS.find(p => p.value === g.period)?.label}目標
                      </span>
                    </div>
                    <div className="text-xs text-sp-muted mt-0.5">
                      目標: {g.targetValue} {getUnit(g.type)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { setEditingId(g.goalId); setEditValue(String(g.currentValue)) }}
                    className="text-xs text-primary bg-primary/20 rounded-xl px-2.5 py-1 font-bold"
                  >
                    更新
                  </button>
                  <button
                    onClick={() => handleDelete(g.goalId)}
                    className="text-xs text-red-400 bg-red-900/30 rounded-xl px-2.5 py-1 font-bold"
                  >
                    削除
                  </button>
                </div>
              </div>

              {editingId === g.goalId ? (
                <div className="mb-4 space-y-2">
                  <div className="flex gap-1.5">
                    {(g.type === 'count' ? [1, 3, 5] : [1, 5, 10]).map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setEditValue(v => String(Math.max(0, Number(v) + n)))}
                        className="bg-sp-card2 text-white text-xs font-bold rounded-xl px-3 py-1.5"
                      >
                        +{n}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      className="flex-1 bg-sp-card2 border-0 text-white rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button onClick={() => handleUpdateProgress(g)} className="bg-primary text-white text-sm rounded-2xl px-4 font-black">保存</button>
                    <button onClick={() => setEditingId(null)} className="text-sp-muted text-sm bg-sp-card2 rounded-2xl px-3">×</button>
                  </div>
                </div>
              ) : null}

              <ProgressBar current={g.currentValue} target={g.targetValue} />

              {g.currentValue >= g.targetValue && g.targetValue > 0 && (
                <div className="mt-3 bg-accent/20 border border-accent/30 rounded-2xl py-2 text-center">
                  <span className="text-sm font-black text-accent">🎉 達成！おめでとう</span>
                </div>
              )}
            </div>
          ))
        )}
      </main>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-sp-card w-full max-w-lg rounded-t-3xl px-5 pt-5 pb-10" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-sp-border rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-white">目標を設定する</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center text-sp-muted rounded-full bg-sp-card2 text-lg">×</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-sp-muted mb-2 uppercase tracking-wide">種類</label>
                <div className="grid grid-cols-2 gap-2">
                  {GOAL_TYPES.map(t => (
                    <button key={t.value} type="button"
                      onClick={() => setForm(f => ({ ...f, type: t.value }))}
                      className={`py-2.5 rounded-2xl text-sm font-black transition-all ${
                        form.type === t.value ? 'bg-primary text-white' : 'bg-sp-card2 text-sp-muted border border-sp-border'
                      }`}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-sp-muted mb-2 uppercase tracking-wide">期間</label>
                <div className="grid grid-cols-2 gap-2">
                  {PERIODS.map(p => (
                    <button key={p.value} type="button"
                      onClick={() => setForm(f => ({ ...f, period: p.value }))}
                      className={`py-2.5 rounded-2xl text-sm font-black transition-all ${
                        form.period === p.value ? 'bg-primary text-white' : 'bg-sp-card2 text-sp-muted border border-sp-border'
                      }`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-sp-muted mb-1.5 uppercase tracking-wide">
                  目標値 ({getUnit(form.type)})
                </label>
                <input type="number" min="1" value={form.targetValue}
                  onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))}
                  className="w-full bg-sp-card2 border-0 text-white rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-sp-muted"
                  placeholder="100" required />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full bg-primary text-white rounded-2xl py-4 font-black transition-opacity disabled:opacity-60">
                {submitting ? '作成中...' : '目標を設定する'}
              </button>
            </form>
          </div>
        </div>
      )}

      <TabBar />
    </div>
  )
}
