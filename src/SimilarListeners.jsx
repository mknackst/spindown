import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { sameAlbum, computeTasteMatch } from './listUtils'

function Avatar({ url, username, size = 36 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0, background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {url
        ? <img src={url} alt="" width={size} height={size} style={{ objectFit: 'cover', display: 'block' }} />
        : <span style={{ fontSize: size * 0.38 + 'px', fontWeight: '600', color: 'var(--muted)' }}>{username?.[0]?.toUpperCase()}</span>
      }
    </div>
  )
}

export default function SimilarListeners({ userId, username, year, onSeeAll }) {
  const [matches, setMatches] = useState(null)

  useEffect(() => {
    if (!userId || !year) return
    let cancelled = false

    async function load() {
      const { data: myAlbums } = await supabase
        .from('albums')
        .select('title, artist, mbid, rank')
        .eq('user_id', userId)
        .eq('year', year)

      if (!myAlbums?.length || cancelled) { setMatches([]); return }

      const { data: allAlbums } = await supabase
        .from('albums')
        .select('user_id, title, artist, mbid, rank, cover_url')
        .eq('year', year)
        .neq('user_id', userId)

      if (!allAlbums?.length || cancelled) { setMatches([]); return }

      const byUser = {}
      for (const a of allAlbums) {
        if (!byUser[a.user_id]) byUser[a.user_id] = []
        byUser[a.user_id].push(a)
      }

      const scored = Object.entries(byUser)
        .map(([uid, albums]) => {
          const shared = myAlbums
            .filter(a => albums.some(b => sameAlbum(a, b)))
            .map(a => {
              const b = albums.find(b => sameAlbum(a, b))
              return { ...a, diff: Math.abs(a.rank - b.rank), cover_url: b?.cover_url }
            })
          const score = computeTasteMatch(shared, myAlbums.length, albums.length)
          const covers = shared.slice(0, 3).map(a => a.cover_url).filter(Boolean)
          return { userId: uid, score, sharedCount: shared.length, covers }
        })
        .filter(s => s.sharedCount >= 1)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)

      if (!scored.length || cancelled) { setMatches([]); return }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', scored.map(s => s.userId))

      if (cancelled) return
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]))
      setMatches(
        scored.map(s => ({ ...s, profile: profileMap[s.userId] })).filter(s => s.profile?.username)
      )
    }

    load()
    return () => { cancelled = true }
  }, [userId, year])

  if (!matches?.length) return null

  return (
    <div style={{ marginTop: '48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
        <h2 style={{ margin: 0 }}>
          Listeners like you
          <span style={{ color: 'var(--muted)', fontWeight: '400', fontSize: '1rem', marginLeft: '10px' }}>· {year}</span>
        </h2>
        <button
          onClick={onSeeAll}
          style={{ fontSize: '0.8rem', color: 'var(--muted)', borderColor: 'transparent', background: 'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-raised)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent' }}
        >
          See all →
        </button>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.5 }}>
        Spindown users with the most similar taste in {year}.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {matches.map(({ profile, score, sharedCount, covers }) => (
          <div
            key={profile.user_id}
            style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 16px', transition: 'border-color 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <Avatar url={profile.avatar_url} username={profile.username} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>@{profile.username}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '1px' }}>
                {sharedCount} album{sharedCount !== 1 ? 's' : ''} in common
              </div>
            </div>
            {covers.length > 0 && (
              <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                {covers.map((url, i) => (
                  <img key={i} src={url} alt="" width={28} height={28} style={{ objectFit: 'cover', borderRadius: '3px' }} onError={e => { e.target.style.display = 'none' }} />
                ))}
              </div>
            )}
            <div style={{ fontWeight: '800', fontSize: '1.4rem', letterSpacing: '-0.03em', flexShrink: 0, minWidth: '52px', textAlign: 'right' }}>
              {score}%
            </div>
            <a
              href={`/compare/${username}/${profile.username}/${year}`}
              onClick={e => e.stopPropagation()}
              style={{ flexShrink: 0, display: 'inline-block', padding: '5px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: '0.75rem', fontWeight: '500', textDecoration: 'none', transition: 'border-color 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              Compare →
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
