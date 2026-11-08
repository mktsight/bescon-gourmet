import { Fragment, type ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTeam } from '../contexts/team-context'
import TeamOnboardingPage from '../pages/TeamOnboardingPage'

export default function TeamGate({ children }: { children: ReactNode }) {
  const { status, currentTeam, refreshTeams } = useTeam()
  const { logout } = useAuth()

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="text-sp-muted text-sm">読み込み中...</div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-app-bg flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-white font-black">チーム情報を読み込めませんでした</p>
        <div className="flex gap-3">
          <button onClick={() => { void refreshTeams() }} className="bg-primary text-white rounded-2xl px-5 py-3 text-sm font-black">
            再読み込み
          </button>
          <button onClick={() => { void logout() }} className="bg-sp-card2 text-sp-muted rounded-2xl px-5 py-3 text-sm font-bold">
            ログアウト
          </button>
        </div>
      </div>
    )
  }

  if (!currentTeam) return <TeamOnboardingPage />

  // チームを切り替えると配下のページを作り直し、旧チームの状態を残さない
  return <Fragment key={currentTeam.teamId}>{children}</Fragment>
}
