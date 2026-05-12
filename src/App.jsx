import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import Auth from './Auth'
import Dashboard from './Dashboard'
import AlbumSearch from './AlbumSearch'
import AlbumList from './AlbumList'
import ListeningQueue from './ListeningQueue'
import AssignmentsPage from './AssignmentsPage'
import ExportPage from './ExportPage'
import ResetPassword from './ResetPassword'
import UsernameSetup from './UsernameSetup'
import PublicList from './PublicList'
import ProfilePage from './ProfilePage'
import { generateRecommendations } from './recommendations'

function App() {
  const [session, setSession] = useState(null)
  const [view, setView] = useState('dashboard')
  const [selectedYear, setSelectedYear] = useState(null)
  const [refreshList, setRefreshList] = useState(0)
  const [queueRefresh, setQueueRefresh] = useState(0)
  const [exportSection, setExportSection] = useState('instagram')
  const [username, setUsername] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [skippedUsername, setSkippedUsername] = useState(false)
  const [copied, setCopied] = useState(false)
  const [preProfileView, setPreProfileView] = useState('dashboard')

  // Detect public list URL: /u/:username/:year
  const publicListRoute = (() => {
    const m = window.location.pathname.match(/^\/u\/([^/]+)\/(\d{4})$/)
    return m ? { username: m[1], year: parseInt(m[2]) } : null
  })()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === 'PASSWORD_RECOVERY') setView('reset-password')
      else if (event === 'SIGNED_OUT') setView('dashboard')
      // SIGNED_IN fires right after PASSWORD_RECOVERY — don't override the reset view
    })
  }, [])

  useEffect(() => {
    if (!session) { setUsername(null); setAvatarUrl(null); setProfileLoaded(false); return }
    supabase.from('profiles').select('username, avatar_url').eq('user_id', session.user.id).single()
      .then(({ data }) => {
        setUsername(data?.username || null)
        setAvatarUrl(data?.avatar_url || null)
        setProfileLoaded(true)
      })
  }, [session])

  function openProfile() {
    setPreProfileView(view)
    setView('profile')
  }

  function openList(year) {
    setSelectedYear(year)
    setView('list')
  }

  function openExport(section) {
    setExportSection(section)
    setView('export')
  }

  function copyShareUrl() {
    navigator.clipboard.writeText(`${window.location.origin}/u/${username}/${selectedYear}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleAddAlbum(album) {
    const { count } = await supabase
      .from('albums')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('year', selectedYear)
    const { error } = await supabase.from('albums').insert({
      user_id: session.user.id,
      title: album.title,
      artist: album.artist,
      mbid: album.mbid,
      cover_url: album.cover_url,
      year: selectedYear,
      rank: (count ?? 0) + 1,
      weighted_score: album.weighted_score || 0,
      review: album.review || null,
    })
    if (error) { console.error(error); return }
    setRefreshList(r => r + 1)
    generateRecommendations(session.user.id, selectedYear).then(() => setQueueRefresh(r => r + 1))
  }

  // Render public list page for external visitors (no app chrome)
  if (publicListRoute) {
    return <PublicList username={publicListRoute.username} year={publicListRoute.year} />
  }

  const needsUsername = session && profileLoaded && !username && !skippedUsername && view !== 'reset-password'

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
          {(view === 'list' || view === 'export' || view === 'assignments') && session && (
            <>
              <span style={{ color: 'var(--border-hover)' }}>/</span>
              <span style={{ color: 'var(--subtle)', fontSize: '0.95rem' }}>{selectedYear}</span>
              {view === 'list' && (
                <button onClick={() => setView('dashboard')} style={{ fontSize: '0.75rem', color: 'var(--muted)', borderColor: 'transparent', background: 'transparent' }} onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-raised)' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent' }}>
                  ← All lists
                </button>
              )}
              {view === 'export' && (
                <button onClick={() => setView('list')} style={{ fontSize: '0.75rem', color: 'var(--muted)', borderColor: 'transparent', background: 'transparent' }} onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-raised)' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent' }}>
                  ← Back to list
                </button>
              )}
              {view === 'assignments' && (
                <button onClick={() => setView('list')} style={{ fontSize: '0.75rem', color: 'var(--muted)', borderColor: 'transparent', background: 'transparent' }} onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-raised)' }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent' }}>
                  ← Back to list
                </button>
              )}
            </>
          )}
        </div>
        {session && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {username && (
              <button
                onClick={openProfile}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', padding: '4px 8px', cursor: 'pointer', borderRadius: 'var(--radius)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-raised)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0, background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {avatarUrl
                    ? <img src={avatarUrl} alt="" width={26} height={26} style={{ objectFit: 'cover', display: 'block' }} />
                    : <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--muted)' }}>{username[0].toUpperCase()}</span>
                  }
                </div>
                <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>@{username}</span>
              </button>
            )}
            <button onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
        )}
      </header>

      {!session && <Auth />}

      {session && view === 'reset-password' && (
        <ResetPassword onComplete={() => setView('dashboard')} />
      )}

      {needsUsername && (
        <UsernameSetup
          userId={session.user.id}
          onComplete={u => setUsername(u)}
          onSkip={() => setSkippedUsername(true)}
        />
      )}

      {!needsUsername && session && view === 'profile' && (
        <ProfilePage
          userId={session.user.id}
          username={username}
          onBack={() => setView(preProfileView)}
          onAvatarChange={url => setAvatarUrl(url)}
        />
      )}

      {!needsUsername && session && view === 'export' && (
        <ExportPage userId={session.user.id} year={selectedYear} section={exportSection} />
      )}

      {!needsUsername && session && view === 'assignments' && (
        <AssignmentsPage userId={session.user.id} year={selectedYear} onAdd={handleAddAlbum} />
      )}

      {!needsUsername && session && view === 'dashboard' && (
        <Dashboard userId={session.user.id} onOpenList={openList} onOpenAssignments={year => { setSelectedYear(year); setView('assignments') }} />
      )}

      {!needsUsername && session && view === 'list' && (
        <>
          <AlbumSearch onAdd={handleAddAlbum} year={selectedYear} />
          <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start', marginTop: '32px' }}>
            <div style={{ flex: '1 1 0', minWidth: 0 }}>
              <AlbumList key={`${refreshList}-${selectedYear}`} userId={session.user.id} year={selectedYear} />
            </div>
            <div style={{ flex: '0 0 300px', position: 'sticky', top: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                <ListeningQueue userId={session.user.id} onAdd={handleAddAlbum} refreshTrigger={queueRefresh} year={selectedYear} onViewAll={() => setView('assignments')} />
              </div>

              <div>
                <h2 style={{ marginBottom: '12px' }}>Share Your List</h2>
                {username ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: '10px' }}>
                    <span style={{ flex: 1, fontSize: '0.72rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {window.location.origin}/u/{username}/{selectedYear}
                    </span>
                    <button
                      onClick={copyShareUrl}
                      style={{ flexShrink: 0, fontSize: '0.72rem', padding: '3px 10px', color: copied ? '#4caf85' : 'var(--text)', borderColor: copied ? 'rgba(76,175,133,0.4)' : 'var(--border)' }}
                      onMouseEnter={e => { if (!copied) { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.background = 'var(--surface-raised)' } }}
                      onMouseLeave={e => { if (!copied) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)' } }}
                    >
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                ) : (
                  <p style={{ color: 'var(--muted)', fontSize: '0.78rem', lineHeight: 1.5, marginBottom: '10px' }}>
                    <button
                      onClick={() => setSkippedUsername(false)}
                      style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', fontWeight: '500', cursor: 'pointer', fontSize: '0.78rem', textDecoration: 'underline' }}
                    >
                      Set a username
                    </button>
                    {' '}to get a shareable link for this list.
                  </p>
                )}
                <button
                  onClick={() => openExport('instagram')}
                  style={{ width: '100%', padding: '14px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}
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
          </div>
        </>
      )}
    </div>
  )
}

export default App
