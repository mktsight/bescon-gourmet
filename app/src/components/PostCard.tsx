import { useState } from 'react'
import type { Post } from '../services/api'
import { timeAgo } from '../services/time'
import Avatar from './Avatar'
import { useAuth } from '../contexts/AuthContext'
import { usePostInteractions } from './usePostInteractions'
import { LikeBar, CommentSection } from './PostInteractionParts'
interface Props {
  post: Post
  onUpdate: (updated: Post) => void
  retryToken: number
  onEdit?: (post: Post) => void
}
export default function PostCard({ post, onUpdate, retryToken, onEdit }: Props) {
  const { user } = useAuth()
  const ix = usePostInteractions(post, onUpdate)
  const [failed, setFailed] = useState<{ url: string; token: number } | null>(null)
  const isRunning = post.exerciseType === 'running'
  const hasPhoto = !!post.imageUrl && !(failed && failed.url === post.imageUrl && failed.token === retryToken)
  const canEdit = !!onEdit && !!user?.userId && post.userId === user.userId
  return (
    <div className="bg-sp-card border-b border-sp-border">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar
          src={post.userIconUrl}
          name={post.userName}
          lazy
          className="w-9 h-9 rounded-full"
          fallbackClassName={`text-sm text-white ${isRunning ? 'bg-primary/30' : 'bg-sp-blue/30'}`}
        />
        <div className="flex-1 min-w-0">
          <div className="font-black text-sm text-white">{post.userName}</div>
          <div className="text-xs text-sp-muted">{timeAgo(post.createdAt)}{post.editedAt && '・編集済み'}</div>
        </div>
        {canEdit && (
          <button onClick={() => onEdit(post)} className="text-xs font-semibold text-sp-muted bg-sp-card2 rounded-full px-3 py-1.5">
            ✏️ 編集
          </button>
        )}
        <span className="text-lg">{isRunning ? '🏃' : '🚶'}</span>
      </div>
      {/* 写真（メイン）または スタッツ */}
      {hasPhoto ? (
        <img
          src={post.imageUrl ?? ''}
          alt=""
          className="w-full aspect-square object-cover bg-sp-card2"
          onError={() => setFailed({ url: post.imageUrl ?? '', token: retryToken })}
        />
      ) : (
        <div className="mx-4 mb-3 bg-sp-card2 rounded-2xl p-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className={`text-3xl font-black tracking-tighter ${isRunning ? 'text-primary' : 'text-sp-blue'}`}>{post.distance}</div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-sp-muted mt-0.5">KM</div>
            </div>
            <div>
              <div className="text-3xl font-black tracking-tighter text-white">{post.duration}</div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-sp-muted mt-0.5">MIN</div>
            </div>
            <div>
              <div className="text-3xl font-black tracking-tighter text-accent">{post.calories}</div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-sp-muted mt-0.5">KCAL</div>
            </div>
          </div>
          {post.foodExample && (
            <div className="mt-3 pt-3 border-t border-sp-border text-center text-xs text-sp-muted">
              🍽 {post.foodExample}
            </div>
          )}
        </div>
      )}
      {/* アクションといいね数 */}
      <LikeBar
        post={post}
        ix={ix}
        right={post.imageUrl && post.distance > 0 && (
          <div className="ml-auto flex gap-3 text-xs text-sp-muted font-semibold">
            <span className={isRunning ? 'text-primary' : 'text-sp-blue'}>{post.distance}km</span>
            <span>{post.duration}min</span>
            <span className="text-accent">{post.calories}kcal</span>
          </div>
        )}
      />
      {/* キャプション */}
      {post.memo && (
        <p className="px-4 pb-2 text-sm">
          <span className="font-black text-white">{post.userName} </span>
          <span className="text-sp-muted">{post.memo}</span>
        </p>
      )}
      {/* コメント（常時表示） */}
      <CommentSection post={post} ix={ix} />
    </div>
  )
}
