import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const AGE_GROUPS = [
  { value: '10s', label: '10代' },
  { value: '20s', label: '20代' },
  { value: '30s', label: '30代' },
  { value: '40s', label: '40代' },
  { value: '50s', label: '50代' },
  { value: '60s', label: '60代以上' },
]

const inputCls = 'w-full bg-sp-card border border-sp-border text-white rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-sp-muted'
const selectCls = 'w-full bg-sp-card border border-sp-border text-white rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40'

export default function RegisterPage() {
  const { register, confirmEmail } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<'form' | 'confirm'>('form')
  const [pendingEmail, setPendingEmail] = useState('')
  const [confirmCode, setConfirmCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    gender: 'other',
    ageGroup: '30s',
  })

  function handleChange(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await register(form)
      if (result.nextStep === 'CONFIRM_SIGN_UP') {
        setPendingEmail(form.email)
        setStep('confirm')
      } else {
        navigate('/')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '登録に失敗しました'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await confirmEmail(pendingEmail, confirmCode)
      navigate('/login')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '確認コードが正しくありません'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (step === 'confirm') {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-sp-card border border-sp-border text-4xl mb-5">📧</div>
            <h1 className="text-2xl font-black text-white">メールを確認</h1>
            <p className="text-sp-muted text-sm mt-2">{pendingEmail} に確認コードを送りました</p>
          </div>
          <div className="bg-sp-card rounded-3xl border border-sp-border p-6">
            {error && (
              <div className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm rounded-2xl px-4 py-3 mb-5">{error}</div>
            )}
            <form onSubmit={handleConfirm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-sp-muted mb-1.5 uppercase tracking-wide">確認コード</label>
                <input
                  type="text"
                  value={confirmCode}
                  onChange={e => setConfirmCode(e.target.value)}
                  required
                  inputMode="numeric"
                  className="w-full bg-sp-card2 border-0 text-white rounded-2xl px-4 py-3.5 text-lg text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-sp-muted"
                  placeholder="123456"
                />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-primary text-white rounded-2xl py-4 font-black transition-opacity disabled:opacity-60">
                {loading ? '確認中...' : '確認する'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary text-white text-4xl mb-5 shadow-lg shadow-primary/40">
            🏃
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">新規登録</h1>
          <p className="text-sp-muted text-sm mt-2 tracking-widest uppercase">Join the Club</p>
        </div>

        <div className="bg-sp-card rounded-3xl border border-sp-border p-6">
          {error && (
            <div className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm rounded-2xl px-4 py-3 mb-5">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-sp-muted mb-1.5 uppercase tracking-wide">名前</label>
              <input type="text" value={form.name} onChange={e => handleChange('name', e.target.value)}
                required className={inputCls} placeholder="田中さん" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-sp-muted mb-1.5 uppercase tracking-wide">メールアドレス</label>
              <input type="email" value={form.email} onChange={e => handleChange('email', e.target.value)}
                required className={inputCls} placeholder="example@email.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-sp-muted mb-1.5 uppercase tracking-wide">パスワード</label>
              <input type="password" value={form.password} onChange={e => handleChange('password', e.target.value)}
                required minLength={8} className={inputCls} placeholder="例：Bescon2024" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-sp-muted mb-1.5 uppercase tracking-wide">性別</label>
                <select value={form.gender} onChange={e => handleChange('gender', e.target.value)} className={selectCls}>
                  <option value="male">男性</option>
                  <option value="female">女性</option>
                  <option value="other">その他</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-sp-muted mb-1.5 uppercase tracking-wide">年代</label>
                <select value={form.ageGroup} onChange={e => handleChange('ageGroup', e.target.value)} className={selectCls}>
                  {AGE_GROUPS.map(a => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-sp-muted">※ パスワードは大文字・小文字・数字を含む8文字以上</p>
            <p className="text-xs text-sp-muted">※ 性別・年代は消費カロリーの計算にのみ使用します</p>
            <button type="submit" disabled={loading}
              className="w-full bg-primary text-white rounded-2xl py-4 font-black transition-opacity disabled:opacity-60 mt-1">
              {loading ? '登録中...' : '登録する'}
            </button>
          </form>

          <p className="text-center text-sm text-sp-muted mt-5">
            すでにアカウントをお持ちの方は{' '}
            <Link to="/login" className="text-primary font-bold">ログイン</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
