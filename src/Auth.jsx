import { useState } from 'react'
import { supabase } from './supabase'

const linkBtn = {
  background: 'none', border: 'none', padding: 0,
  cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline',
}

function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const isSuccess = message.startsWith('Check') || message.startsWith('Reset')

  async function handleSubmit() {
    setMessage('')
    if (mode === 'forgot') {
      if (!email) return
      setLoading(true)
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) setMessage(error.message)
      else setMessage('Reset link sent — check your email.')
      setLoading(false)
      return
    }
    if (!email || !password) return
    setLoading(true)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage(error.message)
      else setMessage('Check your email to confirm your account!')
    }
    setLoading(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSubmit()
  }

  function switchMode(next) {
    setMode(next)
    setMessage('')
  }

  const titles = { login: 'Welcome back', signup: 'Create account', forgot: 'Reset password' }
  const subtitles = {
    login: 'Log in to your Spindown account.',
    signup: 'Start building your year-end lists.',
    forgot: 'Enter your email to receive a reset link.',
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div style={{
        width: '100%', maxWidth: '400px',
        border: '1px solid var(--border)', borderRadius: '12px',
        padding: '40px 36px', background: 'var(--surface)',
        display: 'flex', flexDirection: 'column', gap: '20px',
      }}>
        <div>
          <h2 style={{ margin: 0, marginBottom: '6px' }}>{titles[mode]}</h2>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.875rem' }}>{subtitles[mode]}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '500', color: 'var(--subtle)', marginBottom: '6px' }}>
              Email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              style={{ display: 'block', width: '100%' }}
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--subtle)' }}>
                  Password
                </label>
                {mode === 'login' && (
                  <button onClick={() => switchMode('forgot')} style={{ ...linkBtn, color: 'var(--muted)', fontSize: '0.75rem' }}>
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                style={{ display: 'block', width: '100%' }}
              />
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !email || (mode !== 'forgot' && !password)}
          style={{
            width: '100%', padding: '12px',
            fontSize: '0.95rem', fontWeight: '600',
            opacity: loading || !email || (mode !== 'forgot' && !password) ? 0.55 : 1,
          }}
        >
          {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
        </button>

        {message && (
          <p style={{ margin: 0, fontSize: '0.85rem', textAlign: 'center', color: isSuccess ? '#4caf85' : '#e05c5c' }}>
            {message}
          </p>
        )}

        <p style={{ margin: 0, textAlign: 'center', fontSize: '0.85rem', color: 'var(--muted)' }}>
          {mode === 'forgot' ? (
            <>Remember it? <button onClick={() => switchMode('login')} style={{ ...linkBtn, color: 'var(--text)', fontWeight: '600' }}>Back to log in</button></>
          ) : mode === 'login' ? (
            <>Don&apos;t have an account? <button onClick={() => switchMode('signup')} style={{ ...linkBtn, color: 'var(--text)', fontWeight: '600' }}>Sign up</button></>
          ) : (
            <>Already have an account? <button onClick={() => switchMode('login')} style={{ ...linkBtn, color: 'var(--text)', fontWeight: '600' }}>Log in</button></>
          )}
        </p>
      </div>
    </div>
  )
}

export default Auth
