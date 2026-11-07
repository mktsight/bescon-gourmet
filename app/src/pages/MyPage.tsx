import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import TabBar from '../components/TabBar'
import { fetchMe, updateMe, uploadPhoto } from '../services/api'
import type { UserProfile } from '../services/api'

const AGE_OPTIONS = [
  { value: '10s', label: '10代' },
  { value: '20s', label: '20代' },
  { value: '30s', label: '30代' },
  { value: '40s', label: '40代' },
  { value: '50s', label: '50代' },
  { value: '60s', label: '60代以上' },
]

export default function MyPage() {
  const { user, logout } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ bio: '', gender: 'other', ageGroup: '30s' })
  const [saving, setSaving] = useState(false)
  const [uploadingIcon, setUploadingIcon] = useState(false)
  const [iconError, setIconError] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const p = await fetchMe()
      setProfile(p)
      setForm({ bio: p.bio ?? '', gender: p.gender ?? 'other', ageGroup: p.ageGroup ?? '30s' })
    } catch {}
    setLoading(false)
  }

  async function handleIconChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingIcon(true)
    try {
      const iconUrl = await uploadPhoto(file, 'profiles')
      const updated = await updateMe({ iconUrl })
      setProfile(updated)
      setIconError(false)
    } catch {}
    setUploadingIcon(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateMe(form)
      setProfile(updated)
      setEditing(false)
    } catch {}
    setSaving(false)
  }

  const name = profile?.name ?? user?.name ?? '?'

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg pb-20 flex items-center justify-center">
        <div className="text-sp-muted">読み込み中...</div>
        <TabBar />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-app-bg pb-24">
      <header className="bg-app-bg border-b border-sp-border px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-xl font-black text-white tracking-tight">マイページ</h1>
        <button onClick={logout} className="text-sm text-sp-muted font-semibold hover:text-white transition-colors">ログアウト</button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-3">
        <div className="bg-sp-card rounded-3xl border border-sp-border p-6">
          <div className="flex items-center gap-4 mb-5">
            {/* タップで写真変更できるアバター */}
            <label className="relative cursor-pointer shrink-0">
              {profile?.iconUrl && !iconError ? (
                <img
                  src={profile.iconUrl}
                  alt={name}
                  className="w-20 h-20 rounded-3xl object-cover"
                  onError={() => setIconError(true)}
                />
              ) : (
                <div className="w-20 h-20 rounded-3xl bg-primary/20 flex items-center justify-center text-3xl font-black text-primary">
                  {name.slice(0, 1)}
                </div>
              )}
              {/* オーバーレイ */}
              <div className="absolute inset-0 rounded-3xl bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <span className="text-white text-xl">{uploadingIcon ? '⏳' : '📷'}</span>
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                className="hidden"
                onChange={handleIconChange}
                disabled={uploadingIcon}
              />
            </label>

            <div className="flex-1 min-w-0">
              <div className="text-xl font-black text-white">{name}</div>
              <div className="text-sm text-sp-muted">{profile?.email ?? user?.email}</div>
              {uploadingIcon && (
                <div className="text-xs text-primary mt-1 font-semibold">アップロード中...</div>
              )}
            </div>
          </div>

          {!editing ? (
            <>
              {profile?.bio ? (
                <p className="text-sm text-sp-muted mb-4 leading-relaxed">{profile.bio}</p>
              ) : (
                <p className="text-sm text-sp-muted italic mb-4">自己紹介がまだ設定されていません</p>
              )}
              <div className="flex gap-3 text-sm text-sp-muted mb-5">
                <span>{profile?.gender === 'male' ? '男性' : profile?.gender === 'female' ? '女性' : 'その他'}</span>
                <span>·</span>
                <span>{AGE_OPTIONS.find(a => a.value === profile?.ageGroup)?.label ?? profile?.ageGroup}</span>
              </div>
              <button onClick={() => setEditing(true)}
                className="w-full border-2 border-sp-border text-white rounded-2xl py-3 font-bold hover:border-primary/40 transition-colors">
                プロフィールを編集
              </button>
            </>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-sp-muted mb-1.5 uppercase tracking-wide">自己紹介</label>
                <textarea value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  className="w-full bg-sp-card2 border-0 text-white rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none placeholder:text-sp-muted"
                  placeholder="走ることが大好きです！" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-sp-muted mb-1.5 uppercase tracking-wide">性別</label>
                  <select value={form.gender}
                    onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                    className="w-full bg-sp-card2 border-0 text-white rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="male">男性</option>
                    <option value="female">女性</option>
                    <option value="other">その他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-sp-muted mb-1.5 uppercase tracking-wide">年代</label>
                  <select value={form.ageGroup}
                    onChange={e => setForm(f => ({ ...f, ageGroup: e.target.value }))}
                    className="w-full bg-sp-card2 border-0 text-white rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {AGE_OPTIONS.map(a => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-primary text-white rounded-2xl py-3 font-black disabled:opacity-60">
                  {saving ? '保存中...' : '保存する'}
                </button>
                <button type="button" onClick={() => setEditing(false)}
                  className="flex-1 bg-sp-card2 text-sp-muted rounded-2xl py-3 font-semibold">
                  キャンセル
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      <TabBar />
    </div>
  )
}
