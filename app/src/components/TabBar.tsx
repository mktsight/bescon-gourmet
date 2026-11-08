import { useNavigate, useLocation } from 'react-router-dom'
import { useRecord } from '../contexts/RecordContext'

function Tab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center py-3 flex-1 gap-0.5 relative"
    >
      {active && (
        <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-primary" />
      )}
      <span className={`text-xl leading-none ${active ? '' : 'opacity-30'}`}>{icon}</span>
      <span className={`text-[10px] font-semibold tracking-wide ${active ? 'text-primary' : 'text-sp-muted'}`}>
        {label}
      </span>
    </button>
  )
}

export default function TabBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { open } = useRecord()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 bg-sp-card border-t border-sp-border">
      <div className="flex items-stretch relative">
        <div className="flex flex-1">
          <Tab active={pathname === '/'} onClick={() => navigate('/')} icon="🏠" label="ホーム" />
          <Tab active={pathname === '/team'} onClick={() => navigate('/team')} icon="👥" label="チーム" />
        </div>
        {/* 中央 FAB */}
        <div className="w-20 flex flex-col items-center justify-end py-2 relative">
          <button
            onClick={open}
            className="absolute -top-7 w-16 h-16 rounded-full bg-primary shadow-2xl shadow-primary/60 flex items-center justify-center text-2xl active:scale-95 transition-transform border-4 border-sp-card"
          >
            📷
          </button>
          <span className="text-[10px] font-semibold text-primary mt-7">投稿</span>
        </div>
        <div className="flex flex-1">
          <Tab active={pathname === '/mypage'} onClick={() => navigate('/mypage')} icon="👤" label="マイページ" />
        </div>
      </div>
    </nav>
  )
}
