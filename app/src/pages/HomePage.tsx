import { useState, useEffect } from 'react'
import TabBar from '../components/TabBar'
import PostCard from '../components/PostCard'
import { fetchPosts, fetchNotifications, markAllRead, type Notification } from '../services/api'
import type { Post } from '../services/api'

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotif, setShowNotif] = useState(false)

  useEffect(() => {
    load()
    loadNotifications()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetchPosts()
      setPosts(res.items)
    } catch {}
    setLoading(false)
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
        <h1 className="text-xl font-black text-white tracking-tight">ベスコングルメ部</h1>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="w-8 h-8 flex items-center justify-center text-sp-muted hover:text-white transition-colors">🔄</button>
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
        <div className="pb-4">
          {loading ? (
            <div className="text-center py-16 text-sp-muted text-sm">読み込み中...</div>
          ) : posts.length === 0 ? (
            <div className="mx-4 bg-sp-card rounded-3xl border border-sp-border p-10 text-center">
              <div className="text-5xl mb-3">🏃</div>
              <p className="text-white font-black">最初の記録をしよう！</p>
              <p className="text-sp-muted text-sm mt-1">中央のボタンから運動を記録できます</p>
            </div>
          ) : (
            posts.map(p => (
              <PostCard
                key={p.postId}
                post={p}
                onUpdate={updated => setPosts(prev => prev.map(x => x.postId === updated.postId ? updated : x))}
              />
            ))
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

      <TabBar />
    </div>
  )
}
