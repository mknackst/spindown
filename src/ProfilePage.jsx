import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

const GENRES = [
  'Alternative', 'Ambient', 'Blues', 'Classical', 'Country',
  'Electronic', 'Experimental', 'Folk', 'Hip-Hop', 'Indie',
  'Jazz', 'Latin', 'Metal', 'Pop', 'Post-Rock', 'Punk',
  'R&B / Soul', 'Reggae', 'Rock', 'Shoegaze', 'World Music',
]

function ProfilePage({ userId, username, onBack, onAvatarChange }) {
  const [profile, setProfile] = useState({ avatar_url: '', bio: '', location: '', favorite_genres: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    supabase.from('profiles').select('*').eq('user_id', userId).single()
      .then(({ data }) => {
        if (data) setProfile({
          avatar_url: data.avatar_url || '',
          bio: data.bio || '',
          location: data.location || '',
          favorite_genres: data.favorite_genres || [],
        })
        setLoading(false)
      })
  }, [userId])

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = `${data.publicUrl}?t=${Date.now()}`
      setProfile(p => ({ ...p, avatar_url: url }))
      await supabase.from('profiles').update({ avatar_url: url }).eq('user_id', userId)
      onAvatarChange?.(url)
    }
    setUploading(false)
    e.target.value = ''
  }

  function toggleGenre(genre) {
    setProfile(p => ({
      ...p,
      favorite_genres: p.favorite_genres.includes(genre)
        ? p.favorite_genres.filter(g => g !== genre)
        : [...p.favorite_genres, genre],
    }))
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('profiles').update({
      bio: profile.bio,
      location: profile.location,
      favorite_genres: profile.favorite_genres,
    }).eq('user_id', userId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading…</p>

  const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: '500', color: 'var(--subtle)', marginBottom: '6px' }

  return (
    <div style={{ maxWidth: '540px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '36px' }}>
        <button
          onClick={onBack}
          style={{ fontSize: '0.78rem', color: 'var(--muted)', borderColor: 'transparent', background: 'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-raised)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent' }}
        >
          ← Back
        </button>
        <h2 style={{ margin: 0 }}>Edit Profile</h2>
      </div>

      {/* Avatar */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '32px' }}>
        <div
          onClick={() => !uploading && fileRef.current?.click()}
          style={{
            width: 80, height: 80, borderRadius: '50%',
            border: '2px solid var(--border)',
            overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--surface-raised)', position: 'relative',
            transition: 'border-color 0.1s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" width={80} height={80} style={{ objectFit: 'cover', display: 'block' }} />
            : <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--border-hover)' }}><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
          }
          {uploading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 22, height: 22, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}
        </div>
        <div>
          <div style={{ fontWeight: '600', marginBottom: '6px' }}>@{username}</div>
          <button onClick={() => fileRef.current?.click()} style={{ fontSize: '0.78rem' }}>
            {profile.avatar_url ? 'Change photo' : 'Upload photo'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
      </div>

      {/* Bio */}
      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>Bio</label>
        <textarea
          placeholder="Tell people about your music taste…"
          value={profile.bio}
          onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
          maxLength={160}
          rows={3}
          style={{ display: 'block', width: '100%' }}
        />
        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textAlign: 'right', marginTop: '3px' }}>
          {profile.bio.length} / 160
        </div>
      </div>

      {/* Location */}
      <div style={{ marginBottom: '28px' }}>
        <label style={labelStyle}>Location</label>
        <input
          type="text"
          placeholder="City, Country"
          value={profile.location}
          onChange={e => setProfile(p => ({ ...p, location: e.target.value }))}
          maxLength={60}
          style={{ display: 'block', width: '100%' }}
        />
      </div>

      {/* Genres */}
      <div style={{ marginBottom: '32px' }}>
        <label style={labelStyle}>Favorite genres</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {GENRES.map(genre => {
            const active = profile.favorite_genres.includes(genre)
            return (
              <button
                key={genre}
                onClick={() => toggleGenre(genre)}
                style={{
                  fontSize: '0.78rem', padding: '5px 13px', borderRadius: '20px',
                  background: active ? 'var(--text)' : 'var(--surface)',
                  color: active ? 'var(--bg)' : 'var(--muted)',
                  borderColor: active ? 'var(--text)' : 'var(--border)',
                  transition: 'background 0.1s, color 0.1s, border-color 0.1s',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text)' } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' } }}
              >
                {genre}
              </button>
            )
          })}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: '10px 28px', fontWeight: '600', fontSize: '0.95rem',
          color: saved ? '#4caf85' : 'var(--text)',
          borderColor: saved ? 'rgba(76,175,133,0.4)' : 'var(--border)',
          opacity: saving ? 0.6 : 1,
          transition: 'color 0.2s, border-color 0.2s',
        }}
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
      </button>
    </div>
  )
}

export default ProfilePage
