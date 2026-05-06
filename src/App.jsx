import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import Auth from './Auth'
import Dashboard from './Dashboard'
import AlbumSearch from './AlbumSearch'
import AlbumList from './AlbumList'
import ListeningQueue from './ListeningQueue'
import ExportPage from './ExportPage'
import { generateRecommendations } from './recommendations'

function App() {
  const [session, setSession] = useState(null)
  const [view, setView] = useState('dashboard')
  const [selectedYear, setSelectedYear] = useState(null)
  const [refreshList, setRefreshList] = useState(0)
  const [queueRefresh, setQueueRefresh] = useState(0)
  const [exportSection, setExportSection] = useState('instagram')

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

  function openExport(section) {
    setExportSection(section)
    setView('export')
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
          {(view === 'list' || view === 'export') && session && (
            <>
              <span style={{ color: 'var(--border-hover)' }}>/</span>
              <span style={{ color: 'var(--subtle)', fontSize: '0.95rem' }}>{selectedYear}</span>
              {view === 'list' && (
                <button onClick={() => setView('dashboard')} style={{ fontSize: '0.75rem', color: 'var(--muted)', borderColor: 'transparent', background: 'transparent' }}>
                  ← All lists
                </button>
              )}
              {view === 'export' && (
                <button onClick={() => setView('list')} style={{ fontSize: '0.75rem', color: 'var(--muted)', borderColor: 'transparent', background: 'transparent' }}>
                  ← Back to list
                </button>
              )}
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

      {session && view === 'export' && (
        <ExportPage userId={session.user.id} year={selectedYear} section={exportSection} />
      )}

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
            <div style={{ flex: '0 0 300px', position: 'sticky', top: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                <ListeningQueue userId={session.user.id} onAdd={handleAddAlbum} refreshTrigger={queueRefresh} year={selectedYear} />
              </div>
              <h2 style={{ marginBottom: '16px' }}>Share Your List</h2>
              <button
                onClick={() => openExport('instagram')}
                style={{ width: '100%', padding: '14px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <circle cx="12" cy="12" r="4"/>
                  <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
                </svg>
                Export to Instagram
              </button>
              <button
                onClick={() => openExport('bluesky')}
                style={{ width: '100%', padding: '14px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <svg width="18" height="18" viewBox="0 0 568 501" fill="currentColor">
                  <path d="M123.121 33.664C188.241 82.553 258.281 181.68 284 234.873c25.719-53.192 95.759-152.32 160.879-201.209C491.866-1.611 568-28.906 568 57.947c0 17.346-9.945 145.713-15.778 166.555-20.275 72.453-94.155 90.933-159.875 79.748C507.222 323.8 536.444 388.997 473.333 454c-105.213 108.01-150.765-27.097-162.078-61.768-2.117-6.215-3.107-9.13-3.255-6.658-.149-2.472-1.139.443-3.255 6.658C293.431 426.903 248 562.01 142.667 454 79.556 388.997 108.778 323.8 223.653 304.25c-65.72 11.185-139.6-7.295-159.875-79.748C57.945 203.66 48 75.293 48 57.947c0-86.853 76.134-59.558 75.121-24.283z"/>
                </svg>
                Share to Bluesky
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default App
