import { useState } from 'react'
import { createPost, uploadPhoto } from '../services/api'
import { calculateCalories, getFoodExample } from '../services/calories'
import { useRecord } from '../contexts/RecordContext'
import { useAuth } from '../contexts/AuthContext'

export default function RecordModal({ onPosted }: { onPosted?: () => void }) {
  const { isOpen, close, notifyPosted } = useRecord()
  const { user } = useAuth()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [form, setForm] = useState({ exerciseType: 'running', distance: '', duration: '', memo: '' })
  const [submitting, setSubmitting] = useState(false)
  const [celebrated, setCelebrated] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const kcal = form.distance && form.duration
    ? calculateCalories(form.exerciseType, Number(form.duration), user?.gender ?? 'other', user?.ageGroup ?? '30s')
    : 0
  const food = kcal > 0 ? getFoodExample(kcal) : ''

  async function handleSubmit() {
    if (submitting) return
    setError('')
    setSubmitting(true)
    try {
      let imageUrl: string | null = null
      if (photoFile) {
        setUploading(true)
        try {
          imageUrl = await uploadPhoto(photoFile)
        } catch {
          setUploading(false)
          setError('写真のアップロードに失敗しました。もう一度お試しください')
          setSubmitting(false)
          return
        }
        setUploading(false)
      }
      await createPost({
        exerciseType: form.exerciseType,
        distance: Number(form.distance),
        duration: Number(form.duration),
        memo: form.memo,
        imageUrl,
      })
      setCelebrated(true)
      setTimeout(() => {
        setCelebrated(false)
        close()
        setStep(1)
        setForm({ exerciseType: 'running', distance: '', duration: '', memo: '' })
        setPhotoFile(null)
        setPhotoPreview(null)
        notifyPosted()
        onPosted?.()
      }, 2000)
    } catch {
      setError('投稿に失敗しました。もう一度お試しください')
    }
    setSubmitting(false)
  }

  function handleClose() {
    close()
    setError('')
    setStep(1)
    setForm({ exerciseType: 'running', distance: '', duration: '', memo: '' })
    setPhotoFile(null)
    setPhotoPreview(null)
    setCelebrated(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      {celebrated ? (
        <div className="relative z-10 w-full max-w-lg bg-sp-card rounded-t-3xl p-10 text-center">
          <div className="text-7xl mb-4">🎉</div>
          <div className="text-3xl font-black text-white mb-2">記録完了！</div>
          <div className="text-sp-muted">お疲れ様でした！</div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="bg-sp-card2 rounded-2xl p-3 text-center">
              <div className="text-2xl font-black text-primary">{form.distance}</div>
              <div className="text-[10px] text-sp-muted uppercase tracking-widest">KM</div>
            </div>
            <div className="bg-sp-card2 rounded-2xl p-3 text-center">
              <div className="text-2xl font-black text-white">{form.duration}</div>
              <div className="text-[10px] text-sp-muted uppercase tracking-widest">MIN</div>
            </div>
            <div className="bg-sp-card2 rounded-2xl p-3 text-center">
              <div className="text-2xl font-black text-accent">{kcal}</div>
              <div className="text-[10px] text-sp-muted uppercase tracking-widest">KCAL</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative z-10 w-full max-w-lg bg-sp-card rounded-t-3xl pb-8" onClick={e => e.stopPropagation()}>
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-sp-border rounded-full" />
          </div>

          <div className="flex items-center justify-between px-6 pb-4">
            <h2 className="text-lg font-black text-white">ワークアウトを記録</h2>
            <div className="flex gap-1.5">
              {[1, 2, 3].map(s => (
                <div key={s} className={`w-2 h-2 rounded-full transition-colors ${step >= s ? 'bg-primary' : 'bg-sp-border'}`} />
              ))}
            </div>
          </div>

          <div className="px-6 space-y-4">
            {step === 1 && (
              <>
                <p className="text-sm text-sp-muted font-semibold uppercase tracking-widest">運動の種類</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'running', label: '🏃 ランニング' },
                    { value: 'walking', label: '🚶 ウォーキング' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setForm(f => ({ ...f, exerciseType: opt.value }))}
                      className={`py-5 rounded-2xl font-black text-sm transition-all border-2 ${
                        form.exerciseType === opt.value
                          ? opt.value === 'running'
                            ? 'bg-primary/20 border-primary text-primary'
                            : 'bg-sp-blue/20 border-sp-blue text-sp-blue'
                          : 'bg-sp-card2 border-sp-border text-sp-muted'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setStep(2)} className="w-full bg-primary text-white rounded-2xl py-4 font-black">
                  次へ →
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <p className="text-sm text-sp-muted font-semibold uppercase tracking-widest">距離・時間を入力</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-sp-muted font-semibold uppercase tracking-widest block mb-2">距離 (km)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={form.distance}
                      onChange={e => setForm(f => ({ ...f, distance: e.target.value }))}
                      placeholder="5.0"
                      className="w-full bg-sp-card2 border-0 text-white text-2xl font-black rounded-2xl px-4 py-4 text-center focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-sp-border"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sp-muted font-semibold uppercase tracking-widest block mb-2">時間 (分)</label>
                    <input
                      type="number"
                      value={form.duration}
                      onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                      placeholder="30"
                      className="w-full bg-sp-card2 border-0 text-white text-2xl font-black rounded-2xl px-4 py-4 text-center focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-sp-border"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="flex-1 bg-sp-card2 text-sp-muted rounded-2xl py-4 font-bold">← 戻る</button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!form.distance || !form.duration}
                    className="flex-[2] bg-primary text-white rounded-2xl py-4 font-black disabled:opacity-40"
                  >
                    次へ →
                  </button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                {/* 写真選択 */}
                <div>
                  <label className="text-xs text-sp-muted font-semibold uppercase tracking-widest block mb-2">写真を追加（任意）</label>
                  {photoPreview ? (
                    <div className="relative">
                      <img src={photoPreview} className="w-full h-40 object-cover rounded-2xl" alt="preview" />
                      <button
                        type="button"
                        onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                        className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-black"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 bg-sp-card2 rounded-2xl py-5 border-2 border-dashed border-sp-border cursor-pointer hover:border-primary/50 transition-colors">
                      <span className="text-2xl">📷</span>
                      <span className="text-sm text-sp-muted font-semibold">タップして写真を選択</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                    </label>
                  )}
                </div>
                {kcal > 0 && (
                  <div className="bg-accent/15 border border-accent/30 rounded-2xl p-4 text-center">
                    <div className="text-4xl font-black text-accent">{kcal} kcal</div>
                    <div className="text-xs text-sp-muted mt-1">≈ {food}</div>
                  </div>
                )}
                <div>
                  <label className="text-xs text-sp-muted font-semibold uppercase tracking-widest block mb-2">コメント（任意）</label>
                  <textarea
                    value={form.memo}
                    onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                    rows={2}
                    placeholder="今日の感想をみんなにシェアしよう..."
                    className="w-full bg-sp-card2 border-0 text-white text-sm rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none placeholder:text-sp-muted"
                  />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="flex-1 bg-sp-card2 text-sp-muted rounded-2xl py-4 font-bold">← 戻る</button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-[2] bg-primary text-white rounded-2xl py-4 font-black disabled:opacity-60"
                  >
                    {uploading ? 'アップロード中...' : submitting ? '投稿中...' : '記録する！'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
