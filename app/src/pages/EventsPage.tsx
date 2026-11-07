import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TabBar from '../components/TabBar'
import { fetchEvents, createEvent, type Event } from '../services/api'

const inputCls = 'w-full bg-sp-card2 border-0 text-white rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-sp-muted'
const textareaCls = 'w-full bg-sp-card2 border-0 text-white rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-sp-muted resize-none'

export default function EventsPage() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', date: '', time: '',
    location: '', restaurantName: '', walkingRoute: '', runningRoute: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { const r = await fetchEvents(); setEvents(r.items) } catch {}
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const ev = await createEvent(form)
      setEvents(prev => [ev, ...prev])
      setShowForm(false)
      setForm({ title: '', description: '', date: '', time: '', location: '', restaurantName: '', walkingRoute: '', runningRoute: '' })
    } catch {}
    setSubmitting(false)
  }

  function formatDate(d: string) {
    if (!d) return ''
    const dt = new Date(d)
    return `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}`
  }

  return (
    <div className="min-h-screen bg-app-bg pb-24">
      <header className="bg-app-bg border-b border-sp-border px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-xl font-black text-white tracking-tight">イベント</h1>
        <button onClick={() => setShowForm(true)}
          className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-black hover:bg-primary-dark transition-colors">
          + 作成
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-3">
        {loading ? (
          <div className="text-center py-16 text-sp-muted text-sm">読み込み中...</div>
        ) : events.length === 0 ? (
          <div className="bg-sp-card rounded-3xl border border-sp-border p-10 text-center">
            <div className="text-5xl mb-3">📅</div>
            <p className="text-white font-black">イベントはまだありません</p>
            <p className="text-sp-muted text-sm mt-1">次の集まりを作成しましょう！</p>
          </div>
        ) : events.map(ev => (
          <button key={ev.eventId}
            onClick={() => navigate(`/events/${ev.eventId}`)}
            className="w-full bg-sp-card rounded-3xl border border-sp-border p-5 text-left hover:border-primary/30 transition-colors active:scale-[0.99]">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 mr-4">
                <div className="border-l-4 border-primary pl-3">
                  {ev.date && (
                    <p className="text-primary font-black text-sm">{formatDate(ev.date)}{ev.time ? ` ${ev.time}` : ''}</p>
                  )}
                  <h3 className="font-black text-white text-lg leading-tight">{ev.title}</h3>
                </div>
                {ev.location && <p className="text-xs text-sp-muted mt-2">📍 {ev.location}</p>}
                {ev.restaurantName && <p className="text-xs text-sp-muted">🍽️ {ev.restaurantName}</p>}
              </div>
              <div className="text-right shrink-0">
                <div className="text-3xl font-black text-accent leading-none">{ev.participantCount}</div>
                <div className="text-xs text-sp-muted mt-0.5">参加予定</div>
              </div>
            </div>
            {ev.description && <p className="text-xs text-sp-muted mt-3 line-clamp-2 leading-relaxed">{ev.description}</p>}
          </button>
        ))}
      </main>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-sp-card w-full max-w-lg rounded-t-3xl px-5 pt-5 pb-10 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-sp-border rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-white">イベントを作成</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center text-sp-muted rounded-full bg-sp-card2 text-lg">×</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3.5">
              {[
                { field: 'title', label: 'タイトル', placeholder: '第3回ベスコングルメ部', required: true },
                { field: 'date', label: '日付', placeholder: '2026-12-15', required: true },
                { field: 'time', label: '時間', placeholder: '10:00', required: false },
                { field: 'location', label: '集合場所', placeholder: '新宿駅東口', required: false },
                { field: 'restaurantName', label: 'お店', placeholder: '○○ラーメン', required: false },
              ].map(({ field, label, placeholder, required }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-sp-muted mb-1.5 uppercase tracking-wide">{label}</label>
                  <input
                    type={field === 'date' ? 'date' : 'text'}
                    value={(form as Record<string, string>)[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    required={required}
                    placeholder={placeholder}
                    className={inputCls}
                  />
                </div>
              ))}
              {[
                { field: 'walkingRoute', label: 'ウォーキングコース', placeholder: '○○公園経由...' },
                { field: 'runningRoute', label: 'ランニングコース', placeholder: '○○川沿いを...' },
                { field: 'description', label: '詳細・メモ', placeholder: '今年の忘年会！楽しみましょう' },
              ].map(({ field, label, placeholder }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-sp-muted mb-1.5 uppercase tracking-wide">{label}</label>
                  <textarea
                    value={(form as Record<string, string>)[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    rows={2}
                    placeholder={placeholder}
                    className={textareaCls}
                  />
                </div>
              ))}
              <button type="submit" disabled={submitting}
                className="w-full bg-primary text-white rounded-2xl py-4 font-black transition-opacity disabled:opacity-60 mt-1">
                {submitting ? '作成中...' : 'イベントを作成'}
              </button>
            </form>
          </div>
        </div>
      )}

      <TabBar />
    </div>
  )
}
