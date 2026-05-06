import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { checkPitchforkUrl } from './pitchfork'

function CoverImage({ src, alt }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <div style={{ width: 80, height: 80, background: 'var(--border)', flexShrink: 0, borderRadius: '6px' }} />
  return (
    <img
      src={src} alt={alt} width={80} height={80}
      style={{ objectFit: 'cover', flexShrink: 0, borderRadius: '6px' }}
      onError={() => setFailed(true)}
    />
  )
}

function AssignmentBadge({ n }) {
  return (
    <div style={{
      width: '28px', height: '28px',
      borderRadius: '50%',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.7rem', fontWeight: '700',
      color: 'var(--muted)',
      flexShrink: 0,
    }}>
      {n}
    </div>
  )
}

function ListeningQueue({ userId, onAdd, refreshTrigger, year }) {
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [pitchforkLinks, setPitchforkLinks] = useState({})
  const fetchedIdsRef = useRef(new Set())
  const [completing, setCompleting] = useState(null)

  useEffect(() => {
    fetchQueue()
  }, [refreshTrigger, year])

  useEffect(() => {
    if (queue.length === 0) return
    let cancelled = false
    const toFetch = queue.filter(i => !fetchedIdsRef.current.has(i.id))
    if (toFetch.length === 0) return
    toFetch.forEach(i => fetchedIdsRef.current.add(i.id))

    async function fetchLinks() {
      for (const item of toFetch) {
        if (cancelled) break
        const url = await checkPitchforkUrl(item.artist, item.title)
        if (url && !cancelled) setPitchforkLinks(prev => ({ ...prev, [item.id]: url }))
        await new Promise(r => setTimeout(r, 300))
      }
    }

    fetchLinks()
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
    await onAdd({ title: item.title, artist: item.artist, mbid: item.mbid, cover_url: item.cover_url })
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

  const completed = queue.filter(i => i.status === 'completed').length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px' }}>
        <h2 style={{ margin: 0 }}>Listening Assignments</h2>
        {!loading && queue.length > 0 && (
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: '500' }}>
            {queue.length} pending
          </span>
        )}
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: '4px', marginBottom: '20px', lineHeight: '1.5' }}>
        Albums assigned for intentional listening. Add one to your list once you've given it a proper listen.
      </p>

      {loading && <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Loading…</p>}

      {!loading && queue.length === 0 && (
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', lineHeight: '1.6' }}>
          Add albums to your list to receive listening assignments.
        </p>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {queue.map((item, index) => (
          <li
            key={item.id}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '14px',
              opacity: completing === item.id ? 0 : 1,
              transform: completing === item.id ? 'scale(0.97)' : 'scale(1)',
              transition: 'opacity 0.35s ease, transform 0.35s ease',
            }}
          >
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', paddingTop: '2px' }}>
                <AssignmentBadge n={index + 1} />
              </div>

              <CoverImage src={item.cover_url} alt={item.title} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.title}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: item.reason ? '5px' : '10px' }}>
                  {item.artist}
                </div>

                {item.reason && (
                  <div style={{
                    fontSize: '0.72rem',
                    color: 'var(--muted)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '5px',
                    padding: '4px 8px',
                    marginBottom: '10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}>
                    <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
                      <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm.75 12.5h-1.5v-5h1.5v5zm0-6.5h-1.5V4.5h1.5V6z"/>
                    </svg>
                    Because you enjoy {item.reason}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleComplete(item)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      fontSize: '0.8rem', padding: '5px 12px',
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M13.5 2.5l-8 8-3-3L1 9l4.5 4.5 9.5-9.5z"/>
                    </svg>
                    Add to List
                  </button>
                  <button
                    onClick={() => handleSkip(item.id)}
                    style={{ fontSize: '0.8rem', padding: '5px 10px', color: 'var(--muted)', borderColor: 'transparent', background: 'transparent' }}
                  >
                    Skip
                  </button>
                  <a
                    href={pitchforkLinks[item.id] || `https://rateyourmusic.com/search?searchterm=${encodeURIComponent(item.artist + ' ' + item.title)}&searchtype=l`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
                    style={{ fontSize: '0.75rem', color: 'var(--muted)', textDecoration: 'none', transition: 'color 0.15s' }}
                  >
                    Read more →
                  </a>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ListeningQueue
