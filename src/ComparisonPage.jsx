import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { sameAlbum, computeTasteMatch } from './listUtils'

function Avatar({ url, username, size = 56 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', border: '2px solid var(--border)', overflow: 'hidden', flexShrink: 0, background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {url
        ? <img src={url} alt="" width={size} height={size} style={{ objectFit: 'cover', display: 'block' }} />
        : <span style={{ fontSize: size * 0.35 + 'px', fontWeight: '600', color: 'var(--muted)' }}>{username?.[0]?.toUpperCase()}</span>
      }
    </div>
  )
}

function RankBadge({ rank, color }) {
  return (
    <span style={{
      display: 'inline-block', minWidth: 36, textAlign: 'center',
      fontSize: '0.78rem', fontWeight: '700', padding: '3px 7px',
      borderRadius: '6px', flexShrink: 0,
      background: color + '18', color, border: `1px solid ${color}44`,
    }}>
      #{rank}
    </span>
  )
}

function StatPill({ children, accent }) {
  return (
    <div style={{
      padding: '10px 16px', borderRadius: '8px',
      background: 'var(--surface)', border: '1px solid var(--border)',
      fontSize: '0.78rem', color: accent || 'var(--muted)', lineHeight: 1.4,
      flex: 1,
    }}>
      {children}
    </div>
  )
}

