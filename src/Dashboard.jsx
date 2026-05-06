import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const CURRENT_YEAR = new Date().getFullYear()

function Dashboard({ userId, onOpenList }) {
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newYear, setNewYear] = useState(CURRENT_YEAR)

  useEffect(() => {
    fetchLists()
  }, [])

  async function fetchLists() {
    const { data, error } = await supabase
      .from('albums')
      .select('year, cover_url, rank')
      .eq('user_id', userId)
      .order('rank', { ascending: true })

    if (error) { console.error(error); setLoading(false); return }

    const yearMap = {}
    for (const { year, cover_url } of data || []) {
      if (!yearMap[year]) yearMap[year] = { year, count: 0, coverUrl: null }
      yearMap[year].count++
      if (!yearMap[year].coverUrl && cover_url) yearMap[year].coverUrl = cover_url
    }

    setLists(Object.values(yearMap).sort((a, b) => b.year - a.year))
    setLoading(false)
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading…</p>

  if (lists.length === 0 && !creating) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '55vh' }}>
        <button
          onClick={() => setCreating(true)}
          style={{ fontSize: '1rem', padding: '16px 40px', borderRadius: '8px' }}
        >
          + Create a list
        </button>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '12px' }}>
          Start building your {CURRENT_YEAR} album list
        </p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>My Lists</h2>
        {!creating && <button onClick={() => setCreating(true)}>+ New list</button>}
      </div>

      {creating && (
        <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--subtle)' }}>Year</label>
          <input
            type="number"
            value={newYear}
            min={1900}
            max={2100}
            onChange={e => setNewYear(Number(e.target.value))}
            style={{ width: '90px' }}
            autoFocus
          />
          <button onClick={() => onOpenList(newYear)}>Create</button>
          <button onClick={() => setCreating(false)} style={{ color: 'var(--muted)', borderColor: 'transparent', background: 'transparent' }}>
            Cancel
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
        {lists.map(({ year, count, coverUrl }) => (
          <button
            key={year}
            onClick={() => onOpenList(year)}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
              overflow: 'hidden',
              color: 'var(--text)',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            {coverUrl
              ? <img src={coverUrl} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} onError={e => { e.target.style.display = 'none' }} />
              : <div style={{ width: '100%', aspectRatio: '1', background: 'var(--border)' }} />
            }
            <div style={{ padding: '14px' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: '700', letterSpacing: '-0.02em' }}>{year}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '2px' }}>
                {count} album{count !== 1 ? 's' : ''}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default Dashboard
