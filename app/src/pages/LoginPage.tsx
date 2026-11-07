import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-app-bg flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary text-white text-4xl mb-5 shadow-lg shadow-primary/40">
            🏃
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">ベスコン<br/>グルメ部</h1>
          <p className="text-sp-muted text-sm mt-2 font-medium tracking-widest uppercase">Members Only</p>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm rounded-2xl px-4 py-3 mb-5">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="メールアドレス"
            className="w-full bg-sp-card border border-sp-border text-white rounded-2xl px-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition placeholder:text-sp-muted"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            placeholder="パスワード"
            className="w-full bg-sp-card border border-sp-border text-white rounded-2xl px-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition placeholder:text-sp-muted"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white rounded-2xl py-4 text-base font-black tracking-wide hover:bg-primary-dark transition-colors disabled:opacity-60 shadow-lg shadow-primary/30 mt-2"
          >
            {loading ? 'ログイン中...' : 'START'}
          </button>
        </form>

        <p className="text-center text-sm text-sp-muted mt-6">
          アカウントをお持ちでない方は{' '}
          <Link to="/register" className="text-primary font-bold">新規登録</Link>
        </p>
      </div>
    </div>
  )
}
