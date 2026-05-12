import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

const CURRENT_YEAR = new Date().getFullYear()
const ALL_YEARS = Array.from({ length: CURRENT_YEAR - 1899 }, (_, i) => CURRENT_YEAR - i) // current year → 1900
const ITEM_H = 52
const VISIBLE = 5

function YearWheel({ existingYears, onSelect, onCancel }) {
  const [selected, setSelected] = useState(CURRENT_YEAR)
  const scrollRef = useRef(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const idx = ALL_YEARS.indexOf(CURRENT_YEAR)
    el.scrollTop = idx * ITEM_H

    function onScroll() {
      const idx = Math.round(el.scrollTop / ITEM_H)
      const clamped = Math.max(0, Math.min(idx, ALL_YEARS.length - 1))
      setSelected(ALL_YEARS[clamped])
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const containerH = ITEM_H * VISIBLE
  const padH = ITEM_H * Math.floor(VISIBLE / 2)

  return (
    <div style={{ maxWidth: '320px' }}>
      <div style={{ position: 'relative', height: containerH, overflow: 'hidden', borderRadius: '10px', border: '1px solid var(--border)' }}>
        {/* Top fade */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: padH, background: 'linear-gradient(to bottom, var(--bg, #0a0a0a) 10%, transparent)', pointerEvents: 'none', zIndex: 2 }} />
        {/* Bottom fade */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: padH, background: 'linear-gradient(to top, var(--bg, #0a0a0a) 10%, transparent)', pointerEvents: 'none', zIndex: 2 }} />
        {/* Selection band */}
        <div style={{ position: 'absolute', top: padH, left: 0, right: 0, height: ITEM_H, borderTop: '1px solid var(--border-hover)', borderBottom: '1px solid var(--border-hover)', pointerEvents: 'none', zIndex: 2 }} />

        <div
          ref={scrollRef}
          style={{
            height: '100%',
            overflowY: 'scroll',
            scrollSnapType: 'y mandatory',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div style={{ height: padH }} />
          {ALL_YEARS.map(year => {
            const isSelected = year === selected
            const exists = existingYears.includes(year)
            return (
              <div
                key={year}
                onClick={() => {
                  const idx = ALL_YEARS.indexOf(year)
                  scrollRef.current?.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' })
                  setSelected(year)
                }}
                style={{
                  height: ITEM_H,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  scrollSnapAlign: 'center',
                  fontSize: isSelected ? '1.6rem' : '1rem',
                  fontWeight: isSelected ? '700' : '400',
                  color: isSelected ? 'var(--text)' : 'var(--muted)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'font-size 0.12s, color 0.12s',
                  letterSpacing: isSelected ? '-0.02em' : '0',
                }}
              >
                {year}
                {exists && (
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent, #7c6fcd)', flexShrink: 0, marginTop: 2 }} />
                )}
              </div>
            )
          })}
          <div style={{ height: padH }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        <button
          onClick={() => onSelect(selected)}
          style={{ flex: 1, padding: '12px', fontSize: '0.95rem' }}
        >
          {existingYears.includes(selected) ? `Open ${selected} list` : `Create ${selected} list`}
        </button>
        <button
          onClick={onCancel}
          style={{ color: 'var(--muted)', borderColor: 'transparent', background: 'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-raised)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function Dashboard({ userId, onOpenList, onOpenAssignments }) {
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchLists()
  }, [])

  async function fetchLists() {
    const [albumsRes, queueRes] = await Promise.all([
      supabase.from('albums').select('year, cover_url, rank').eq('user_id', userId).order('rank', { ascending: true }),
      supabase.from('listening_queue').select('year').eq('user_id', userId).eq('status', 'pending'),
    ])

    if (albumsRes.error) { console.error(albumsRes.error); setLoading(false); return }

    const yearMap = {}
    for (const { year, cover_url } of albumsRes.data || []) {
      if (!yearMap[year]) yearMap[year] = { year, count: 0, covers: [], assignments: 0 }
      yearMap[year].count++
      if (yearMap[year].covers.length < 4 && cover_url) yearMap[year].covers.push(cover_url)
    }

    for (const { year } of queueRes.data || []) {
      if (yearMap[year]) yearMap[year].assignments++
    }

    setLists(Object.values(yearMap).sort((a, b) => b.year - a.year))
    setLoading(false)
  }

  const existingYears = lists.map(l => l.year)

  function handleSelect(year) {
    setCreating(false)
    onOpenList(year)
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading…</p>

  if (lists.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '55vh' }}>
        {creating ? (
          <YearWheel existingYears={existingYears} onSelect={handleSelect} onCancel={() => setCreating(false)} />
        ) : (
          <>
            <button
              onClick={() => setCreating(true)}
              style={{ fontSize: '1rem', padding: '16px 40px', borderRadius: '8px' }}
            >
              + Create a list
            </button>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '12px' }}>
              Start building your {CURRENT_YEAR} year-end album list
            </p>
          </>
        )}
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ marginBottom: '24px' }}>My Lists</h2>

      {creating && (
        <div style={{ marginBottom: '32px' }}>
          <YearWheel existingYears={existingYears} onSelect={handleSelect} onCancel={() => setCreating(false)} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
        {!creating && (
          <div
            onClick={() => setCreating(true)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && setCreating(true)}
            style={{
              border: '2px dashed #7c6fcd',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              aspectRatio: '1 / 1.28',
              color: '#7c6fcd',
              background: 'rgba(124,111,205,0.06)',
              transition: 'border-color 0.15s, color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#9d93d8'; e.currentTarget.style.color = '#9d93d8'; e.currentTarget.style.background = 'rgba(124,111,205,0.12)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#7c6fcd'; e.currentTarget.style.color = '#7c6fcd'; e.currentTarget.style.background = 'rgba(124,111,205,0.06)' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>New list</span>
          </div>
        )}

        {lists.map(({ year, count, covers, assignments }) => (
          <div
            key={year}
            onClick={() => onOpenList(year)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && onOpenList(year)}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
              overflow: 'hidden',
              color: 'var(--text)',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div style={{ width: '100%', aspectRatio: '1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', background: 'var(--border)' }}>
              {[0, 1, 2, 3].map(i => (
                covers[i]
                  ? <img key={i} src={covers[i]} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} onError={e => { e.target.style.background = 'var(--surface)' }} />
                  : <div key={i} style={{ width: '100%', aspectRatio: '1', background: 'var(--surface)' }} />
              ))}
            </div>
            <div style={{ padding: '14px' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: '700', letterSpacing: '-0.02em' }}>{year}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  {count} album{count !== 1 ? 's' : ''}
                </div>
                {assignments > 0 && (
                  <button
                    onClick={e => { e.stopPropagation(); onOpenAssignments(year) }}
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: '600',
                      padding: '2px 8px',
                      borderRadius: '20px',
                      background: 'var(--accent, #7c6fcd)',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      lineHeight: '1.6',
                    }}
                  >
                    {assignments} pending
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Dashboard
