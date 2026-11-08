import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import TabBar from '../components/TabBar'
import { useTeam } from '../contexts/team-context'
import Map, { type MapMarker } from '../components/Map'
import { searchPlaces, aiSuggest, createPost, type Place } from '../services/api'
import { calculateCalories, getFoodExample } from '../services/calories'

type Mode = 'restaurant' | 'exercise'

const inputCls = 'w-full bg-sp-card border border-sp-border text-white rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-transparent placeholder:text-sp-muted'

export default function GourmetPage() {
  const { user } = useAuth()
  const teamId = useTeam().currentTeam!.teamId
  const [mode, setMode] = useState<Mode>('restaurant')

  const [searchQuery, setSearchQuery] = useState('')
  const [places, setPlaces] = useState<Place[]>([])
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  const [exerciseType, setExerciseType] = useState('running')
  const [distance, setDistance] = useState('5')
  const [aiText, setAiText] = useState('')

  const [exType, setExType] = useState('running')
  const [exDistance, setExDistance] = useState('5')
  const [exDuration, setExDuration] = useState('30')
  const [exPlaces, setExPlaces] = useState<Place[]>([])
  const [exSelected, setExSelected] = useState<Place | null>(null)
  const [exAiText, setExAiText] = useState('')
  const [exSearchQuery, setExSearchQuery] = useState('')

  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shared, setShared] = useState(false)
  const [error, setError] = useState('')

  const mapMarkers: MapMarker[] = selectedPlace
    ? [{ lat: selectedPlace.lat, lng: selectedPlace.lng, label: selectedPlace.name }]
    : []

  const exMapMarkers: MapMarker[] = exPlaces.map(p => ({ lat: p.lat, lng: p.lng, label: p.name }))

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await searchPlaces(searchQuery)
      setPlaces(res.items)
      if (res.items.length === 0) setError('検索結果が見つかりませんでした')
    } catch {
      setError('検索に失敗しました')
    }
    setLoading(false)
  }

  async function handleAISuggest() {
    if (!selectedPlace) return
    setAiLoading(true)
    setAiText('')
    try {
      const res = await aiSuggest({
        mode: 'restaurant',
        restaurant: { name: selectedPlace.name, address: selectedPlace.address },
        exerciseType,
        distance: Number(distance),
      })
      setAiText(res.suggestion)
    } catch {
      setAiText('提案の生成に失敗しました')
    }
    setAiLoading(false)
  }

  async function handleShare() {
    if (!selectedPlace) return
    setSharing(true)
    try {
      await createPost(teamId, {
        exerciseType,
        distance: Number(distance),
        duration: 0,
        memo: `🍽️ ${selectedPlace.name}へ${exerciseType === 'running' ? 'ランニング' : 'ウォーキング'}！\n${aiText ? aiText.slice(0, 100) : ''}`,
      })
      setShared(true)
      setTimeout(() => setShared(false), 3000)
    } catch {}
    setSharing(false)
  }

  const previewCalories = exDuration
    ? calculateCalories(exType, Number(exDuration), user?.gender ?? 'other', user?.ageGroup ?? '30s')
    : 0

  async function handleExAISuggest() {
    setAiLoading(true)
    setExAiText('')
    try {
      const res = await aiSuggest({
        mode: 'exercise',
        exerciseType: exType,
        distance: Number(exDistance),
        duration: Number(exDuration),
      })
      setExAiText(res.suggestion)
      const firstLine = res.suggestion.split('\n')[0].replace(/[・:：]/g, '').trim().slice(0, 15)
      setExSearchQuery(firstLine)
    } catch {
      setExAiText('提案の生成に失敗しました')
    }
    setAiLoading(false)
  }

  async function handleExSearch() {
    if (!exSearchQuery.trim()) return
    setLoading(true)
    try {
      const res = await searchPlaces(exSearchQuery)
      setExPlaces(res.items)
    } catch {}
    setLoading(false)
  }

  async function handleExShare() {
    if (!exSelected) return
    setSharing(true)
    try {
      await createPost(teamId, {
        exerciseType: exType,
        distance: Number(exDistance),
        duration: Number(exDuration),
        memo: `🍽️ ${exSelected.name}でご褒美グルメ！${getFoodExample(previewCalories)}\n${exAiText ? exAiText.slice(0, 80) : ''}`,
      })
      setShared(true)
      setTimeout(() => setShared(false), 3000)
    } catch {}
    setSharing(false)
  }

  return (
    <div className="min-h-screen bg-app-bg pb-24">
      <header className="bg-app-bg border-b border-sp-border px-5 py-4 sticky top-0 z-10">
        <h1 className="text-xl font-black text-white tracking-tight">グルメ×コース</h1>
      </header>

      <div className="bg-sp-card border-b border-sp-border px-5 py-3">
        <div className="flex gap-1 max-w-lg mx-auto bg-sp-card2 rounded-2xl p-1">
          {(['restaurant', 'exercise'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${
                mode === m ? 'bg-sp-card text-white' : 'text-sp-muted'
              }`}>
              {m === 'restaurant' ? '🏪 お店起点' : '🏃 運動起点'}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-3">
        {shared && (
          <div className="bg-accent/20 border border-accent/30 text-accent font-black text-sm rounded-2xl p-4 text-center">
            🎉 タイムラインに共有しました！
          </div>
        )}

        {mode === 'restaurant' && (
          <>
            <div className="bg-sp-card rounded-3xl border border-sp-border p-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-sp-muted">お店・エリアを検索</p>
              <div className="flex gap-2">
                <input type="text" value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="例：ラーメン 新宿、焼肉 渋谷"
                  className={inputCls} />
                <button onClick={handleSearch} disabled={loading}
                  className="bg-primary text-white rounded-2xl px-4 text-sm font-black transition-opacity disabled:opacity-60 shrink-0">
                  {loading ? '...' : '検索'}
                </button>
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}

              {places.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {places.map(p => (
                    <button key={p.placeId}
                      onClick={() => { setSelectedPlace(p); setAiText('') }}
                      className={`w-full text-left rounded-2xl px-4 py-3 text-sm transition-all ${
                        selectedPlace?.placeId === p.placeId
                          ? 'bg-primary/15 border border-primary/30'
                          : 'bg-sp-card2 hover:border hover:border-sp-border'
                      }`}>
                      <div className="font-black text-white">{p.name}</div>
                      <div className="text-xs text-sp-muted truncate mt-0.5">{p.address}</div>
                      {p.rating && <div className="text-xs text-yellow-400 mt-0.5">★ {p.rating}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedPlace && (
              <>
                <div className="bg-sp-card rounded-3xl border border-sp-border p-5 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-sp-muted">📍 {selectedPlace.name}</p>
                  <Map
                    center={[selectedPlace.lat, selectedPlace.lng]}
                    markers={mapMarkers}
                    className="h-48 rounded-3xl overflow-hidden border border-sp-border"
                  />
                </div>

                <div className="bg-sp-card rounded-3xl border border-sp-border p-5 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-sp-muted">運動設定</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['running', 'walking'] as const).map(t => (
                      <button key={t} onClick={() => setExerciseType(t)}
                        className={`py-2.5 rounded-2xl text-sm font-black transition-all ${
                          exerciseType === t ? 'bg-primary text-white' : 'bg-sp-card2 text-sp-muted border border-sp-border'
                        }`}>
                        {t === 'running' ? '🏃 ランニング' : '🚶 ウォーキング'}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="text-xs font-bold text-sp-muted uppercase tracking-wide mb-1.5 block">距離 (km)</label>
                    <input type="number" min="0.5" step="0.5" value={distance}
                      onChange={e => setDistance(e.target.value)} className={inputCls} />
                  </div>
                  <button onClick={handleAISuggest} disabled={aiLoading}
                    className="w-full bg-accent text-white rounded-2xl py-3.5 text-sm font-black transition-opacity disabled:opacity-60">
                    {aiLoading ? 'AI が考え中...' : '✨ AIコース提案を見る'}
                  </button>
                </div>

                {aiText && (
                  <div className="bg-sp-card2 rounded-3xl border border-sp-border p-5 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-sp-muted">✨ AIコース提案</p>
                    <p className="text-sm text-sp-muted leading-relaxed">{aiText}</p>
                    <button onClick={handleShare} disabled={sharing}
                      className="w-full bg-primary text-white rounded-2xl py-3.5 font-black transition-opacity disabled:opacity-60">
                      {sharing ? '共有中...' : '📱 タイムラインに共有する'}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {mode === 'exercise' && (
          <>
            <div className="bg-sp-card rounded-3xl border border-sp-border p-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-sp-muted">運動を設定</p>
              <div className="grid grid-cols-2 gap-2">
                {(['running', 'walking'] as const).map(t => (
                  <button key={t} onClick={() => setExType(t)}
                    className={`py-2.5 rounded-2xl text-sm font-black transition-all ${
                      exType === t ? 'bg-primary text-white' : 'bg-sp-card2 text-sp-muted border border-sp-border'
                    }`}>
                    {t === 'running' ? '🏃 ランニング' : '🚶 ウォーキング'}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-sp-muted uppercase tracking-wide mb-1.5 block">距離 (km)</label>
                  <input type="number" min="0.5" step="0.5" value={exDistance}
                    onChange={e => setExDistance(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-bold text-sp-muted uppercase tracking-wide mb-1.5 block">時間 (分)</label>
                  <input type="number" min="1" value={exDuration}
                    onChange={e => setExDuration(e.target.value)} className={inputCls} />
                </div>
              </div>

              {previewCalories > 0 && (
                <div className="bg-accent/15 border border-accent/30 rounded-2xl p-4 text-center">
                  <div className="text-3xl font-black text-accent">
                    {previewCalories} <span className="text-sm font-normal text-sp-muted">kcal</span>
                  </div>
                  <div className="text-xs text-sp-muted mt-1">{getFoodExample(previewCalories)}</div>
                </div>
              )}

              <button onClick={handleExAISuggest} disabled={aiLoading || !exDuration}
                className="w-full bg-accent text-white rounded-2xl py-3.5 text-sm font-black transition-opacity disabled:opacity-60">
                {aiLoading ? 'AI が考え中...' : '✨ AIおすすめグルメを見る'}
              </button>
            </div>

            {exAiText && (
              <div className="bg-sp-card2 rounded-3xl border border-sp-border p-5 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-sp-muted">✨ AI おすすめグルメ</p>
                <p className="text-sm text-sp-muted leading-relaxed whitespace-pre-line">{exAiText}</p>
                <div className="flex gap-2">
                  <input type="text" value={exSearchQuery}
                    onChange={e => setExSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleExSearch()}
                    placeholder="お店を検索..."
                    className={inputCls} />
                  <button onClick={handleExSearch} disabled={loading}
                    className="bg-primary text-white rounded-2xl px-4 text-sm font-black transition-opacity disabled:opacity-60 shrink-0">
                    検索
                  </button>
                </div>
              </div>
            )}

            {exPlaces.length > 0 && (
              <div className="bg-sp-card rounded-3xl border border-sp-border p-5 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-sp-muted">🍽️ 近くのお店</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {exPlaces.map(p => (
                    <button key={p.placeId} onClick={() => setExSelected(p)}
                      className={`w-full text-left rounded-2xl px-4 py-3 text-sm transition-all ${
                        exSelected?.placeId === p.placeId
                          ? 'bg-primary/15 border border-primary/30'
                          : 'bg-sp-card2'
                      }`}>
                      <div className="font-black text-white">{p.name}</div>
                      <div className="text-xs text-sp-muted truncate mt-0.5">{p.address}</div>
                      {p.rating && <div className="text-xs text-yellow-400 mt-0.5">★ {p.rating}</div>}
                    </button>
                  ))}
                </div>

                {exSelected && (
                  <Map
                    center={[exSelected.lat, exSelected.lng]}
                    markers={exMapMarkers}
                    className="h-48 rounded-3xl overflow-hidden border border-sp-border"
                  />
                )}

                {exSelected && (
                  <button onClick={handleExShare} disabled={sharing}
                    className="w-full bg-primary text-white rounded-2xl py-3.5 font-black transition-opacity disabled:opacity-60">
                    {sharing ? '共有中...' : '📱 タイムラインに共有する'}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <TabBar />
    </div>
  )
}
