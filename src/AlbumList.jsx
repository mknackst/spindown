import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

const SCORE_FIELDS = [
  { key: 'score_emotional', label: 'Emotional Impact' },
  { key: 'score_craft',     label: 'Craft / Artistry' },
  { key: 'score_longevity', label: 'Longevity / Replay Value' },
  { key: 'score_innovation', label: 'Innovation' },
]

const DEFAULT_WEIGHTS = { score_relisten: 5, score_emotional: 5, score_craft: 5, score_longevity: 5, score_innovation: 5 }

function computeWeightedScore(album, weights) {
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0)
  if (totalWeight === 0) return 0
  return (
    (album.score_relisten ? 10 : 0) * weights.score_relisten +
    (album.score_emotional || 0) * weights.score_emotional +
    (album.score_craft || 0) * weights.score_craft +
    (album.score_longevity || 0) * weights.score_longevity +
    (album.score_innovation || 0) * weights.score_innovation
  ) / totalWeight
}

function sortAndRank(albumList, weights) {
  return albumList
    .map(a => ({ ...a, weighted_score: computeWeightedScore(a, weights) }))
    .sort((a, b) => b.weighted_score - a.weighted_score)
    .map((a, i) => ({ ...a, rank: i + 1 }))
}

function SliderRow({ value, min, max, onChange, onCommit }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ color: 'var(--muted)', fontSize: '0.7rem', flexShrink: 0, width: '10px', textAlign: 'right' }}>{min}</span>
      <input
        type="range" min={min} max={max} step={1}
        value={value}
        onChange={onChange}
        onMouseUp={onCommit}
        style={{ flex: 1 }}
      />
      <span style={{ color: 'var(--muted)', fontSize: '0.7rem', flexShrink: 0, width: '16px' }}>{max}</span>
    </div>
  )
}

function AlbumList({ userId, year }) {
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS)
  const [openScoring, setOpenScoring] = useState(new Set())
  const [dragFrom, setDragFrom] = useState(null)
  const [dragTo, setDragTo] = useState(null)

  const albumsRef = useRef([])
  const weightsRef = useRef(DEFAULT_WEIGHTS)

  useEffect(() => { albumsRef.current = albums }, [albums])
  useEffect(() => { weightsRef.current = weights }, [weights])

  useEffect(() => {
    fetchAlbums()
    fetchWeights()
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

  async function fetchWeights() {
    const { data, error } = await supabase
      .from('user_weights')
      .select('*')
      .eq('user_id', userId)
      .single()
    if (error && error.code !== 'PGRST116') console.error(error)
    if (data) {
      const w = { score_relisten: data.score_relisten, score_emotional: data.score_emotional, score_craft: data.score_craft, score_longevity: data.score_longevity, score_innovation: data.score_innovation }
      setWeights(w)
      weightsRef.current = w
    }
  }

  async function applyAutoSort(albumList, w) {
    const sorted = sortAndRank(albumList, w)
    setAlbums(sorted)
    albumsRef.current = sorted
    for (const album of sorted) {
      await supabase.from('albums').update({ rank: album.rank, weighted_score: Math.round(album.weighted_score) }).eq('id', album.id)
    }
  }

  async function handleWeightCommit(field, value) {
    const updated = { ...weightsRef.current, [field]: Number(value) }
    setWeights(updated)
    weightsRef.current = updated
    await supabase.from('user_weights').upsert({ user_id: userId, ...updated }, { onConflict: 'user_id' })
    await applyAutoSort(albumsRef.current, updated)
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

  async function handleRelistenToggle(id) {
    const updated = albumsRef.current.map(a => a.id === id ? { ...a, score_relisten: a.score_relisten ? 0 : 1 } : a)
    await supabase.from('albums').update({ score_relisten: updated.find(a => a.id === id).score_relisten }).eq('id', id)
    await applyAutoSort(updated, weightsRef.current)
  }

  function handleScoreChange(id, field, value) {
    setAlbums(albums.map(a => a.id === id ? { ...a, [field]: value === '' ? null : Number(value) } : a))
  }

  async function handleScoreBlur(id, field, value) {
    const clamped = value === '' ? null : Math.min(10, Math.max(1, Number(value)))
    const updated = albumsRef.current.map(a => a.id === id ? { ...a, [field]: clamped } : a)
    await supabase.from('albums').update({ [field]: clamped }).eq('id', id)
    await applyAutoSort(updated, weightsRef.current)
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
      <div style={{ marginBottom: '16px' }}>
        <h2>My {year} Year-End List</h2>
      </div>

      <DragDropContext onDragEnd={handleDragEnd} onDragUpdate={handleDragUpdate}>
        <Droppable droppableId="album-list">
          {(provided) => (
            <ul {...provided.droppableProps} ref={provided.innerRef}>
              {albums.map((album, index) => {
                const score = computeWeightedScore(album, weights)
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
                          onError={e => { e.target.style.display = 'none' }}
                        />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '600', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {album.title}
                          </div>
                          <div style={{ color: 'var(--subtle)', fontSize: '0.85rem', marginBottom: '10px' }}>
                            {album.artist}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {score > 0 && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: '20px' }}>
                                {score.toFixed(1)} / 10
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
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                <input type="checkbox" checked={!!album.score_relisten} onChange={() => handleRelistenToggle(album.id)} />
                                Relistened
                                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--muted)' }}>weight {weights.score_relisten}/10</span>
                              </label>

                              {SCORE_FIELDS.map(({ key, label }) => (
                                <div key={key} style={{ marginBottom: '16px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '0.82rem', color: 'var(--subtle)' }}>{label}</span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                      score <strong style={{ color: 'var(--text)' }}>{album[key] ?? '—'}</strong>
                                      <span style={{ margin: '0 6px', opacity: 0.4 }}>·</span>
                                      weight <strong style={{ color: 'var(--text)' }}>{weights[key]}</strong>/10
                                    </span>
                                  </div>

                                  <div style={{ marginBottom: '4px' }}>
                                    <SliderRow
                                      value={album[key] ?? 5}
                                      min={1} max={10}
                                      onChange={e => handleScoreChange(album.id, key, e.target.value)}
                                      onCommit={e => handleScoreBlur(album.id, key, e.target.value)}
                                    />
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: 'var(--muted)', fontSize: '0.68rem', flexShrink: 0, width: '10px', textAlign: 'right' }}>0</span>
                                    <input
                                      type="range" min={0} max={10} step={1}
                                      value={weights[key]}
                                      onChange={e => setWeights(w => ({ ...w, [key]: Number(e.target.value) }))}
                                      onMouseUp={e => handleWeightCommit(key, e.target.value)}
                                      style={{ flex: 1, opacity: 0.55 }}
                                    />
                                    <span style={{ color: 'var(--muted)', fontSize: '0.68rem', flexShrink: 0, width: '16px' }}>10</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.02em', marginRight: '22px' }}>weight</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <textarea
                            placeholder="Review"
                            value={album.review || ''}
                            onChange={e => handleReviewChange(album.id, e.target.value)}
                            onBlur={e => handleReviewBlur(album.id, e.target.value)}
                            rows={2}
                            style={{ display: 'block', width: '100%', marginTop: '10px' }}
                          />
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
