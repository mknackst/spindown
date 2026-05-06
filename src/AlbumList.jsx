import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

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
                    >
                      <span>#{index + 1}</span>
                      {' '}<strong>{album.title}</strong> — {album.artist}
                      <button onClick={() => handleDelete(album.id)}>Remove</button>
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