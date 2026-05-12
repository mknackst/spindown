import { useEffect, useRef, useState } from 'react'

function AlbumSearch({ onAdd, year }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchedQuery, setSearchedQuery] = useState('')
  const [filterByYear, setFilterByYear] = useState(true)
  const [added, setAdded] = useState(new Set())
  const [fading, setFading] = useState(new Set())
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

  function handleAdd(album) {
    setAdded(prev => new Set(prev).add(album.id))
    onAdd({
      title: album.title,
      artist: album['artist-credit']?.[0]?.name || 'Unknown Artist',
      mbid: album.id,
      cover_url: `https://coverartarchive.org/release-group/${album.id}/front`,
    })
    setTimeout(() => {
      setFading(prev => new Set(prev).add(album.id))
      setTimeout(() => setResults(prev => prev.filter(r => r.id !== album.id)), 300)
    }, 800)
  }

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true)
    setSearchedQuery(query)
    const q = (year && filterByYear) ? `${query} AND firstreleasedate:${year}` : query
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
          <label
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              fontSize: '1.25rem', padding: '16px 20px',
              flexShrink: 0, cursor: 'pointer', userSelect: 'none',
              border: '1px solid', borderRadius: 'var(--radius)',
              borderColor: filterByYear ? 'var(--border-hover)' : 'var(--border)',
              background: filterByYear ? 'var(--surface-raised)' : 'var(--surface)',
              color: filterByYear ? 'var(--text)' : 'var(--muted)',
              transition: 'border-color 0.1s, background 0.1s, color 0.1s',
            }}
            onMouseEnter={e => { if (!filterByYear) { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-raised)' } }}
            onMouseLeave={e => { if (!filterByYear) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'var(--surface)' } }}
          >
            <input type="checkbox" checked={filterByYear} onChange={e => setFilterByYear(e.target.checked)} style={{ display: 'none' }} />
            {year} only
          </label>
        )}
      </div>

      {loading && <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '12px' }}>Searching…</p>}

      {!loading && searchedQuery && results.length === 0 && (
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '12px' }}>
          No albums found for &ldquo;{searchedQuery}&rdquo;.
        </p>
      )}

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
                opacity: fading.has(album.id) ? 0 : 1,
                transition: 'opacity 0.3s ease',
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
                onClick={() => handleAdd(album)}
                disabled={added.has(album.id)}
                style={{
                  flexShrink: 0,
                  ...(added.has(album.id) ? {
                    color: '#4caf85', borderColor: 'rgba(76,175,133,0.4)',
                    background: 'rgba(76,175,133,0.08)', cursor: 'default',
                  } : {}),
                }}
              >
                {added.has(album.id) ? '✓ Added' : '+ Add'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default AlbumSearch
