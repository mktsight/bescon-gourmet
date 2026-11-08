import { useState, useEffect } from 'react'
import type { Post, Comment } from '../services/api'
import { timeAgo } from '../services/time'
import Avatar from './Avatar'
import { likePost, unlikePost, postComment, fetchComments } from '../services/api'

interface Props {
  post: Post
  onUpdate: (updated: Post) => void
}

export default function PostCard({ post, onUpdate }: Props) {
  const [liking, setLiking] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const isRunning = post.exerciseType === 'running'

  useEffect(() => {
    if (post.commentCount > 0) loadComments()
  }, [post.postId])

  async function loadComments() {
    try {
      const r = await fetchComments(post.postId)
      setComments(r.items)
      setLoaded(true)
    } catch {}
  }

  async function handleLike() {
    if (liking) return
    setLiking(true)
    try {
      const res = post.likedByMe ? await unlikePost(post.postId) : await likePost(post.postId)
      onUpdate({ ...post, likedByMe: res.liked, likeCount: res.likeCount })
    } catch {}
    setLiking(false)
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim() || posting) return
    setPosting(true)
    try {
      const c = await postComment(post.postId, commentText.trim())
      setComments(prev => [...prev, c])
      onUpdate({ ...post, commentCount: post.commentCount + 1 })
      setCommentText('')
    } catch {}
    setPosting(false)
  }

  const displayedComments = showAll ? comments : comments.slice(0, 2)

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
          <div className="text-xs text-sp-muted">{timeAgo(post.createdAt)}</div>
        </div>
        <span className="text-lg">{isRunning ? '🏃' : '🚶'}</span>
      </div>

      {/* 写真（メイン）または スタッツ */}
      {post.imageUrl && !imgFailed ? (
        <img
          src={post.imageUrl}
          alt=""
          className="w-full aspect-square object-cover bg-sp-card2"
          onError={() => setImgFailed(true)}
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
              🍽️ {post.foodExample}
            </div>
          )}
        </div>
      )}

      {/* アクション */}
      <div className="flex items-center gap-4 px-4 py-2">
        <button
          onClick={handleLike}
          disabled={liking}
          aria-label={post.likedByMe ? 'いいねを取り消す' : 'いいね'}
          aria-pressed={post.likedByMe}
          className={`text-xl transition ${post.likedByMe ? 'scale-110' : 'grayscale opacity-60 hover:grayscale-0 hover:opacity-100'}`}
        >
          👍
        </button>
        <button className="text-white text-xl">💬</button>
        {post.imageUrl && post.distance > 0 && (
          <div className="ml-auto flex gap-3 text-xs text-sp-muted font-semibold">
            <span className={isRunning ? 'text-primary' : 'text-sp-blue'}>{post.distance}km</span>
            <span>{post.duration}min</span>
            <span className="text-accent">{post.calories}kcal</span>
          </div>
        )}
      </div>

      {/* いいね数 */}
      {post.likeCount > 0 && (
        <div className="px-4 pb-1">
          <span className="text-sm font-black text-white">いいね {post.likeCount}件</span>
        </div>
      )}

      {/* キャプション */}
      {post.memo && (
        <p className="px-4 pb-2 text-sm">
          <span className="font-black text-white">{post.userName} </span>
          <span className="text-sp-muted">{post.memo}</span>
        </p>
      )}

      {/* コメント（常時表示） */}
      <div className="px-4 pb-4 space-y-1.5">
        {displayedComments.map(c => (
          <p key={c.reactionId} className="text-sm">
            <span className="font-black text-white">{c.userName} </span>
            <span className="text-sp-muted">{c.content}</span>
          </p>
        ))}
        {!showAll && loaded && comments.length > 2 && (
          <button
            onClick={() => setShowAll(true)}
            className="text-sp-muted text-xs font-semibold"
          >
            コメントをすべて見る（{post.commentCount}件）
          </button>
        )}
        <form onSubmit={handleComment} className="flex items-center gap-2 mt-2 border-t border-sp-border pt-2">
          <input
            type="text"
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder="コメントを追加..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-sp-muted focus:outline-none"
          />
          {commentText.trim() && (
            <button
              type="submit"
              disabled={posting}
              className="text-primary font-black text-xs disabled:opacity-40"
            >
              投稿
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
