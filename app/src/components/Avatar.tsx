import { useState } from 'react'

interface Props {
  src?: string | null
  name: string
  /** サイズ・角丸など（例: "w-9 h-9 rounded-full"） */
  className: string
  /** アイコンがない・読み込めないときのイニシャルの見た目（背景色・文字色・文字サイズ） */
  fallbackClassName: string
  lazy?: boolean
}

// 名前は隣に表示されるため、画像のaltは空（装飾扱い）にしている
export default function Avatar({ src, name, className, fallbackClassName, lazy = false }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (src && src !== failedSrc) {
    return (
      <img
        src={src}
        alt=""
        loading={lazy ? 'lazy' : undefined}
        className={`${className} object-cover shrink-0`}
        onError={() => setFailedSrc(src)}
      />
    )
  }
  return (
    <div className={`${className} ${fallbackClassName} flex items-center justify-center font-black shrink-0`}>
      {name.slice(0, 1)}
    </div>
  )
}
