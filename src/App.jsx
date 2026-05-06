import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import Auth from './Auth'
import AlbumSearch from './AlbumSearch'
import AlbumList from './AlbumList'

function App() {
  const [session, setSession] = useState(null)
  const [refreshList, setRefreshList] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  async function handleAddAlbum(album) {
    const { error } = await supabase.from('albums').insert({
      user_id: session.user.id,
      title: album.title,
      artist: album.artist,
      mbid: album.mbid,
      cover_url: album.cover_url,
      rank: 0,
      weighted_score: 0
    })
    if (error) console.error(error)
    else setRefreshList(r => r + 1)
  }

  return (
    <div>
      <h1>Spindown</h1>
      {session ? (
        <>
          <p>Welcome, {session.user.email}</p>
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
          <AlbumSearch onAdd={handleAddAlbum} />
          <AlbumList key={refreshList} userId={session.user.id} />
        </>
      ) : (
        <Auth />
      )}
    </div>
  )
}

export default App