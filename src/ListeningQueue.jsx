import { useEffect, useState } from 'react'
import { supabase } from './supabase'

function CoverImage({ src, alt }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <div style={{ width: 72, height: 72, background: 'var(--border)', flexShrink: 0, borderRadius: '4px' }} />
  return (
    <img
      src={src} alt={alt} width={72} height={72}
      style={{ objectFit: 'cover', flexShrink: 0, borderRadius: '4px' }}
      onError={() => setFailed(true)}
    />
  )
}

function ListeningQueue({ userId, onAdd, refreshTrigger, year }) {
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchQueue()
  }, [refreshTrigger, year])

  async function fetchQueue() {
    const { data, error } = await supabase
      .from('listening_queue')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .eq('year', year)
      .order('created_at', { ascending: false })
    if (error) console.error(error)
    else setQueue(data || [])
    setLoading(false)
  }

  async function handleAccept(item) {
    await onAdd({ title: item.title, artist: item.artist, mbid: item.mbid, cover_url: item.cover_url })
    await supabase.from('listening_queue').update({ status: 'accepted' }).eq('id', item.id)
    setQueue(q => q.filter(i => i.id !== item.id))
  }

  async function handleDecline(id) {
    await supabase.from('listening_queue').update({ status: 'declined' }).eq('id', id)
    setQueue(q => q.filter(i => i.id !== id))
  }

  return (
    <div>
      <h2 style={{ marginBottom: '16px' }}>Listening Queue</h2>

      {loading && <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Loading…</p>}

      {!loading && queue.length === 0 && (
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', lineHeight: '1.6' }}>
          Add albums to your list to get recommendations here.
        </p>
      )}

      <ul>
        {queue.map(item => (
          <li key={item.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <CoverImage src={item.cover_url} alt={item.title} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '500', fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.title}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '8px' }}>
                {item.artist}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => handleAccept(item)}>+ Add</button>
                <button onClick={() => handleDecline(item.id)} style={{ color: 'var(--muted)', borderColor: 'transparent', background: 'transparent' }}>
                  Pass
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ListeningQueue
