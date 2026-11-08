import type { Post } from './api'

/** 新しい順（作成日時の降順、同時刻は postId の降順） */
export function sortPosts(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.postId.localeCompare(a.postId))
}

/** ホーム最上部の投稿。写真の有無に関係なく、チームの最新の投稿 */
export function pickHero(sorted: Post[]): Post | null {
  return sorted[0] ?? null
}

/** ヒーローとタイムライン（ヒーローを除いた残り）に分ける。同じ投稿は両方に入らない */
export function splitFeed(posts: Post[]): { hero: Post | null; rest: Post[] } {
  const sorted = sortPosts(posts)
  const hero = pickHero(sorted)
  return { hero, rest: hero ? sorted.filter(p => p.postId !== hero.postId) : sorted }
}

/**
 * 取得結果に、まだ反映されていない自分の編集内容を重ねる。
 * 編集直後に古い GET /posts の応答が届いても編集が巻き戻らないようにする。
 * 件数と likedByMe は取得結果を優先する。
 */
export function mergeFetched(fetched: Post[], localEdits: Map<string, Post>): Post[] {
  return fetched.map(f => {
    const local = localEdits.get(f.postId)
    if (!local || !local.editedAt || local.editedAt <= (f.editedAt ?? '')) return f
    return {
      ...f,
      exerciseType: local.exerciseType,
      distance: local.distance,
      duration: local.duration,
      memo: local.memo,
      imageUrl: local.imageUrl,
      calories: local.calories,
      foodExample: local.foodExample,
      editedAt: local.editedAt,
    }
  })
}
