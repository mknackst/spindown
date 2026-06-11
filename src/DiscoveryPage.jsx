import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { sameAlbum, computeTasteMatch } from './listUtils'

function Avatar({ url, username, size = 48 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', border: '2px solid var(--border)', overflow: 'hidden', flexShrink: 0, background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {url
        ? <img src={url} alt="" width={size} height={size} style={{ objectFit: 'cover', display: 'block' }} />
        : <span style={{ fontSize: size * 0.36 + 'px', fontWeight: '600', color: 'var(--muted)' }}>{username?.[0]?.toUpperCase()}</span>
      }
    </div>
  )
}

function MatchBar({ pct }) {
  const color = pct >= 70 ? '#4caf85' : pct >= 40 ? 'var(--accent)' : 'var(--border-hover)'
  return (
    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
    </div>
  )
}

export default function DiscoveryPage({ userId, username, year, onBack }) {
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Fetch my albums for this year
      const { data: myAlbums } = await supabase
        .from('albums')
        .select('title, artist, mbid, rank')
        .eq('user_id', userId)
        .eq('year', year)

      if (!myAlbums?.length) { setResults([]); setLoading(false); return }

      // Fetch all other users' albums for this year
      const { data: allAlbums } = await supabase
        .from('albums')
        .select('user_id, title, artist, mbid, rank, cover_url')
        .eq('year', year)
        .neq('user_id', userId)

      if (!allAlbums?.length) { setResults([]); setLoading(false); return }

      // Group by user_id
      const byUser = {}
      for (const a of allAlbums) {
        if (!byUser[a.user_id]) byUser[a.user_id] = []
        byUser[a.user_id].push(a)
      }

      // Compute taste match per user
      const scored = Object.entries(byUser).map(([uid, albums]) => {
        const shared = myAlbums
          .filter(a => albums.some(b => sameAlbum(a, b)))
          .map(a => {
            const b = albums.find(b => sameAlbum(a, b))
            return { ...a, diff: Math.abs(a.rank - b.rank) }
          })
        const score = computeTasteMatch(shared, myAlbums.length, albums.length)
        const topShared = shared.slice(0, 3).map(a => {
          const b = albums.find(b => sameAlbum(a, b))
          return b?.cover_url || null
        }).filter(Boolean)
        return { userId: uid, score, sharedCount: shared.length, totalOther: albums.length, topShared }
      })
      .filter(s => s.sharedCount >= 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)

      if (!scored.length) { setResults([]); setLoading(false); return }

      // Fetch profiles for matched users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', scored.map(s => s.userId))

      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]))

      const merged = scored
        .map(s => ({ ...s, profile: profileMap[s.userId] }))
        .filter(s => s.profile?.username)

      setResults(merged)
      setLoading(false)
    }
    load()
  }, [userId, year])

  return (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
        <button
          onClick={onBack}
          style={{ fontSize: '0.78rem', color: 'var(--muted)', borderColor: 'transparent', background: 'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-raised)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent' }}
        >
          ← Back
        </button>
        <h2 style={{ margin: 0 }}>Listeners like you</h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: '400' }}>{year}</span>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginBottom: '28px', lineHeight: 1.5 }}>
        Spindown users whose {year} lists overlap most with yours, ranked by taste match.
      </p>

      {loading && <p style={{ color: 'var(--muted)' }}>Searching…</p>}

      {!loading && results?.length === 0 && (
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          No other users have a {year} list yet — share yours and check back when more people sign up.
        </p>
      )}

      {!loading && results?.length > 0 && (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {results.map(({ profile, score, sharedCount, totalOther, topShared }) => (
            <li
              key={profile.user_id}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', display: 'flex', gap: '14px', alignItems: 'flex-start', transition: 'border-color 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <Avatar url={profile.avatar_url} username={profile.username} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '2px' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>@{profile.username}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{totalOther} albums</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: '800', letterSpacing: '-0.03em', lineHeight: 1 }}>{score}%</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{sharedCount} album{sharedCount !== 1 ? 's' : ''} in common</span>
                </div>
                <MatchBar pct={score} />

                {topShared.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', marginTop: '10px' }}>
                    {topShared.map((url, i) => (
                      <img key={i} src={url} alt="" width={32} height={32} style={{ objectFit: 'cover', borderRadius: '3px' }} onError={e => { e.target.style.display = 'none' }} />
                    ))}
                    <span style={{ fontSize: '0.68rem', color: 'var(--muted)', alignSelf: 'center', marginLeft: '4px' }}>shared</span>
                  </div>
                )}
              </div>

              <a
                href={`/compare/${username}/${profile.username}/${year}`}
                style={{ flexShrink: 0, display: 'inline-block', padding: '6px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: '0.78rem', fontWeight: '500', textDecoration: 'none', alignSelf: 'center', transition: 'border-color 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                Compare →
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
