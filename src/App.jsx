import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import Auth from './Auth'
import Dashboard from './Dashboard'
import AlbumSearch from './AlbumSearch'
import AlbumList from './AlbumList'
import ListeningQueue from './ListeningQueue'
import { generateRecommendations } from './recommendations'

function App() {
  const [session, setSession] = useState(null)
  const [view, setView] = useState('dashboard')
  const [selectedYear, setSelectedYear] = useState(null)
  const [refreshList, setRefreshList] = useState(0)
  const [queueRefresh, setQueueRefresh] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setView('dashboard')
    })
  }, [])

  function openList(year) {
    setSelectedYear(year)
    setView('list')
  }

  async function handleAddAlbum(album) {
    const { error } = await supabase.from('albums').insert({
      user_id: session.user.id,
      title: album.title,
      artist: album.artist,
      mbid: album.mbid,
      cover_url: album.cover_url,
      year: selectedYear,
      rank: 0,
      weighted_score: 0
    })
    if (error) { console.error(error); return }
    setRefreshList(r => r + 1)
    generateRecommendations(session.user.id, selectedYear).then(() => setQueueRefresh(r => r + 1))
  }

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '20px', marginBottom: '28px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1
            style={{ cursor: view === 'list' ? 'pointer' : 'default' }}
            onClick={() => setView('dashboard')}
          >
            Spindown
          </h1>
          {view === 'list' && session && (
            <>
              <span style={{ color: 'var(--border-hover)' }}>/</span>
              <span style={{ color: 'var(--subtle)', fontSize: '0.95rem' }}>{selectedYear}</span>
              <button onClick={() => setView('dashboard')} style={{ fontSize: '0.75rem', color: 'var(--muted)', borderColor: 'transparent', background: 'transparent' }}>
                ← All lists
              </button>
            </>
          )}
        </div>
        {session && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{session.user.email}</span>
            <button onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
        )}
      </header>

      {!session && <Auth />}

      {session && view === 'dashboard' && (
        <Dashboard userId={session.user.id} onOpenList={openList} />
      )}

      {session && view === 'list' && (
        <>
          <AlbumSearch onAdd={handleAddAlbum} year={selectedYear} />
          <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start', marginTop: '32px' }}>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <AlbumList key={`${refreshList}-${selectedYear}`} userId={session.user.id} year={selectedYear} />
            </div>
            <div style={{ flex: '0 0 300px', position: 'sticky', top: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
              <ListeningQueue userId={session.user.id} onAdd={handleAddAlbum} refreshTrigger={queueRefresh} year={selectedYear} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default App
