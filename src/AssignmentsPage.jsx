import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { checkPitchforkUrl } from './pitchfork'

const PLATFORMS = [
  { id: 'spotify',  name: 'Spotify',     color: '#1DB954', search: (a, t) => `https://open.spotify.com/search/${encodeURIComponent(a + ' ' + t)}` },
  { id: 'apple',    name: 'Apple Music', color: '#FC3C44', search: (a, t) => `https://music.apple.com/search?term=${encodeURIComponent(a + ' ' + t)}` },
  { id: 'bandcamp', name: 'Bandcamp',    color: '#1DA0C3', search: (a, t) => `https://bandcamp.com/search?q=${encodeURIComponent(a + ' ' + t)}` },
  { id: 'qobuz',    name: 'Qobuz',       color: '#002DAA', search: (a, t) => `https://www.qobuz.com/search?q=${encodeURIComponent(a + ' ' + t)}` },
]

function AssignmentsPage({ userId, year, onAdd }) {
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [links, setLinks] = useState({})
  const [reviews, setReviews] = useState({})
  const [scores, setScores] = useState({})
  const [completing, setCompleting] = useState(null)
  const fetchedIdsRef = useRef(new Set())

  useEffect(() => { fetchQueue() }, [year])

  useEffect(() => {
    if (queue.length === 0) return
    let cancelled = false
    const toFetch = queue.filter(i => !fetchedIdsRef.current.has(i.id))
    if (toFetch.length === 0) return
    toFetch.forEach(i => fetchedIdsRef.current.add(i.id))

    async function fetchAppleLinks() {
      for (const item of toFetch) {
        if (cancelled) break
        try {
          const q = encodeURIComponent(`${item.artist} ${item.title}`)
          const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=album&limit=1`)
          const data = await res.json()
          const url = data.results?.[0]?.collectionViewUrl
          if (url && !cancelled) setLinks(prev => ({ ...prev, [item.id]: { ...prev[item.id], apple: url } }))
        } catch {}
        await new Promise(r => setTimeout(r, 200))
      }
    }

    async function fetchPitchforkLinks() {
      for (const item of toFetch) {
        if (cancelled) break
        const url = await checkPitchforkUrl(item.artist, item.title)
        if (url && !cancelled) setLinks(prev => ({ ...prev, [item.id]: { ...prev[item.id], pitchfork: url } }))
        await new Promise(r => setTimeout(r, 300))
      }
    }

    fetchAppleLinks()
    fetchPitchforkLinks()
    return () => { cancelled = true }
  }, [queue])

  async function fetchQueue() {
    const { data, error } = await supabase
      .from('listening_queue')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .eq('year', year)
      .order('created_at', { ascending: true })
    if (error) console.error(error)
    else setQueue(data || [])
    setLoading(false)
  }

  async function handleComplete(item) {
    setCompleting(item.id)
    await onAdd({
      title: item.title,
      artist: item.artist,
      mbid: item.mbid,
      cover_url: item.cover_url,
      review: reviews[item.id] || null,
      weighted_score: scores[item.id] || 0,
    })
    await supabase.from('listening_queue').update({ status: 'accepted' }).eq('id', item.id)
    setTimeout(() => {
      setCompleting(null)
      setQueue(q => q.filter(i => i.id !== item.id))
    }, 400)
  }

  async function handleSkip(id) {
    await supabase.from('listening_queue').update({ status: 'declined' }).eq('id', id)
    setQueue(q => q.filter(i => i.id !== id))
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading…</p>

  return (
    <div style={{ maxWidth: '680px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '6px' }}>
        <h2 style={{ margin: 0, fontSize: '2rem' }}>Listening Assignments</h2>
        {queue.length > 0 && (
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{queue.length} pending</span>
        )}
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '6px', marginBottom: '32px', lineHeight: '1.6' }}>
        Give each album a proper listen, then add it to your {year} list with a score and review.
      </p>

      {queue.length === 0 && (
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          No assignments right now — add more albums to your list to receive new ones.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {queue.map((item, index) => (
          <div
            key={item.id}
            style={{
              border: '1px solid var(--border)',
              borderRadius: '12px',
              background: 'var(--surface)',
              overflow: 'hidden',
              opacity: completing === item.id ? 0 : 1,
              transform: completing === item.id ? 'scale(0.98)' : 'scale(1)',
              transition: 'opacity 0.35s ease, transform 0.35s ease',
            }}
          >
            <div style={{ padding: '24px', display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {item.cover_url
                  ? <img src={item.cover_url} alt={item.title} width={120} height={120} style={{ objectFit: 'cover', borderRadius: '8px', display: 'block' }} />
                  : <div style={{ width: 120, height: 120, background: 'var(--border)', borderRadius: '8px' }} />
                }
                <div style={{
                  position: 'absolute', top: -8, left: -8,
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: '700', color: 'var(--muted)',
                }}>
                  {index + 1}
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '2px' }}>{item.title}</div>
                <div style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '12px' }}>{item.artist}</div>

                {item.reason && (
                  <div style={{
                    fontSize: '0.74rem', color: 'var(--muted)',
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: '6px', padding: '4px 10px',
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    marginBottom: '14px',
                  }}>
                    <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
                      <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm.75 12.5h-1.5v-5h1.5v5zm0-6.5h-1.5V4.5h1.5V6z"/>
                    </svg>
                    Because you enjoy {item.reason}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {PLATFORMS.map(p => {
                    const href = (p.id === 'apple' ? links[item.id]?.apple : null) || p.search(item.artist, item.title)
                    return (
                      <a
                        key={p.id}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '0.78rem', fontWeight: '600',
                          color: p.color,
                          border: `1px solid ${p.color}55`,
                          borderRadius: '20px',
                          padding: '5px 13px',
                          textDecoration: 'none',
                          background: 'transparent',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = `${p.color}18`}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {p.name}
                      </a>
                    )
                  })}
                  <a
                    href={links[item.id]?.pitchfork || `https://rateyourmusic.com/search?searchterm=${encodeURIComponent(item.artist + ' ' + item.title)}&searchtype=l`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.8rem', color: 'var(--muted)', textDecoration: 'none', transition: 'color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
                  >
                    Read more →
                  </a>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--subtle)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Score</div>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => {
                    const active = scores[item.id] === n
                    return (
                      <button
                        key={n}
                        onClick={() => setScores(s => ({ ...s, [item.id]: active ? 0 : n }))}
                        style={{
                          width: '34px', height: '34px', padding: 0,
                          fontSize: '0.875rem',
                          fontWeight: active ? '700' : '400',
                          background: active ? 'var(--text)' : 'var(--surface)',
                          color: active ? 'var(--bg)' : 'var(--muted)',
                          border: '1px solid',
                          borderColor: active ? 'var(--text)' : 'var(--border)',
                          borderRadius: '6px',
                          flexShrink: 0,
                        }}
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--subtle)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Review <span style={{ fontWeight: '400', color: 'var(--muted)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                </div>
                <textarea
                  placeholder="Your thoughts after listening…"
                  value={reviews[item.id] || ''}
                  onChange={e => setReviews(r => ({ ...r, [item.id]: e.target.value }))}
                  rows={3}
                  maxLength={280}
                  style={{ display: 'block', width: '100%' }}
                />
                {reviews[item.id]?.length > 0 && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textAlign: 'right', marginTop: '3px' }}>
                    {reviews[item.id].length} / 280
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => handleComplete(item)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 20px', fontSize: '0.9rem' }}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.5 2.5l-8 8-3-3L1 9l4.5 4.5 9.5-9.5z"/>
                  </svg>
                  Add to List
                </button>
                <button
                  onClick={() => handleSkip(item.id)}
                  style={{ padding: '9px 16px', fontSize: '0.9rem', color: 'var(--muted)', borderColor: 'transparent', background: 'transparent' }}
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AssignmentsPage
