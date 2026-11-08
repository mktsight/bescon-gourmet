import { useState } from 'react'
import BottomSheet from './BottomSheet'
import { ExerciseTypePicker, DistanceDurationFields, PhotoField, MemoField, KcalPreview } from './PostFormParts'
import { ApiError, updatePost, uploadPhoto, type Post } from '../services/api'
import { calculateCalories, getFoodExample } from '../services/calories'
import { useAuth } from '../contexts/AuthContext'
import { useTeam } from '../contexts/team-context'

interface Props {
  post: Post
  onClose: () => void
  onSaved: (updated: Post) => void
}

// 投稿の編集（本人のみ）。写真は 維持 / 差し替え / 削除 を選べる
export default function EditPostModal({ post, onClose, onSaved }: Props) {
  const { user } = useAuth()
  // 開いた時点のチームの投稿を更新する
  const { currentTeam } = useTeam()
  const [teamId] = useState(() => currentTeam!.teamId)
  const [form, setForm] = useState({
    exerciseType: post.exerciseType as string,
    distance: String(post.distance),
    duration: String(post.duration),
    memo: post.memo ?? '',
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [removed, setRemoved] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const previewUrl = photoPreview ?? (removed ? null : post.imageUrl ?? null)
  const kcal = form.distance && form.duration
    ? calculateCalories(form.exerciseType, Number(form.duration), user?.gender ?? 'other', user?.ageGroup ?? '30s')
    : 0
  const food = kcal > 0 ? getFoodExample(kcal) : ''

  function handlePhotoPick(file: File) {
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function handlePhotoRemove() {
    setPhotoFile(null)
    setPhotoPreview(null)
    setRemoved(true)
  }

  async function handleSave() {
    if (submitting || !form.distance || !form.duration) return
    setError('')
    setSubmitting(true)
    try {
      const body: Parameters<typeof updatePost>[2] = {
        exerciseType: form.exerciseType,
        distance: Number(form.distance),
        duration: Number(form.duration),
        memo: form.memo,
      }
      if (photoFile) {
        setUploading(true)
        try {
          body.imageUrl = await uploadPhoto(photoFile)
        } catch {
          setUploading(false)
          setError('写真のアップロードに失敗しました。もう一度お試しください')
          setSubmitting(false)
          return
        }
        setUploading(false)
      } else if (removed) {
        body.imageUrl = null
      }
      // 写真を維持するときは imageUrl を送らない（サーバーが今の写真をそのまま保つ）
      const updated = await updatePost(teamId, post.postId, body)
      onSaved(updated)
      onClose()
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NOT_POST_OWNER') setError('自分の投稿だけ編集できます')
      else if (e instanceof ApiError && e.code === 'VALIDATION_ERROR') setError(e.message)
      else setError('保存に失敗しました。もう一度お試しください')
    }
    setSubmitting(false)
  }

  return (
    <BottomSheet title="投稿を編集" onClose={() => { if (!submitting) onClose() }}>
      <div className="space-y-4">
        <ExerciseTypePicker value={form.exerciseType} onChange={v => setForm(f => ({ ...f, exerciseType: v }))} />
        <DistanceDurationFields
          distance={form.distance}
          duration={form.duration}
          onDistance={v => setForm(f => ({ ...f, distance: v }))}
          onDuration={v => setForm(f => ({ ...f, duration: v }))}
        />
        <PhotoField previewUrl={previewUrl} onPick={handlePhotoPick} onRemove={handlePhotoRemove} />
        <KcalPreview kcal={kcal} food={food} />
        <MemoField value={form.memo} onChange={v => setForm(f => ({ ...f, memo: v }))} />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} disabled={submitting} className="flex-1 bg-sp-card2 text-sp-muted rounded-2xl py-4 font-bold disabled:opacity-60">
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={submitting || !form.distance || !form.duration}
            className="flex-[2] bg-primary text-white rounded-2xl py-4 font-black disabled:opacity-60"
          >
            {uploading ? 'アップロード中...' : submitting ? '保存中...' : '保存する'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
