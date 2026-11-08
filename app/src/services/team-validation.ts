// サーバーと同じ上限をフォーム側でも確認する（権威はサーバー。UI は利便性のため）
const length = (s: string) => [...s].length

export function validateTeamName(raw: string): string | null {
  const name = raw.normalize('NFC').trim().replace(/\s+/g, ' ')
  if (!name) return 'チーム名を入力してください'
  if (length(name) > 30) return 'チーム名は30文字以内で入力してください'
  return null
}

export function validatePassphrase(raw: string): string | null {
  const pass = raw.normalize('NFKC').trim()
  if (length(pass) < 6) return '合言葉は6文字以上で入力してください'
  if (length(pass) > 64) return '合言葉は64文字以内で入力してください'
  return null
}

/** チーム名検索用の正規化（全角半角・大文字小文字を区別しない） */
export const normalizeForSearch = (s: string) => s.normalize('NFKC').toLowerCase()
