import { useState } from 'react'
import { supabase } from './supabase'

function UsernameSetup({ userId, onComplete, onSkip }) {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isValid = /^[a-zA-Z0-9_]{3,20}$/.test(username)

  function handleChange(e) {
    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
    setError('')
  }

  async function handleSubmit() {
    if (!isValid) return
    setLoading(true)
    const { error } = await supabase.from('profiles').insert({ user_id: userId, username })
    if (error) {
      setError(error.code === '23505' ? 'That username is already taken.' : error.message)
    } else {
      onComplete(username)
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div style={{
        width: '100%', maxWidth: '420px',
        border: '1px solid var(--border)', borderRadius: '12px',
        padding: '40px 36px', background: 'var(--surface)',
        display: 'flex', flexDirection: 'column', gap: '20px',
      }}>
        <div>
          <h2 style={{ margin: 0, marginBottom: '6px' }}>Pick a username</h2>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.875rem', lineHeight: 1.5 }}>
            Your lists will be shareable at{' '}
            <span style={{ color: 'var(--subtle)' }}>
              spindown.app/u/{username || 'you'}/2024
            </span>
          </p>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '500', color: 'var(--subtle)', marginBottom: '6px' }}>
            Username
          </label>
          <input
            type="text"
            placeholder="yourname"
            value={username}
            onChange={handleChange}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            disabled={loading}
            maxLength={20}
            autoFocus
            style={{ display: 'block', width: '100%' }}
          />
          <p style={{ margin: '6px 0 0', fontSize: '0.72rem', color: 'var(--muted)' }}>
            3–20 characters. Letters, numbers, and underscores only.
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !isValid}
          style={{
            width: '100%', padding: '12px',
            fontSize: '0.95rem', fontWeight: '600',
            opacity: loading || !isValid ? 0.55 : 1,
          }}
        >
          {loading ? 'Saving…' : 'Save username'}
        </button>

        {error && (
          <p style={{ margin: 0, fontSize: '0.85rem', textAlign: 'center', color: '#e05c5c' }}>
            {error}
          </p>
        )}

        <p style={{ margin: 0, textAlign: 'center', fontSize: '0.8rem', color: 'var(--muted)' }}>
          <button
            onClick={onSkip}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
          >
            Skip for now
          </button>
        </p>
      </div>
    </div>
  )
}

export default UsernameSetup
