import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

function StarRating({ rating, onChange }) {
  const [hovered, setHovered] = useState(null)
  return (
    <span>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onClick={() => onChange(n === rating ? null : n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0 1px', color: n <= (hovered ?? rating ?? 0) ? '#f5a623' : '#888' }}
        >
          {n <= (hovered ?? rating ?? 0) ? '★' : '☆'}
        </button>
      ))}
    </span>
  )
}

function AlbumList({ userId }) {
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAlbums()
  }, [])

  async function fetchAlbums() {
    const { data, error } = await supabase
      .from('albums')
      .select('*')
      .eq('user_id', userId)
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

  async function handleDragEnd(result) {
    if (!result.destination) return
    const reordered = Array.from(albums)
    const [moved] = reordered.splice(result.source.index, 1)
    reordered.splice(result.destination.index, 0, moved)
    const updated = reordered.map((album, index) => ({ ...album, rank: index + 1 }))
    setAlbums(updated)
    for (const album of updated) {
      await supabase.from('albums').update({ rank: album.rank }).eq('id', album.id)
    }
  }

  async function handleRating(id, rating) {
    setAlbums(albums.map(a => a.id === id ? { ...a, rating } : a))
    await supabase.from('albums').update({ rating }).eq('id', id)
  }

  function handleReviewChange(id, review) {
    setAlbums(albums.map(a => a.id === id ? { ...a, review } : a))
  }

  async function handleReviewBlur(id, review) {
    await supabase.from('albums').update({ review }).eq('id', id)
  }

  if (loading) return <p>Loading your list...</p>
  if (albums.length === 0) return <p>No albums yet — search and add some!</p>

  return (
    <div>
      <h2>My List</h2>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="album-list">
          {(provided) => (
            <ul {...provided.droppableProps} ref={provided.innerRef}>
              {albums.map((album, index) => (
                <Draggable key={album.id} draggableId={album.id} index={index}>
                  {(provided) => (
                    <li
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      style={{ ...provided.draggableProps.style, display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid #2a2a2a' }}
                    >
                      <img
                        src={album.cover_url || `https://coverartarchive.org/release-group/${album.mbid}/front`}
                        alt={album.title}
                        width={64}
                        height={64}
                        style={{ objectFit: 'cover', flexShrink: 0 }}
                        onError={e => { e.target.style.display = 'none' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div>
                          <span>#{index + 1}</span>
                          {' '}<strong>{album.title}</strong> — {album.artist}
                          <StarRating
                            rating={album.rating}
                            onChange={rating => handleRating(album.id, rating)}
                          />
                          <button onClick={() => handleDelete(album.id)}>Remove</button>
                        </div>
                        <textarea
                          placeholder="Review"
                          value={album.review || ''}
                          onChange={e => handleReviewChange(album.id, e.target.value)}
                          onBlur={e => handleReviewBlur(album.id, e.target.value)}
                          rows={2}
                          style={{ display: 'block', width: '100%', marginTop: '4px', boxSizing: 'border-box' }}
                        />
                      </div>
                    </li>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  )
}

export default AlbumList
