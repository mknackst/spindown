import { useEffect, useState } from 'react'
import { supabase } from './supabase'

function PublicList({ username, year }) {
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [profile, setProfile] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: prof } = await supabase
        .from('profiles')
        .select('user_id, avatar_url, bio, location, favorite_genres')
        .eq('username', username)
        .single()

      if (!prof) { setNotFound(true); setLoading(false); return }
      setProfile(prof)

      const { data } = await supabase
        .from('albums')
        .select('id, title, artist, cover_url, mbid, weighted_score, review, rank')
        .eq('user_id', prof.user_id)
        .eq('year', year)
        .order('rank', { ascending: true })

      if (!data?.length) { setNotFound(true); setLoading(false); return }
      setAlbums(data)
      setLoading(false)
    }
    load()
  }, [username, year])

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '20px', marginBottom: '36px', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ cursor: 'pointer' }} onClick={() => window.location.href = '/'}>Spindown</h1>
        <a
          href="/"
          style={{ fontSize: '0.8rem', color: 'var(--muted)', textDecoration: 'none', transition: 'color 0.1s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
        >
          Make your own →
        </a>
      </header>

      {loading && <p style={{ color: 'var(--muted)' }}>Loading…</p>}

      {notFound && !loading && (
        <div>
          <h2 style={{ marginBottom: '8px' }}>List not found</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
            This list doesn&apos;t exist yet — or the username is wrong.
          </p>
        </div>
      )}

      {!loading && !notFound && (
        <>
          {/* Profile header */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '36px', paddingBottom: '28px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', border: '2px solid var(--border)', overflow: 'hidden', flexShrink: 0, background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" width={72} height={72} style={{ objectFit: 'cover', display: 'block' }} />
                : <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--border-hover)' }}><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '700', fontSize: '1.05rem', marginBottom: '4px' }}>@{username}</div>
              {profile?.bio && <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--subtle)', lineHeight: 1.5 }}>{profile.bio}</p>}
              {profile?.location && (
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '8px' }}>
                  📍 {profile.location}
                </div>
              )}
              {profile?.favorite_genres?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {profile.favorite_genres.map(g => (
                    <span key={g} style={{ fontSize: '0.7rem', padding: '2px 9px', border: '1px solid var(--border)', borderRadius: '20px', color: 'var(--muted)' }}>
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2px' }}>{year} Year-End List</h2>
          </div>

          <ul>
            {albums.map((album, i) => (
              <li
                key={album.id}
                style={{
                  display: 'flex', gap: '16px', alignItems: 'flex-start',
                  padding: i === 0 ? '20px 16px' : '16px 0',
                  marginLeft: i === 0 ? '-16px' : 0,
                  marginRight: i === 0 ? '-16px' : 0,
                  borderBottom: '1px solid var(--border)',
                  borderRadius: i === 0 ? '10px' : 0,
                  background: i === 0 ? 'linear-gradient(135deg, rgba(200,160,60,0.1) 0%, rgba(200,160,60,0.04) 100%)' : 'transparent',
                  boxShadow: i === 0 ? 'inset 0 0 0 1px rgba(200,160,60,0.25)' : 'none',
                }}
              >
                <span style={{
                  width: '36px', textAlign: 'right', flexShrink: 0, lineHeight: 1, paddingTop: '6px',
                  color: i === 0 ? '#c8a03c' : 'var(--subtle)',
                  fontSize: i === 0 ? '2.2rem' : '1.8rem',
                  fontWeight: '700', letterSpacing: '-0.03em',
                }}>
                  {i + 1}
                </span>

                <img
                  src={album.cover_url || `https://coverartarchive.org/release-group/${album.mbid}/front`}
                  alt={album.title}
                  width={i === 0 ? 140 : 100}
                  height={i === 0 ? 140 : 100}
                  style={{ objectFit: 'cover', flexShrink: 0, borderRadius: i === 0 ? '6px' : '4px', boxShadow: i === 0 ? '0 4px 20px rgba(0,0,0,0.4)' : 'none' }}
                  onError={e => { e.target.style.display = 'none' }}
                />

                <div style={{ flex: 1, minWidth: 0, paddingTop: '4px' }}>
                  {i === 0 && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c8a03c', marginBottom: '6px' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2 19h20v2H2v-2zm2-9l5 3.5L12 4l3 9.5L20 10l-2 9H6L4 10z"/>
                      </svg>
                      Album of the Year
                    </div>
                  )}
                  <div style={{ fontWeight: i === 0 ? '700' : '600', fontSize: i === 0 ? '1.05rem' : '0.95rem' }}>
                    {album.title}
                  </div>
                  <div style={{ color: 'var(--subtle)', fontSize: '0.85rem', marginBottom: '8px' }}>
                    {album.artist}
                  </div>
                  {album.weighted_score > 0 && (
                    <span style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: '600', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: '4px', padding: '1px 6px', marginBottom: album.review ? '8px' : 0 }}>
                      {album.weighted_score}/10
                    </span>
                  )}
                  {album.review && (
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                      {album.review}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div style={{ marginTop: '48px', paddingTop: '28px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '14px' }}>
              Make your own year-end music list
            </p>
            <a
              href="/"
              style={{
                display: 'inline-block', padding: '10px 22px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', color: 'var(--text)',
                fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none',
                transition: 'border-color 0.1s, background 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.background = 'var(--surface-raised)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)' }}
            >
              Get started on Spindown →
            </a>
          </div>
        </>
      )}
    </div>
  )
}

export default PublicList
