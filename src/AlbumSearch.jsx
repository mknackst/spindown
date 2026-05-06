import { useEffect, useRef, useState } from 'react'

function AlbumSearch({ onAdd, year }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [filterByYear, setFilterByYear] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setResults([])
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true)
    const q = (year && filterByYear) ? `${query} AND firstreleasdate:${year}` : query
    const res = await fetch(
      `https://musicbrainz.org/ws/2/release-group?query=${encodeURIComponent(q)}&type=album&fmt=json&limit=10`
    )
    const data = await res.json()
    setResults(data['release-groups'] || [])
    setLoading(false)
  }

  return (
    <div ref={containerRef}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search albums or artists…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          style={{ flex: 1, fontSize: '1.25rem', padding: '16px 20px' }}
        />
        <button onClick={handleSearch} style={{ flexShrink: 0, fontSize: '1.25rem', padding: '16px 28px' }}>Search</button>
        {year && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--muted)', cursor: 'pointer', flexShrink: 0 }}>
            <input type="checkbox" checked={filterByYear} onChange={e => setFilterByYear(e.target.checked)} />
            {year} only
          </label>
        )}
      </div>

      {loading && <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '12px' }}>Searching…</p>}

      {results.length > 0 && (
        <ul style={{ marginTop: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {results.map((album, i) => (
            <li
              key={album.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                background: 'var(--surface)',
              }}
            >
              <img
                src={`https://coverartarchive.org/release-group/${album.id}/front-250`}
                alt=""
                width={48}
                height={48}
                style={{ objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }}
                onError={e => { e.target.style.display = 'none' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '500', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {album.title}
                  {album['first-release-date'] && (
                    <span style={{ color: 'var(--muted)', fontWeight: '400', fontSize: '0.8rem', marginLeft: '8px' }}>
                      {album['first-release-date'].slice(0, 4)}
                    </span>
                  )}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                  {album['artist-credit']?.[0]?.name || 'Unknown Artist'}
                </div>
              </div>
              <button
                onClick={() => onAdd({
                  title: album.title,
                  artist: album['artist-credit']?.[0]?.name || 'Unknown Artist',
                  mbid: album.id,
                  cover_url: `https://coverartarchive.org/release-group/${album.id}/front`
                })}
                style={{ flexShrink: 0 }}
              >
                + Add
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default AlbumSearch