export default function ComparisonPage({ username1, username2, year }) {
  const [state, setState] = useState(null) // { profile1, profile2, shared, only1, only2 }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const COLOR1 = '#7c6af5'
  const COLOR2 = '#f5a623'

  useEffect(() => {
    async function load() {
      const [{ data: p1 }, { data: p2 }] = await Promise.all([
        supabase.from('profiles').select('user_id, avatar_url').eq('username', username1).single(),
        supabase.from('profiles').select('user_id, avatar_url').eq('username', username2).single(),
      ])
      if (!p1) { setError(`@${username1} not found.`); setLoading(false); return }
      if (!p2) { setError(`@${username2} not found.`); setLoading(false); return }

      const [{ data: a1 }, { data: a2 }] = await Promise.all([
        supabase.from('albums').select('*').eq('user_id', p1.user_id).eq('year', year).order('rank'),
        supabase.from('albums').select('*').eq('user_id', p2.user_id).eq('year', year).order('rank'),
      ])
      const albums1 = a1 || [], albums2 = a2 || []

      const shared = albums1
        .filter(a => albums2.some(b => sameAlbum(a, b)))
        .map(a => {
          const b = albums2.find(b => sameAlbum(a, b))
          return { ...a, rank1: a.rank, rank2: b.rank, diff: Math.abs(a.rank - b.rank) }
        })
        .sort((a, b) => (a.rank1 + a.rank2) / 2 - (b.rank1 + b.rank2) / 2)

      const only1 = albums1.filter(a => !albums2.some(b => sameAlbum(a, b)))
      const only2 = albums2.filter(b => !albums1.some(a => sameAlbum(a, b)))

      setState({
        profile1: { username: username1, avatar_url: p1.avatar_url },
        profile2: { username: username2, avatar_url: p2.avatar_url },
        shared, only1, only2,
        total1: albums1.length, total2: albums2.length,
      })
      setLoading(false)
    }
    load()
  }, [username1, username2, year])

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '20px', marginBottom: '36px', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ cursor: 'pointer' }} onClick={() => window.location.href = '/'}>Spindown</h1>
        <a href="/" style={{ fontSize: '0.8rem', color: 'var(--muted)', textDecoration: 'none' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
        >Make your own →</a>
      </header>

      {loading && <p style={{ color: 'var(--muted)' }}>Loading…</p>}
      {error && <p style={{ color: '#e05c5c' }}>{error}</p>}

      {state && (() => {
        const { profile1, profile2, shared, only1, only2, total1, total2 } = state
        const tasteMatch = computeTasteMatch(shared, total1, total2)
        const union = total1 + total2 - shared.length
        const topAgreement = shared.reduce((b, a) => (!b || a.diff < b.diff) ? a : b, null)
        const topDisagreement = shared.reduce((b, a) => (!b || a.diff > b.diff) ? a : b, null)

        const matchLabel = tasteMatch >= 80 ? 'Great match' : tasteMatch >= 55 ? 'Strong overlap' : tasteMatch >= 30 ? 'Some common ground' : tasteMatch > 0 ? 'Different tastes' : 'No overlap'

        return (
          <>
            {/* VS header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '28px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Avatar url={profile1.avatar_url} username={profile1.username} />
                <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>@{profile1.username}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{total1} albums</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--border-hover)' }}>vs</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{year}</span>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Avatar url={profile2.avatar_url} username={profile2.username} />
                <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>@{profile2.username}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{total2} albums</span>
              </div>
            </div>

            {/* Taste match score */}
            <div style={{ textAlign: 'center', padding: '24px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', marginBottom: '16px' }}>
              <div style={{ fontSize: '3.5rem', fontWeight: '800', letterSpacing: '-0.04em', lineHeight: 1 }}>{tasteMatch}%</div>
              <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--subtle)', marginTop: '6px' }}>{matchLabel}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '8px' }}>
                {shared.length} of {union} unique albums in common · ranked similarity factored in
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '32px' }}>
              <StatPill accent='#4caf85'>
                <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>{shared.length}</div>
                <div>albums in common</div>
              </StatPill>
              {topAgreement && (
                <StatPill>
                  <div style={{ fontWeight: '600', fontSize: '0.82rem', color: 'var(--subtle)', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {topAgreement.diff === 0 ? '✓ Both ranked' : 'Closest call'}
                  </div>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{topAgreement.title}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>
                    {topAgreement.diff === 0 ? `tied at #${topAgreement.rank1}` : `#${topAgreement.rank1} vs #${topAgreement.rank2}`}
                  </div>
                </StatPill>
              )}
              {topDisagreement && topDisagreement.diff > 0 && (
                <StatPill>
                  <div style={{ fontWeight: '600', fontSize: '0.82rem', color: 'var(--subtle)', marginBottom: '2px' }}>Biggest gap</div>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{topDisagreement.title}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>
                    #{topDisagreement.rank1} vs #{topDisagreement.rank2} · {topDisagreement.diff} apart
                  </div>
                </StatPill>
              )}
            </div>

            {/* Shared albums */}
            {shared.length > 0 && (
              <section style={{ marginBottom: '36px' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--subtle)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.75rem' }}>
                  In common ({shared.length})
                </h2>
                <ul>
                  {shared.map((album, i) => {
                    const diffColor = album.diff === 0 ? '#c8a03c' : album.diff <= 3 ? '#4caf85' : album.diff <= 7 ? 'var(--muted)' : '#e05c5c'
                    return (
                      <li key={album.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                        <img
                          src={album.cover_url || `https://coverartarchive.org/release-group/${album.mbid}/front`}
                          alt="" width={44} height={44}
                          style={{ objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }}
                          onError={e => { e.target.style.display = 'none' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '600', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{album.title}</div>
                          <div style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>{album.artist}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <RankBadge rank={album.rank1} color={COLOR1} />
                          <span style={{ fontSize: '0.65rem', color: 'var(--border-hover)' }}>vs</span>
                          <RankBadge rank={album.rank2} color={COLOR2} />
                          <span style={{ fontSize: '0.7rem', color: diffColor, minWidth: 48, textAlign: 'right' }}>
                            {album.diff === 0 ? 'tied' : `${album.diff} apart`}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {/* Unique to each */}
            {(only1.length > 0 || only2.length > 0) && (
              <section style={{ marginBottom: '48px' }}>
                <h2 style={{ fontWeight: '600', color: 'var(--subtle)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.75rem' }}>
                  Only on one list
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: '600', color: COLOR1, marginBottom: '10px' }}>@{profile1.username} only ({only1.length})</div>
                    {only1.map(a => (
                      <div key={a.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                        <img src={a.cover_url || `https://coverartarchive.org/release-group/${a.mbid}/front`} alt="" width={32} height={32} style={{ objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }} onError={e => { e.target.style.display = 'none' }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{a.artist}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: '600', color: COLOR2, marginBottom: '10px' }}>@{profile2.username} only ({only2.length})</div>
                    {only2.map(a => (
                      <div key={a.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                        <img src={a.cover_url || `https://coverartarchive.org/release-group/${a.mbid}/front`} alt="" width={32} height={32} style={{ objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }} onError={e => { e.target.style.display = 'none' }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{a.artist}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* CTA */}
            <div style={{ paddingTop: '24px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '14px' }}>Make your own year-end music list</p>
              <a href="/"
                style={{ display: 'inline-block', padding: '10px 22px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', transition: 'border-color 0.1s, background 0.1s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.background = 'var(--surface-raised)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)' }}
              >
                Get started on Spindown →
              </a>
            </div>
          </>
        )
      })()}
    </div>
  )
}
