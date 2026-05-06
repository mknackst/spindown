import { useEffect, useState } from 'react'
import { supabase } from './supabase'

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

  if (loading) return <p>Loading your list...</p>
  if (albums.length === 0) return <p>No albums yet — search and add some!</p>

  return (
    <div>
      <h2>My List</h2>
      <ul>
        {albums.map((album, index) => (
          <li key={album.id}>
            <span>#{index + 1}</span>
            <strong>{album.title}</strong> — {album.artist}
            <button onClick={() => handleDelete(album.id)}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default AlbumList