import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { RecordProvider } from './contexts/RecordContext'
import { TeamProvider } from './contexts/TeamContext'
import { useTeam } from './contexts/team-context'
import RecordModal from './components/RecordModal'
import TeamGate from './components/TeamGate'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import HomePage from './pages/HomePage'
import MyPage from './pages/MyPage'
import TeamPage from './pages/TeamPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center">
      <div className="text-sp-muted text-sm">読み込み中...</div>
    </div>
  )
  return user ? <TeamGate>{children}</TeamGate> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/" replace /> : <>{children}</>
}

// 現在のチームがあるときだけ投稿モーダルを出す。チームが変わるとフォームの state ごと作り直す
function RecordModalHost() {
  const { currentTeam } = useTeam()
  if (!currentTeam) return null
  return <RecordModal key={currentTeam.teamId} />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RecordProvider>
          <TeamProvider>
            <RecordModalHost />
            <Routes>
              <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
              <Route path="/" element={<PrivateRoute><HomePage /></PrivateRoute>} />
              <Route path="/team" element={<PrivateRoute><TeamPage /></PrivateRoute>} />
              <Route path="/mypage" element={<PrivateRoute><MyPage /></PrivateRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </TeamProvider>
        </RecordProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
