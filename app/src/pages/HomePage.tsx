import { useState, useEffect, useMemo, useRef } from 'react'
import TabBar from '../components/TabBar'
import PostCard from '../components/PostCard'
import LatestPostHero from '../components/LatestPostHero'
import EditPostModal from '../components/EditPostModal'
import TeamSwitcher from '../components/TeamSwitcher'
import { useRecord } from '../contexts/RecordContext'
import { useTeam } from '../contexts/team-context'
import { fetchPosts, fetchNotifications, markAllRead, type Notification } from '../services/api'
import type { Post } from '../services/api'
import { splitFeed, mergeFetched } from '../services/feed'

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const { postedVersion } = useRecord()
  const teamId = useTeam().currentTeam!.teamId
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotif, setShowNotif] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const loadSeq = useRef(0)
  // 編集直後に古い一覧の応答が届いても巻き戻らないよう、保存済みの編集内容を保持する
  const localEdits = useRef(new Map<string, Post>())

  useEffect(() => {
    load(teamId)
  }, [teamId, postedVersion])

  useEffect(() => {
    loadNotifications()
  }, [])

  // 写真つきの最新投稿をヒーローにし、タイムラインにはそれ以外を出す
  const { hero, rest } = useMemo(() => splitFeed(posts), [posts])
  const initialLoading = loading && posts.length === 0

  async function load(tid: string) {
    const seq = ++loadSeq.current
    setLoading(true)
    setError(false)
    try {
      const res = await fetchPosts(tid)
      if (seq !== loadSeq.current) return
      setPosts(mergeFetched(res.items, localEdits.current))
      for (const f of res.items) {
        const local = localEdits.current.get(f.postId)
        if (local && (f.editedAt ?? '') >= (local.editedAt ?? '')) localEdits.current.delete(f.postId)
      }
      setRefreshToken(t => t + 1)
    } catch {
      if (seq !== loadSeq.current) return
      setError(true)
    }
    setLoading(false)
  }

  const updatePostInState = (updated: Post) => setPosts(prev => prev.map(x => x.postId === updated.postId ? updated : x))
  function handleSaved(updated: Post) {
    localEdits.current.set(updated.postId, updated)
    updatePostInState(updated)
  }
  async function loadNotifications() {
    try {
      const r = await fetchNotifications()
      setNotifications(r.items)
      setUnreadCount(r.unreadCount)
    } catch {}
  }

  async function handleOpenNotif() {
    setShowNotif(true)
    if (unreadCount > 0) {
      await markAllRead()
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }
  }

  return (
    <div className="min-h-screen bg-app-bg pb-28">
      <header className="sticky top-0 z-10 bg-app-bg border-b border-sp-border px-5 py-4 flex items-center justify-between">
        <TeamSwitcher />
        <div className="flex items-center gap-2">
          <button onClick={() => { load(teamId); loadNotifications() }} disabled={loading} aria-label="更新"
            className="w-8 h-8 flex items-center justify-center text-sp-muted hover:text-white transition-colors">
            <span className={loading ? 'animate-spin' : ''}>🔄</span>
          </button>
          <button onClick={handleOpenNotif} className="relative w-8 h-8 flex items-center justify-center">
            <span>🔔</span>
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-primary rounded-full text-[10px] font-black text-white flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto">
        {error && posts.length > 0 && <p className="text-xs text-red-400 px-4 pt-2">更新に失敗しました</p>}
        <LatestPostHero
          key={hero?.postId}
          post={hero}
          loading={initialLoading}
          error={error && posts.length === 0}
          onRetry={() => load(teamId)}
          retryToken={refreshToken}
          onUpdate={updatePostInState}
          onEdit={setEditingPost}
        />
        <div className="pb-4">
          {!loading && !error && posts.length === 0 && (
            <div className="mx-4 mt-4 bg-sp-card rounded-3xl border border-sp-border p-10 text-center">
              <div className="text-5xl mb-3">🏃</div>
              <p className="text-white font-black">最初の記録をしよう！</p>
              <p className="text-sp-muted text-sm mt-1">中央のボタンから運動を記録できます</p>
            </div>
          )}
          {posts.length > 0 && (
            <>
              <h2 className="px-4 pt-5 pb-2 text-xs font-semibold uppercase tracking-widest text-sp-muted">タイムライン</h2>
              {rest.length === 0 && (
                <div className="mx-4 bg-sp-card rounded-3xl border border-sp-border p-6 text-center">
                  <p className="text-sp-muted text-sm font-semibold">他の投稿はまだありません</p>
                </div>
              )}
              {rest.map(p => (
                <PostCard
                  key={p.postId}
                  post={p}
                  retryToken={refreshToken}
                  onUpdate={updatePostInState}
                  onEdit={setEditingPost}
                />
              ))}
            </>
          )}
        </div>
      </main>

      {showNotif && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={() => setShowNotif(false)}>
          <div className="bg-sp-card w-full max-w-lg rounded-t-3xl px-5 pt-5 pb-10 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-sp-border rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-white">通知</h2>
              <button onClick={() => setShowNotif(false)} className="w-8 h-8 flex items-center justify-center text-sp-muted rounded-full bg-sp-card2 text-lg">×</button>
            </div>
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-sp-muted text-sm">通知はありません</div>
            ) : (
              <div className="space-y-2">
                {notifications.map(n => (
                  <div key={n.notificationId}
                    className={`rounded-2xl p-4 text-sm ${n.read ? 'bg-sp-card2' : 'bg-primary/10 border border-primary/20'}`}>
                    <div className="text-white">{n.message}</div>
                    <div className="text-xs text-sp-muted mt-1">{new Date(n.createdAt).toLocaleString('ja-JP')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {editingPost && (
        <EditPostModal
          key={editingPost.postId}
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSaved={handleSaved}
        />
      )}
      <TabBar />
    </div>
  )
}
