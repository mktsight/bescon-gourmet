import type { ReactNode } from 'react'
import type { Post } from '../services/api'
import type { PostInteractions } from './usePostInteractions'

// アクション行（👍 / 💬 / 右側スロット）といいね数
export function LikeBar({ post, ix, right }: { post: Post; ix: PostInteractions; right?: ReactNode }) {
  return (
    <>
      <div className="flex items-center gap-4 px-4 py-2">
        <button
          onClick={ix.handleLike}
          disabled={ix.liking}
          aria-label={post.likedByMe ? 'いいねを取り消す' : 'いいね'}
          aria-pressed={post.likedByMe}
          className={`text-xl transition ${post.likedByMe ? 'scale-110' : 'grayscale opacity-60 hover:grayscale-0 hover:opacity-100'}`}
        >
          👍
        </button>
        <button className="text-white text-xl">💬</button>
        {right}
      </div>
      {post.likeCount > 0 && (
        <div className="px-4 pb-1">
          <span className="text-sm font-black text-white">いいね {post.likeCount}件</span>
        </div>
      )}
    </>
  )
}

// コメント一覧と入力欄
export function CommentSection({ post, ix }: { post: Post; ix: PostInteractions }) {
  return (
    <div className="px-4 pb-4 space-y-1.5">
      {ix.displayedComments.map(c => (
        <p key={c.reactionId} className="text-sm">
          <span className="font-black text-white">{c.userName} </span>
          <span className="text-sp-muted">{c.content}</span>
        </p>
      ))}
      {!ix.showAll && ix.loaded && ix.comments.length > 2 && (
        <button
          onClick={() => ix.setShowAll(true)}
          className="text-sp-muted text-xs font-semibold"
        >
          コメントをすべて見る（{post.commentCount}件）
        </button>
      )}
      <form onSubmit={ix.handleComment} className="flex items-center gap-2 mt-2 border-t border-sp-border pt-2">
        <input
          type="text"
          value={ix.commentText}
          onChange={e => ix.setCommentText(e.target.value)}
          placeholder="コメントを追加..."
          className="flex-1 bg-transparent text-sm text-white placeholder:text-sp-muted focus:outline-none"
        />
        {ix.commentText.trim() && (
          <button
            type="submit"
            disabled={ix.posting}
            className="text-primary font-black text-xs disabled:opacity-40"
          >
            投稿
          </button>
        )}
      </form>
    </div>
  )
}
