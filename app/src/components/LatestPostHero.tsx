import { useState } from 'react'
import type { Post } from '../services/api'
import { timeAgo } from '../services/time'
import Avatar from './Avatar'
import { useAuth } from '../contexts/AuthContext'
import { usePostInteractions } from './usePostInteractions'
import { LikeBar, CommentSection } from './PostInteractionParts'
interface Props {
  post: Post | null
  loading: boolean
  error: boolean
  onRetry: () => void
  retryToken: number
  onUpdate: (updated: Post) => void
  onEdit: (post: Post) => void
}
export default function LatestPostHero({ post, loading, error, onRetry, retryToken, onUpdate, onEdit }: Props) {
  if (loading) {
    return (
      <div className="bg-sp-card border-b border-sp-border" aria-busy="true">
        <div className="aspect-[4/5] max-h-[60vh] w-full bg-sp-card2 animate-pulse" />
        <div className="p-4 space-y-3">
          <div className="h-4 w-3/4 bg-sp-card2 rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-sp-card2 rounded animate-pulse" />
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="mx-4 mt-4 bg-sp-card rounded-3xl border border-sp-border p-10 text-center">
        <div className="text-4xl mb-3">⚠</div>
        <p className="text-white font-black">投稿を読み込めませんでした</p>
        <button onClick={onRetry} className="mt-4 bg-primary text-white rounded-2xl px-6 py-3 text-sm font-black">
          再読み込み
        </button>
      </div>
    )
  }
  if (!post) return null
  return <HeroPost post={post} retryToken={retryToken} onUpdate={onUpdate} onEdit={onEdit} />
}
interface HeroPostProps {
  post: Post
  retryToken: number
  onUpdate: (updated: Post) => void
  onEdit: (post: Post) => void
}
function HeroPost({ post, retryToken, onUpdate, onEdit }: HeroPostProps) {
  const { user } = useAuth()
  const ix = usePostInteractions(post, onUpdate)
  const [failed, setFailed] = useState<{ url: string; token: number } | null>(null)
  const isRunning = post.exerciseType === 'running'
  const hasPhoto = !!post.imageUrl && !(failed && failed.url === post.imageUrl && failed.token === retryToken)
  const badge = post.imageUrl ? '最新の写真' : '最新の投稿'
  const canEdit = !!user?.userId && post.userId === user.userId
  const editButton = (cls: string) => (
    <button onClick={() => onEdit(post)} className={`text-xs font-semibold rounded-full px-3 py-1.5 ${cls}`}>
      ✏️ 編集
    </button>
  )
  const edited = post.editedAt ? '・編集済み' : ''
  return (
    <div className="bg-sp-card border-b border-sp-border">
      {hasPhoto ? (
        <div className="relative">
          <img
            src={post.imageUrl ?? ''}
            alt=""
            className="w-full aspect-[4/5] max-h-[60vh] object-cover bg-sp-card2"
            onError={() => setFailed({ url: post.imageUrl ?? '', token: retryToken })}
          />
          <span className="absolute top-3 left-3 bg-primary text-white text-[10px] font-black rounded-full px-2.5 py-1">
            {badge}
          </span>
          {canEdit && <div className="absolute top-3 right-3">{editButton('bg-black/60 text-white')}</div>}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12">
            <div className="flex items-center gap-2">
              <Avatar src={post.userIconUrl} name={post.userName} className="w-8 h-8 rounded-full" fallbackClassName="text-sm text-white bg-white/20" />
              <span className="font-black text-white">{post.userName}</span>
              <span className="text-xs text-white/70">{timeAgo(post.createdAt)}{edited}</span>
              <span className="ml-auto text-lg">{isRunning ? '🏃' : '🚶'}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 pb-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-primary text-white text-[10px] font-black rounded-full px-2.5 py-1">{badge}</span>
            <Avatar src={post.userIconUrl} name={post.userName} className="w-7 h-7 rounded-full" fallbackClassName={`text-xs text-white ${isRunning ? 'bg-primary/30' : 'bg-sp-blue/30'}`} />
            <span className="font-black text-white">{post.userName}</span>
            <span className="text-xs text-sp-muted">{timeAgo(post.createdAt)}{edited}</span>
            <span className="ml-auto flex items-center gap-2">
              {canEdit && editButton('bg-sp-card2 text-sp-muted')}
              <span className="text-lg">{isRunning ? '🏃' : '🚶'}</span>
            </span>
          </div>
          {!hasPhoto && !!post.imageUrl && (
            <p className="text-xs text-sp-muted mb-2">📷 写真を読み込めませんでした</p>
          )}
          <div className="bg-sp-card2 rounded-2xl p-5 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className={`text-4xl font-black tracking-tighter ${isRunning ? 'text-primary' : 'text-sp-blue'}`}>{post.distance}</div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-sp-muted mt-0.5">KM</div>
            </div>
            <div>
              <div className="text-4xl font-black tracking-tighter text-white">{post.duration}</div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-sp-muted mt-0.5">MIN</div>
            </div>
            <div>
              <div className="text-4xl font-black tracking-tighter text-accent">{post.calories}</div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-sp-muted mt-0.5">KCAL</div>
            </div>
          </div>
        </div>
      )}
      <div className="p-4 pb-0 space-y-3">
        {post.memo && <p className="text-base text-white line-clamp-3 break-words">{post.memo}</p>}
        {hasPhoto && (
          <div className="flex flex-wrap items-center gap-2">
            {post.distance > 0 && (
              <span className={`bg-sp-card2 rounded-full px-3 py-1 text-xs font-black ${isRunning ? 'text-primary' : 'text-sp-blue'}`}>
                {post.distance}km
              </span>
            )}
            {post.duration > 0 && (
              <span className="bg-sp-card2 rounded-full px-3 py-1 text-xs font-black text-white">{post.duration}分</span>
            )}
            {post.calories > 0 && (
              <span className="bg-sp-card2 rounded-full px-3 py-1 text-xs font-black text-accent">{post.calories}kcal</span>
            )}
          </div>
        )}
        {post.foodExample && <p className="text-xs text-sp-muted">🍽 {post.foodExample}</p>}
      </div>
      <LikeBar post={post} ix={ix} />
      <CommentSection post={post} ix={ix} />
    </div>
  )
}
