import { useEffect, useState } from 'react'
import { supabase } from './supabase'

function Avatar({ profile, size = 24 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0, background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt="" width={size} height={size} style={{ objectFit: 'cover', display: 'block' }} />
        : <span style={{ fontSize: `${size * 0.42}px`, fontWeight: '600', color: 'var(--muted)' }}>{profile?.username?.[0]?.toUpperCase() || '?'}</span>
      }
    </div>
  )
}

// albumId XOR (listOwnerId + listYear)
function CommentThread({ albumId, listOwnerId, listYear, currentUserId }) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState([])
  const [profileMap, setProfileMap] = useState({})
  const [loading, setLoading] = useState(false)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) load()
  }, [open])

  async function load() {
    setLoading(true)
    let query = supabase.from('comments').select('*').order('created_at', { ascending: true })
    if (albumId) {
      query = query.eq('album_id', albumId)
    } else {
      query = query.is('album_id', null).eq('list_owner_id', listOwnerId).eq('list_year', listYear)
    }
    const { data } = await query
    if (!data?.length) { setComments([]); setLoading(false); return }

    const userIds = [...new Set(data.map(c => c.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, avatar_url')
      .in('user_id', userIds)
    setProfileMap(Object.fromEntries((profiles || []).map(p => [p.user_id, p])))
    setComments(data)
    setLoading(false)
  }

  async function handleSubmit() {
    if (!body.trim() || !currentUserId || submitting) return
    setSubmitting(true)
    const row = { user_id: currentUserId, body: body.trim() }
    if (albumId) row.album_id = albumId
    else { row.list_owner_id = listOwnerId; row.list_year = listYear }

    const { data: newComment, error } = await supabase.from('comments').insert(row).select().single()
    if (!error && newComment) {
      if (!profileMap[currentUserId]) {
        const { data: p } = await supabase.from('profiles').select('user_id, username, avatar_url').eq('user_id', currentUserId).single()
        if (p) setProfileMap(prev => ({ ...prev, [p.user_id]: p }))
      }
      setComments(prev => [...prev, newComment])
      setBody('')
    }
    setSubmitting(false)
  }

  async function handleDelete(id) {
    await supabase.from('comments').delete().eq('id', id)
    setComments(prev => prev.filter(c => c.id !== id))
  }

  const label = albumId ? 'Comments' : 'Discussion'

  return (
    <div style={{ marginTop: '10px' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', padding: 0, color: 'var(--muted)', cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px', transition: 'color 0.1s' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        {label}
        <span style={{ fontSize: '0.7rem' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ marginTop: '10px', paddingLeft: '14px', borderLeft: '2px solid var(--border)' }}>
          {loading && <p style={{ color: 'var(--muted)', fontSize: '0.8rem', margin: 0 }}>Loading…</p>}

          {!loading && comments.length === 0 && (
            <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: '0.78rem' }}>No comments yet.</p>
          )}

          {comments.map(c => {
            const profile = profileMap[c.user_id]
            const isOwn = c.user_id === currentUserId
            return (
              <div key={c.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '10px' }}>
                <Avatar profile={profile} size={24} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.75rem', marginBottom: '2px', display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: '600', color: 'var(--text)' }}>@{profile?.username || 'unknown'}</span>
                    <span style={{ color: 'var(--muted)' }}>{new Date(c.created_at).toLocaleDateString()}</span>
                    {isOwn && (
                      <button
                        onClick={() => handleDelete(c.id)}
                        style={{ background: 'none', border: 'none', padding: 0, color: 'var(--muted)', cursor: 'pointer', fontSize: '0.72rem', transition: 'color 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#e05c5c'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--subtle)', lineHeight: 1.55 }}>{c.body}</p>
                </div>
              </div>
            )
          })}

          {currentUserId ? (
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <input
                type="text"
                placeholder="Add a comment…"
                value={body}
                onChange={e => setBody(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                maxLength={500}
                style={{ flex: 1, fontSize: '0.82rem', padding: '6px 10px' }}
              />
              <button
                onClick={handleSubmit}
                disabled={!body.trim() || submitting}
                style={{ flexShrink: 0, fontSize: '0.82rem', padding: '6px 14px' }}
              >
                Post
              </button>
            </div>
          ) : (
            <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>
              <a href="/" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Sign in</a> to comment.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default CommentThread
