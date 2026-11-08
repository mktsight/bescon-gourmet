import { useState, useEffect, useRef } from 'react'
import type { Post, Comment } from '../services/api'
import { likePost, unlikePost, postComment, fetchComments } from '../services/api'
import { useTeam } from '../contexts/team-context'

// 取得結果で置き換えず reactionId で合成する（投稿直後のコメントを古い応答で消さない）
function mergeComments(prev: Comment[], fetched: Comment[]): Comment[] {
  const byId = new Map<string, Comment>()
  for (const c of prev) byId.set(c.reactionId, c)
  for (const c of fetched) byId.set(c.reactionId, c)
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.reactionId.localeCompare(b.reactionId))
}

// いいね・コメントの状態と操作（PostCard とヒーローで共通）
export function usePostInteractions(post: Post, onUpdate: (updated: Post) => void) {
  const teamId = useTeam().currentTeam!.teamId
  const [liking, setLiking] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)
  const commentsSeq = useRef(0)

  // 取得は effect 内で行い（lint: set-state-in-effect を避ける）、連番で古い応答を捨てる
  useEffect(() => {
    if (post.commentCount <= 0) return
    const seq = ++commentsSeq.current
    fetchComments(teamId, post.postId)
      .then(r => {
        if (seq !== commentsSeq.current) return
        setComments(prev => mergeComments(prev, r.items))
        setLoaded(true)
      })
      .catch(() => {})
  }, [teamId, post.postId, post.commentCount])

  async function handleLike() {
    if (liking) return
    setLiking(true)
    try {
      const res = post.likedByMe ? await unlikePost(teamId, post.postId) : await likePost(teamId, post.postId)
      onUpdate({ ...post, likedByMe: res.liked, likeCount: res.likeCount })
    } catch {}
    setLiking(false)
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim() || posting) return
    setPosting(true)
    try {
      const c = await postComment(teamId, post.postId, commentText.trim())
      setComments(prev => mergeComments(prev, [c]))
      onUpdate({ ...post, commentCount: post.commentCount + 1 })
      setCommentText('')
    } catch {}
    setPosting(false)
  }

  const displayedComments = showAll ? comments : comments.slice(0, 2)

  return {
    liking, comments, loaded, showAll, setShowAll,
    commentText, setCommentText, posting,
    handleLike, handleComment, displayedComments,
  }
}

export type PostInteractions = ReturnType<typeof usePostInteractions>
