// RecordModal（記録）と EditPostModal（編集）で共通の入力部品

export function ExerciseTypePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { value: 'running', label: '🏃 ランニング' },
        { value: 'walking', label: '🚶 ウォーキング' },
      ].map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`py-5 rounded-2xl font-black text-sm transition-all border-2 ${
            value === opt.value
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
  )
}

interface DistanceDurationProps {
  distance: string
  duration: string
  onDistance: (v: string) => void
  onDuration: (v: string) => void
}

export function DistanceDurationFields({ distance, duration, onDistance, onDuration }: DistanceDurationProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-xs text-sp-muted font-semibold uppercase tracking-widest block mb-2">距離 (km)</label>
        <input
          type="number"
          step="0.1"
          value={distance}
          onChange={e => onDistance(e.target.value)}
          placeholder="5.0"
          className="w-full bg-sp-card2 border-0 text-white text-2xl font-black rounded-2xl px-4 py-4 text-center focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-sp-border"
        />
      </div>
      <div>
        <label className="text-xs text-sp-muted font-semibold uppercase tracking-widest block mb-2">時間 (分)</label>
        <input
          type="number"
          value={duration}
          onChange={e => onDuration(e.target.value)}
          placeholder="30"
          className="w-full bg-sp-card2 border-0 text-white text-2xl font-black rounded-2xl px-4 py-4 text-center focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-sp-border"
        />
      </div>
    </div>
  )
}

interface PhotoFieldProps {
  previewUrl: string | null
  onPick: (file: File) => void
  onRemove: () => void
}

export function PhotoField({ previewUrl, onPick, onRemove }: PhotoFieldProps) {
  return (
    <div>
      <label className="text-xs text-sp-muted font-semibold uppercase tracking-widest block mb-2">写真を追加（任意）</label>
      {previewUrl ? (
        <div className="relative">
          <img src={previewUrl} className="w-full h-40 object-cover rounded-2xl" alt="preview" />
          <button
            type="button"
            onClick={onRemove}
            aria-label="写真を外す"
            className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-black"
          >
            ×
          </button>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 bg-sp-card2 rounded-2xl py-5 border-2 border-dashed border-sp-border cursor-pointer hover:border-primary/50 transition-colors">
          <span className="text-2xl">📷</span>
          <span className="text-sm text-sp-muted font-semibold">タップして写真を選択</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) onPick(file)
            }}
          />
        </label>
      )}
    </div>
  )
}

export function MemoField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-sp-muted font-semibold uppercase tracking-widest block mb-2">コメント（任意）</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="今日の感想をみんなにシェアしよう..."
        className="w-full bg-sp-card2 border-0 text-white text-sm rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none placeholder:text-sp-muted"
      />
    </div>
  )
}

export function KcalPreview({ kcal, food }: { kcal: number; food: string }) {
  if (kcal <= 0) return null
  return (
    <div className="bg-accent/15 border border-accent/30 rounded-2xl p-4 text-center">
      <div className="text-4xl font-black text-accent">{kcal} kcal</div>
      <div className="text-xs text-sp-muted mt-1">≈ {food}</div>
    </div>
  )
}
