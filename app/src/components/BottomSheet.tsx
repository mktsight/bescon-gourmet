import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

// HomePage の通知シートと同じ見た目のボトムシート
export default function BottomSheet({ title, onClose, children }: Props) {
  // ヘッダー（sticky z-10 の重なり文脈）の中から開いても TabBar より前面に出すため body 直下に描画する
  return createPortal(
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="bg-sp-card w-full max-w-lg rounded-t-3xl px-5 pt-5 pb-10 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-sp-border rounded-full mx-auto mb-5" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-white">{title}</h2>
          <button onClick={onClose} aria-label="閉じる" className="w-8 h-8 flex items-center justify-center text-sp-muted rounded-full bg-sp-card2 text-lg">×</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
