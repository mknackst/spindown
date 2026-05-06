import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { checkPitchforkUrl } from './pitchfork'

const PLATFORMS = [
  { id: 'spotify',  name: 'Spotify',     color: '#1DB954', search: (a, t) => `https://open.spotify.com/search/${encodeURIComponent(a + ' ' + t)}` },
  { id: 'apple',    name: 'Apple Music', color: '#FC3C44', search: (a, t) => `https://music.apple.com/search?term=${encodeURIComponent(a + ' ' + t)}` },
  { id: 'bandcamp', name: 'Bandcamp',    color: '#1DA0C3', search: (a, t) => `https://bandcamp.com/search?q=${encodeURIComponent(a + ' ' + t)}` },
  { id: 'qobuz',    name: 'Qobuz',       color: '#002DAA', search: (a, t) => `https://www.qobuz.com/search?q=${encodeURIComponent(a + ' ' + t)}` },
]

async function findItunesArt(artist, title) {
  try {
    const q = encodeURIComponent(`${artist} ${title}`)
    const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=album&limit=1`)
    const data = await res.json()
    const url = data.results?.[0]?.artworkUrl100
    return url ? url.replace('100x100bb', '600x600bb') : null
  } catch {
    return null
  }
}

function AlbumList({ userId, year }) {
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [dragFrom, setDragFrom] = useState(null)
  const [dragTo, setDragTo] = useState(null)

  const albumsRef = useRef([])
  const triedItunesRef = useRef(new Set())
  useEffect(() => { albumsRef.current = albums }, [albums])

  const [platformLinks, setPlatformLinks] = useState({})
  const fetchedIdsRef = useRef(new Set())

  useEffect(() => {
    fetchAlbums()
  }, [])

  useEffect(() => {
    if (albums.length === 0) return
    let cancelled = false
    const toFetch = albums.filter(a => !fetchedIdsRef.current.has(a.id))
    if (toFetch.length === 0) return
    toFetch.forEach(a => fetchedIdsRef.current.add(a.id))

    async function fetchAppleLinks() {
      for (const album of toFetch) {
        if (cancelled) break
        try {
          const q = encodeURIComponent(`${album.artist} ${album.title}`)
          const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=album&limit=1`)
          const data = await res.json()
          const url = data.results?.[0]?.collectionViewUrl
          if (url && !cancelled) setPlatformLinks(prev => ({ ...prev, [album.id]: { ...prev[album.id], apple: url } }))
        } catch {}
        await new Promise(r => setTimeout(r, 200))
      }
    }

    async function fetchPitchforkLinks() {
      for (const album of toFetch) {
        if (cancelled) break
        const url = await checkPitchforkUrl(album.artist, album.title)
        if (url && !cancelled) setPlatformLinks(prev => ({ ...prev, [album.id]: { ...prev[album.id], pitchfork: url } }))
        await new Promise(r => setTimeout(r, 300))
      }
    }

    fetchAppleLinks()
    fetchPitchforkLinks()
    return () => { cancelled = true }
  }, [albums])

  async function fetchAlbums() {
    const { data, error } = await supabase
      .from('albums')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year)
      .order('rank', { ascending: true })
    if (error) console.error(error)
    else setAlbums(data)
    setLoading(false)
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('albums').delete().eq('id', id)
    if (error) console.error(error)
    else setAlbums(albums.filter(a => a.id !== id))
  }

  function getDisplayIndex(actualIndex) {
    if (dragFrom === null || dragTo === null) return actualIndex
    if (actualIndex === dragFrom) return dragTo
    if (dragFrom < dragTo && actualIndex > dragFrom && actualIndex <= dragTo) return actualIndex - 1
    if (dragFrom > dragTo && actualIndex >= dragTo && actualIndex < dragFrom) return actualIndex + 1
    return actualIndex
  }

  function handleDragUpdate(update) {
    if (!update.destination) { setDragFrom(null); setDragTo(null); return }
    setDragFrom(update.source.index)
    setDragTo(update.destination.index)
  }

  async function handleDragEnd(result) {
    setDragFrom(null)
    setDragTo(null)
    if (!result.destination) return
    const reordered = Array.from(albums)
    const [moved] = reordered.splice(result.source.index, 1)
    reordered.splice(result.destination.index, 0, moved)
    const updated = reordered.map((a, i) => ({ ...a, rank: i + 1 }))
    setAlbums(updated)
    for (const album of updated) {
      await supabase.from('albums').update({ rank: album.rank }).eq('id', album.id)
    }
  }

  function handleReviewChange(id, review) {
    setAlbums(albums.map(a => a.id === id ? { ...a, review } : a))
  }

  async function handleReviewBlur(id, review) {
    await supabase.from('albums').update({ review }).eq('id', id)
  }

  function handleScoreChange(id, value) {
    setAlbums(albumsRef.current.map(a => a.id === id ? { ...a, weighted_score: Number(value) } : a))
  }

  async function handleScoreCommit(id, value) {
    const score = Math.min(10, Math.max(1, Number(value)))
    setAlbums(albumsRef.current.map(a => a.id === id ? { ...a, weighted_score: score } : a))
    await supabase.from('albums').update({ weighted_score: score }).eq('id', id)
  }

  async function handleCoverError(id, artist, title, imgEl) {
    if (triedItunesRef.current.has(id)) { imgEl.style.display = 'none'; return }
    triedItunesRef.current.add(id)
    const art = await findItunesArt(artist, title)
    if (art) {
      imgEl.src = art
      await supabase.from('albums').update({ cover_url: art }).eq('id', id)
      setAlbums(prev => prev.map(a => a.id === id ? { ...a, cover_url: art } : a))
    } else {
      imgEl.style.display = 'none'
    }
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading...</p>
  if (albums.length === 0) return <p style={{ color: 'var(--muted)' }}>No albums yet — search and add some!</p>

  return (
    <div>
      <h2 style={{ marginBottom: '16px', fontSize: '2rem' }}>My {year} Year-End List</h2>

      <DragDropContext onDragEnd={handleDragEnd} onDragUpdate={handleDragUpdate}>
        <Droppable droppableId="album-list">
          {(provided) => (
            <ul {...provided.droppableProps} ref={provided.innerRef}>
              {albums.map((album, index) => {
                return (
                  <Draggable key={album.id} draggableId={album.id} index={index}>
                    {(provided) => (
                      <li
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        style={{
                          ...provided.draggableProps.style,
                          display: 'flex',
                          gap: '16px',
                          alignItems: 'flex-start',
                          padding: index === 0 ? '20px 16px' : '16px 0',
                          marginLeft: index === 0 ? '-16px' : '0',
                          marginRight: index === 0 ? '-16px' : '0',
                          borderBottom: '1px solid var(--border)',
                          borderRadius: index === 0 ? '10px' : '0',
                          background: index === 0 ? 'linear-gradient(135deg, rgba(200,160,60,0.1) 0%, rgba(200,160,60,0.04) 100%)' : 'transparent',
                          boxShadow: index === 0 ? 'inset 0 0 0 1px rgba(200,160,60,0.25)' : 'none',
                          cursor: 'grab',
                          position: 'relative',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, paddingTop: '6px' }}>
                          <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" style={{ color: 'var(--border-hover)', flexShrink: 0 }}>
                            <circle cx="3" cy="2.5" r="1.5"/>
                            <circle cx="3" cy="8" r="1.5"/>
                            <circle cx="3" cy="13.5" r="1.5"/>
                            <circle cx="7" cy="2.5" r="1.5"/>
                            <circle cx="7" cy="8" r="1.5"/>
                            <circle cx="7" cy="13.5" r="1.5"/>
                          </svg>
                          <span style={{ width: '36px', textAlign: 'right', color: index === 0 ? '#c8a03c' : 'var(--subtle)', fontSize: index === 0 ? '2.2rem' : '1.8rem', fontWeight: '700', letterSpacing: '-0.03em', lineHeight: 1 }}>
                            {getDisplayIndex(index) + 1}
                          </span>
                        </div>

                        <img
                          src={album.cover_url || `https://coverartarchive.org/release-group/${album.mbid}/front`}
                          alt={album.title}
                          width={index === 0 ? 170 : 150}
                          height={index === 0 ? 170 : 150}
                          style={{ objectFit: 'cover', flexShrink: 0, borderRadius: index === 0 ? '6px' : '4px', boxShadow: index === 0 ? '0 4px 20px rgba(0,0,0,0.4)' : 'none' }}
                          onError={e => handleCoverError(album.id, album.artist, album.title, e.target)}
                        />

                        <button
                          onClick={() => handleDelete(album.id)}
                          title="Remove"
                          style={{
                            position: 'absolute', top: '12px', right: '0',
                            width: '30px', height: '30px',
                            padding: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.1rem', lineHeight: 1,
                            color: '#e05c5c',
                            background: 'rgba(224,92,92,0.1)',
                            border: '1px solid rgba(224,92,92,0.25)',
                            borderRadius: '50%',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(224,92,92,0.22)'; e.currentTarget.style.borderColor = 'rgba(224,92,92,0.5)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(224,92,92,0.1)'; e.currentTarget.style.borderColor = 'rgba(224,92,92,0.25)' }}
                        >
                          ×
                        </button>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          {index === 0 && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c8a03c', marginBottom: '6px' }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M2 19h20v2H2v-2zm2-9l5 3.5L12 4l3 9.5L20 10l-2 9H6L4 10z"/>
                              </svg>
                              Album of the Year
                            </div>
                          )}
                          <div style={{ fontWeight: index === 0 ? '700' : '600', fontSize: index === 0 ? '1.05rem' : '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {album.title}
                          </div>
                          <div style={{ color: 'var(--subtle)', fontSize: '0.85rem', marginBottom: '10px' }}>
                            {album.artist}
                          </div>

                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'center' }}>
                            {PLATFORMS.map(p => {
                              const directUrl = platformLinks[album.id]?.[p.id]
                              const href = directUrl || p.search(album.artist, album.title)
                              const isDirect = !!directUrl
                              return (
                                <a
                                  key={p.id}
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={isDirect ? `Open on ${p.name}` : `Search on ${p.name}`}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = p.color; e.currentTarget.style.color = p.color }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = isDirect ? p.color + '55' : 'var(--border)'; e.currentTarget.style.color = isDirect ? p.color : 'var(--muted)' }}
                                  style={{
                                    fontSize: '0.72rem',
                                    fontWeight: '500',
                                    color: isDirect ? p.color : 'var(--muted)',
                                    border: `1px solid ${isDirect ? p.color + '55' : 'var(--border)'}`,
                                    borderRadius: '20px',
                                    padding: '3px 9px',
                                    textDecoration: 'none',
                                    transition: 'color 0.15s, border-color 0.15s',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {p.name}
                                </a>
                              )
                            })}
                          </div>
                          <div style={{ marginBottom: '12px' }}>
                            <a
                              href={platformLinks[album.id]?.pitchfork || `https://rateyourmusic.com/search?searchterm=${encodeURIComponent(album.artist + ' ' + album.title)}&searchtype=l`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
                              style={{
                                fontSize: '0.78rem',
                                color: 'var(--muted)',
                                textDecoration: 'none',
                                transition: 'color 0.15s',
                              }}
                            >
                              Read more →
                            </a>
                          </div>

                          <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', flexWrap: 'wrap' }}>
                            {[1,2,3,4,5,6,7,8,9,10].map(n => {
                              const active = album.weighted_score === n
                              return (
                                <button
                                  key={n}
                                  onClick={() => handleScoreCommit(album.id, n)}
                                  style={{
                                    width: '32px', height: '32px',
                                    padding: 0,
                                    fontSize: '0.85rem',
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

                          <div style={{ marginTop: '10px' }}>
                            <textarea
                              placeholder="Review"
                              value={album.review || ''}
                              onChange={e => handleReviewChange(album.id, e.target.value)}
                              onBlur={e => handleReviewBlur(album.id, e.target.value)}
                              rows={2}
                              maxLength={280}
                              style={{ display: 'block', width: '100%' }}
                            />
                            {(album.review?.length > 0) && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textAlign: 'right', marginTop: '3px' }}>
                                {album.review.length} / 280
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    )}
                  </Draggable>
                )
              })}
              {provided.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  )
}

export default AlbumList
