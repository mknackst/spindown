import { useState } from 'react'

function AlbumSearch({ onAdd }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true)
    const res = await fetch(
      `https://musicbrainz.org/ws/2/release-group?query=${encodeURIComponent(query)}&type=album&fmt=json&limit=10`
    )
    const data = await res.json()
    setResults(data['release-groups'] || [])
    setLoading(false)
  }

  return (
    <div>
      <h2>Search Albums</h2>
      <input
        type="text"
        placeholder="Search by album or artist..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSearch()}
      />
      <button onClick={handleSearch}>Search</button>
      {loading && <p>Searching...</p>}
      <ul>
        {results.map(album => (
          <li key={album.id}>
            <strong>{album.title}</strong> — {album['artist-credit']?.[0]?.name || 'Unknown Artist'}
            <button onClick={() => onAdd({
              title: album.title,
              artist: album['artist-credit']?.[0]?.name || 'Unknown Artist',
              mbid: album.id,
              cover_url: null
            })}>
              + Add
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default AlbumSearch