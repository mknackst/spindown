import { useEffect, useState } from 'react'
import { supabase } from './supabase'

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function ActivityFeed({ userId }) {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [noFollowing, setNoFollowing] = useState(false)

  useEffect(() => {
    load()
  }, [userId])

  async function load() {
    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId)

    if (!follows?.length) {
      setNoFollowing(true)
      setLoading(false)
      return
    }

    const followingIds = follows.map(f => f.following_id)

    const [albumsRes, profilesRes] = await Promise.all([
      supabase
        .from('albums')
        .select('id, title, artist, cover_url, mbid, year, created_at, user_id')
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', followingIds),
    ])

    const albums = albumsRes.data || []
    const profileMap = Object.fromEntries((profilesRes.data || []).map(p => [p.user_id, p]))

    // Group by (user_id, year), sorted by most recent activity within each group
    const groupMap = {}
    for (const album of albums) {
      const key = `${album.user_id}_${album.year}`
      if (!groupMap[key]) {
        groupMap[key] = {
          key,
          userId: album.user_id,
          year: album.year,
          albums: [],
          latestAt: album.created_at,
          profile: profileMap[album.user_id],
        }
      }
      groupMap[key].albums.push(album)
    }

    const sorted = Object.values(groupMap).sort((a, b) => new Date(b.latestAt) - new Date(a.latestAt))
    setGroups(sorted)
    setLoading(false)
  }

  if (loading) return null

  return (
    <div style={{ marginTop: '48px', paddingTop: '32px', borderTop: '1px solid var(--border)' }}>
      <h2 style={{ marginBottom: '20px' }}>Following</h2>

      {(noFollowing || groups.length === 0) ? (
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
          {noFollowing
            ? "You're not following anyone yet. Visit someone's public list and hit Follow."
            : 'No recent activity from people you follow.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {groups.map(({ key, profile, year, albums, latestAt }) => {
            const shown = albums.slice(0, 4)
            const extra = albums.length - shown.length
            return (
              <div key={key} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <a href={`/u/${profile?.username}/${year}`} style={{ flexShrink: 0, textDecoration: 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt="" width={36} height={36} style={{ objectFit: 'cover', display: 'block' }} />
                      : <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--muted)' }}>{profile?.username?.[0]?.toUpperCase() || '?'}</span>
                    }
                  </div>
                </a>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', marginBottom: '8px', lineHeight: 1.5 }}>
                    <a
                      href={`/u/${profile?.username}/${year}`}
                      style={{ fontWeight: '600', color: 'var(--text)', textDecoration: 'none' }}
                      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                    >
                      @{profile?.username}
                    </a>
                    <span style={{ color: 'var(--subtle)' }}>
                      {' '}added {albums.length} album{albums.length !== 1 ? 's' : ''} to their{' '}
                    </span>
                    <a
                      href={`/u/${profile?.username}/${year}`}
                      style={{ color: 'var(--subtle)', textDecoration: 'none' }}
                      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                    >
                      {year} list
                    </a>
                    <span style={{ color: 'var(--muted)', marginLeft: '8px', fontSize: '0.75rem' }}>
                      {timeAgo(latestAt)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {shown.map(a => (
                      <img
                        key={a.id}
                        src={a.cover_url || `https://coverartarchive.org/release-group/${a.mbid}/front`}
                        alt={`${a.title} – ${a.artist}`}
                        title={`${a.title} – ${a.artist}`}
                        width={48}
                        height={48}
                        style={{ objectFit: 'cover', borderRadius: '4px', display: 'block', flexShrink: 0 }}
                        onError={e => { e.target.style.display = 'none' }}
                      />
                    ))}
                    {extra > 0 && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)', paddingLeft: '2px' }}>
                        +{extra} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ActivityFeed
