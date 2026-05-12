import { useState } from 'react'
import { supabase } from './supabase'

function ResetPassword({ onComplete }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit() {
    setMessage('')
    if (password.length < 6) { setMessage('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setMessage("Passwords don't match."); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setMessage(error.message)
    else onComplete()
    setLoading(false)
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
          <h2 style={{ margin: 0, marginBottom: '6px' }}>Set new password</h2>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.875rem' }}>Choose a new password for your account.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '500', color: 'var(--subtle)', marginBottom: '6px' }}>
              New password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              disabled={loading}
              style={{ display: 'block', width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '500', color: 'var(--subtle)', marginBottom: '6px' }}>
              Confirm password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              disabled={loading}
              style={{ display: 'block', width: '100%' }}
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !password || !confirm}
          style={{
            width: '100%', padding: '12px',
            fontSize: '0.95rem', fontWeight: '600',
            opacity: loading || !password || !confirm ? 0.55 : 1,
          }}
        >
          {loading ? 'Please wait…' : 'Update password'}
        </button>

        {message && (
          <p style={{ margin: 0, fontSize: '0.85rem', textAlign: 'center', color: '#e05c5c' }}>
            {message}
          </p>
        )}
      </div>
    </div>
  )
}

export default ResetPassword
