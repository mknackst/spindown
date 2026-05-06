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
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function Dashboard({ userId, onOpenList }) {
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

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
      if (!yearMap[year]) yearMap[year] = { year, count: 0, covers: [] }
      yearMap[year].count++
      if (yearMap[year].covers.length < 4 && cover_url) yearMap[year].covers.push(cover_url)
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>My Lists</h2>
        {!creating && <button onClick={() => setCreating(true)}>+ New list</button>}
      </div>

      {creating && (
        <div style={{ marginBottom: '32px' }}>
          <YearWheel existingYears={existingYears} onSelect={handleSelect} onCancel={() => setCreating(false)} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
        {lists.map(({ year, count, covers }) => (
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
            <div style={{ width: '100%', aspectRatio: '1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', background: 'var(--border)' }}>
              {[0, 1, 2, 3].map(i => (
                covers[i]
                  ? <img key={i} src={covers[i]} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} onError={e => { e.target.style.background = 'var(--surface)' }} />
                  : <div key={i} style={{ width: '100%', aspectRatio: '1', background: 'var(--surface)' }} />
              ))}
            </div>
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
