import { useEffect, useState } from 'react'
import { supabase } from './supabase'

function CoverImage({ src, alt }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <div style={{ width: 52, height: 52, background: 'var(--border)', flexShrink: 0, borderRadius: '5px' }} />
  return (
    <img
      src={src} alt={alt} width={52} height={52}
      style={{ objectFit: 'cover', flexShrink: 0, borderRadius: '5px' }}
      onError={() => setFailed(true)}
    />
  )
}

function ListeningQueue({ userId, onAdd, refreshTrigger, year, onViewAll }) {
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(null)

  useEffect(() => {
    fetchQueue()
  }, [refreshTrigger, year])

  async function fetchQueue() {
    setLoading(true)
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
    }, 350)
  }

  async function handleSkip(id) {
    await supabase.from('listening_queue').update({ status: 'declined' }).eq('id', id)
    setQueue(q => q.filter(i => i.id !== id))
  }

  const preview = queue.slice(0, 3)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
        <h2 style={{ margin: 0 }}>Up Next</h2>
        {!loading && queue.length > 0 && (
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: '500' }}>
            {queue.length} pending
          </span>
        )}
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: '4px', marginBottom: '16px', lineHeight: '1.5' }}>
        Albums to listen to and add to your list.
      </p>

      {loading && <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Loading…</p>}

      {!loading && queue.length === 0 && (
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', lineHeight: '1.6' }}>
          Add albums to your list to get recommendations for what to listen to next.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {preview.map((item) => (
          <div
            key={item.id}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '10px',
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              opacity: completing === item.id ? 0 : 1,
              transform: completing === item.id ? 'scale(0.97)' : 'scale(1)',
              transition: 'opacity 0.3s ease, transform 0.3s ease',
            }}
          >
            <CoverImage src={item.cover_url} alt={item.title} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '600', fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.title}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.artist}
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button
                  onClick={() => handleComplete(item)}
                  style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                >
                  + Add
                </button>
                <button
                  onClick={() => handleSkip(item.id)}
                  style={{ fontSize: '0.72rem', padding: '3px 8px', color: 'var(--muted)', borderColor: 'transparent', background: 'transparent' }}
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!loading && queue.length > 0 && (
        <button
          onClick={onViewAll}
          style={{
            width: '100%',
            marginTop: '10px',
            padding: '9px',
            fontSize: '0.82rem',
            color: 'var(--muted)',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
        >
          View all {queue.length} →
        </button>
      )}
    </div>
  )
}

export default ListeningQueue
