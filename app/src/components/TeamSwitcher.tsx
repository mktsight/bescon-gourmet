import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTeam } from '../contexts/team-context'
import BottomSheet from './BottomSheet'

export default function TeamSwitcher() {
  const { teams, currentTeam, switchTeam } = useTeam()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="チームを切り替える"
        data-testid="team-switcher"
        className="text-left min-w-0"
      >
        <div className="text-[10px] text-sp-muted leading-tight">ベスコングルメ部</div>
        <div className="text-lg font-black text-white tracking-tight flex items-center gap-1 leading-tight">
          <span className="truncate max-w-[200px]">{currentTeam?.name ?? ''}</span>
          <span className="text-xs text-sp-muted shrink-0">▾</span>
        </div>
      </button>
      {open && (
        <BottomSheet title="チームを切り替え" onClose={() => setOpen(false)}>
          <div className="space-y-2">
            {teams.map(t => {
              const current = t.teamId === currentTeam?.teamId
              return (
                <button
                  key={t.teamId}
                  onClick={() => { switchTeam(t.teamId); setOpen(false) }}
                  className={`w-full text-left rounded-2xl p-4 flex items-center gap-3 ${current ? 'bg-primary/10 border border-primary/20' : 'bg-sp-card2'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-white text-sm truncate">{t.name}</div>
                    <div className="text-xs text-sp-muted mt-0.5">メンバー{t.memberCount}人</div>
                  </div>
                  {current && <span className="text-primary font-black shrink-0">✓</span>}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => { setOpen(false); navigate('/team') }}
            className="w-full mt-4 bg-sp-card2 text-white rounded-2xl py-4 text-sm font-black"
          >
            チームを作成・参加する
          </button>
        </BottomSheet>
      )}
    </>
  )
}
