import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

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

function AlbumList({ userId, year, onExport }) {
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [openScoring, setOpenScoring] = useState(new Set())
  const [dragFrom, setDragFrom] = useState(null)
  const [dragTo, setDragTo] = useState(null)

  const albumsRef = useRef([])
  const triedItunesRef = useRef(new Set())
  useEffect(() => { albumsRef.current = albums }, [albums])

  useEffect(() => {
    fetchAlbums()
  }, [])

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

  function toggleScoring(id) {
    setOpenScoring(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading...</p>
  if (albums.length === 0) return <p style={{ color: 'var(--muted)' }}>No albums yet — search and add some!</p>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2>My {year} Year-End List</h2>
        <button onClick={onExport} style={{ fontSize: '0.8rem' }}>↑ Export for Instagram</button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd} onDragUpdate={handleDragUpdate}>
        <Droppable droppableId="album-list">
          {(provided) => (
            <ul {...provided.droppableProps} ref={provided.innerRef}>
              {albums.map((album, index) => {
                const isOpen = openScoring.has(album.id)
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
                          padding: '16px 0',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        <span style={{ width: '48px', flexShrink: 0, textAlign: 'right', color: 'var(--subtle)', fontSize: '1.8rem', fontWeight: '700', paddingTop: '4px', letterSpacing: '-0.03em', lineHeight: 1 }}>
                          {getDisplayIndex(index) + 1}
                        </span>

                        <img
                          src={album.cover_url || `https://coverartarchive.org/release-group/${album.mbid}/front`}
                          alt={album.title}
                          width={150}
                          height={150}
                          style={{ objectFit: 'cover', flexShrink: 0, borderRadius: '4px' }}
                          onError={e => handleCoverError(album.id, album.artist, album.title, e.target)}
                        />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '600', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {album.title}
                          </div>
                          <div style={{ color: 'var(--subtle)', fontSize: '0.85rem', marginBottom: '10px' }}>
                            {album.artist}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {album.weighted_score > 0 && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: '20px' }}>
                                {album.weighted_score} / 10
                              </span>
                            )}
                            <button onClick={() => toggleScoring(album.id)}>
                              {isOpen ? 'Close' : 'Score'}
                            </button>
                            <button
                              onClick={() => handleDelete(album.id)}
                              style={{ color: 'var(--muted)', borderColor: 'transparent', background: 'transparent' }}
                            >
                              Remove
                            </button>
                          </div>

                          {isOpen && (
                            <div style={{ marginTop: '12px', padding: '14px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                                <span style={{ fontSize: '0.82rem', color: 'var(--subtle)' }}>Overall score</span>
                                <strong style={{ fontSize: '0.85rem' }}>{album.weighted_score ?? '—'} / 10</strong>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: 'var(--muted)', fontSize: '0.7rem', flexShrink: 0 }}>1</span>
                                <input
                                  type="range" min={1} max={10} step={1}
                                  value={album.weighted_score ?? 5}
                                  onChange={e => handleScoreChange(album.id, e.target.value)}
                                  onMouseUp={e => handleScoreCommit(album.id, e.target.value)}
                                  style={{ flex: 1 }}
                                />
                                <span style={{ color: 'var(--muted)', fontSize: '0.7rem', flexShrink: 0 }}>10</span>
                              </div>
                            </div>
                          )}

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
