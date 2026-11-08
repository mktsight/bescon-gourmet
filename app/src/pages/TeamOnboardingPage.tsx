import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { CreateTeamForm, JoinTeamPanel } from '../components/TeamForms'

export default function TeamOnboardingPage() {
  const { logout } = useAuth()
  const [mode, setMode] = useState<'create' | 'join' | null>(null)

  return (
    <div className="min-h-screen bg-app-bg px-5 py-6">
      <div className="max-w-lg mx-auto">
        <div className="flex justify-end">
          <button onClick={() => { void logout() }} className="text-xs font-semibold text-sp-muted">ログアウト</button>
        </div>
        <div className="text-center pt-8 pb-8">
          <div className="text-5xl mb-4">🏃</div>
          <h1 className="text-2xl font-black text-white">ようこそ！</h1>
          <p className="text-sp-muted text-sm mt-2">チームを作成するか、既存のチームに参加してください</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMode('create')}
            className={`rounded-2xl py-6 font-black text-sm border-2 ${mode === 'create' ? 'bg-primary/20 border-primary text-primary' : 'bg-sp-card border-sp-border text-white'}`}
          >
            ＋ チームを作成
          </button>
          <button
            onClick={() => setMode('join')}
            className={`rounded-2xl py-6 font-black text-sm border-2 ${mode === 'join' ? 'bg-sp-blue/20 border-sp-blue text-sp-blue' : 'bg-sp-card border-sp-border text-white'}`}
          >
            🔑 チームに参加
          </button>
        </div>
        {mode && (
          <div className="mt-6 bg-sp-card rounded-3xl border border-sp-border p-5">
            {mode === 'create'
              ? <CreateTeamForm onDone={() => setMode(null)} />
              : <JoinTeamPanel onDone={() => setMode(null)} />}
          </div>
        )}
      </div>
    </div>
  )
}
