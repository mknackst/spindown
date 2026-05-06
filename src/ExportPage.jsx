import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

// ─── Constants ───────────────────────────────────────────────────────────────

export const REVIEW_MAX = 280
const PER_SLIDE = 5
const W = 1080
const H = 1920

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// ─── Image loading ────────────────────────────────────────────────────────────

function proxyUrl(url) {
  return `${SUPABASE_URL}/functions/v1/cover-proxy?url=${encodeURIComponent(url)}`
}

async function fetchBlob(url, init) {
  const resp = await fetch(url, init)
  if (!resp.ok) throw new Error(resp.status)
  return resp.blob()
}

async function blobToImg(blob) {
  const blobUrl = URL.createObjectURL(blob)
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(null) }
    img.src = blobUrl
  })
}

async function findItunesArt(artist, title) {
  const q = encodeURIComponent(`${artist} ${title}`)
  const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=album&limit=1`)
  const data = await res.json()
  const url = data.results?.[0]?.artworkUrl100
  return url ? url.replace('100x100bb', '600x600bb') : null
}

async function loadImage(album) {
  if (album.cover_url) {
    try {
      const blob = await fetchBlob(proxyUrl(album.cover_url), {
        headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY },
      })
      const img = await blobToImg(blob)
      if (img) return img
    } catch {}
  }
  try {
    const artUrl = await findItunesArt(album.artist, album.title)
    if (!artUrl) return null
    return blobToImg(await fetchBlob(artUrl))
  } catch {
    return null
  }
}

async function fetchCoverBlob(album) {
  if (album.cover_url) {
    try {
      return await fetchBlob(proxyUrl(album.cover_url), {
        headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY },
      })
    } catch {}
  }
  try {
    const artUrl = await findItunesArt(album.artist, album.title)
    if (!artUrl) return null
    return await fetchBlob(artUrl)
  } catch {
    return null
  }
}

// ─── Canvas utilities ─────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function clipText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let lo = 0, hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    ctx.measureText(text.slice(0, mid) + '…').width <= maxWidth ? (lo = mid) : (hi = mid - 1)
  }
  return text.slice(0, lo) + '…'
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word }
    else line = test
  }
  if (line) lines.push(line)
  return lines
}

function drawBackground(ctx) {
  ctx.fillStyle = '#0f0f0f'
  ctx.fillRect(0, 0, W, H)
  const g1 = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.65)
  g1.addColorStop(0, 'rgba(140,100,220,0.35)')
  g1.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H)
  const g2 = ctx.createRadialGradient(W, H, 0, W, H, W * 0.6)
  g2.addColorStop(0, 'rgba(40,80,160,0.28)')
  g2.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H)
}

// ─── Grid format (5 per slide) ────────────────────────────────────────────────

function drawGridSlide(ctx, { albums, page, totalPages, year, images }) {
  drawBackground(ctx)
  const lp = 96; let y = 100
  ctx.fillStyle = '#555'; ctx.font = '500 26px Arial, sans-serif'; ctx.textAlign = 'left'
  ctx.fillText('SPINDOWN', lp, y + 26); y += 56
  ctx.fillStyle = '#f0f0f0'; ctx.font = 'bold 80px Arial, sans-serif'
  ctx.fillText(String(year), lp, y + 80); y += 94
  ctx.fillText('Year-End List', lp, y + 80); y += 94
  if (totalPages > 1) {
    ctx.fillStyle = '#555'; ctx.font = '30px Arial, sans-serif'
    ctx.fillText(`${page} / ${totalPages}`, lp, y + 30); y += 52
  }
  y += 60
  const imgSize = 180, rankW = 80, gap = 36
  for (const album of albums) {
    ctx.fillStyle = '#2e2e2e'; ctx.font = 'bold 64px Arial, sans-serif'; ctx.textAlign = 'right'
    ctx.fillText(String(album.rank), lp + rankW, y + imgSize * 0.62); ctx.textAlign = 'left'
    const imgX = lp + rankW + 20
    if (images[album.id]) {
      ctx.save(); roundRect(ctx, imgX, y, imgSize, imgSize, 10); ctx.clip()
      ctx.drawImage(images[album.id], imgX, y, imgSize, imgSize); ctx.restore()
    } else {
      ctx.fillStyle = '#1c1c1c'; roundRect(ctx, imgX, y, imgSize, imgSize, 10); ctx.fill()
    }
    const tx = imgX + imgSize + 32, maxW = W - tx - lp
    ctx.fillStyle = '#f0f0f0'; ctx.font = '600 38px Arial, sans-serif'
    ctx.fillText(clipText(ctx, album.title, maxW), tx, y + 52)
    ctx.fillStyle = '#999'; ctx.font = '32px Arial, sans-serif'
    ctx.fillText(clipText(ctx, album.artist, maxW), tx, y + 102)
    if (album.weighted_score > 0) {
      ctx.fillStyle = '#555'; ctx.font = '28px Arial, sans-serif'
      ctx.fillText(`${album.weighted_score} / 10`, tx, y + 152)
    }
    y += imgSize + gap
  }
  ctx.fillStyle = '#2e2e2e'; ctx.font = '26px Arial, sans-serif'
  ctx.fillText('spindown.app', lp, H - 80)
}

// ─── Review format (1 per slide) ─────────────────────────────────────────────

function drawReviewSlide(ctx, { album, page, totalPages, year, image }) {
  drawBackground(ctx)
  const lp = 80, contentW = W - lp * 2; let y = 72
  ctx.fillStyle = '#555'; ctx.font = '500 24px Arial, sans-serif'; ctx.textAlign = 'left'
  const pageStr = totalPages > 1 ? `  ${page} / ${totalPages}` : ''
  ctx.fillText(`SPINDOWN  •  ${year} Year-End List${pageStr}`, lp, y + 24); y += 60
  ctx.fillStyle = '#222'; ctx.font = 'bold 108px Arial, sans-serif'
  ctx.fillText(`#${album.rank}`, lp, y + 108); y += 124
  ctx.fillStyle = '#f0f0f0'; ctx.font = 'bold 52px Arial, sans-serif'
  ctx.fillText(clipText(ctx, album.title, contentW), lp, y + 52); y += 66
  ctx.fillStyle = '#888'; ctx.font = '36px Arial, sans-serif'
  ctx.fillText(clipText(ctx, album.artist, contentW), lp, y + 36); y += 60
  const imgSize = contentW
  if (image) {
    ctx.save(); roundRect(ctx, lp, y, imgSize, imgSize, 12); ctx.clip()
    ctx.drawImage(image, lp, y, imgSize, imgSize); ctx.restore()
  } else {
    ctx.fillStyle = '#1c1c1c'; roundRect(ctx, lp, y, imgSize, imgSize, 12); ctx.fill()
  }
  y += imgSize + 52
  if (album.review) {
    const review = album.review.slice(0, REVIEW_MAX)
    ctx.fillStyle = '#bbb'; ctx.font = '34px Arial, sans-serif'
    const lh = 52, maxLines = 5
    let lines = wrapText(ctx, review, contentW)
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = clipText(ctx, lines[maxLines - 1] + '…', contentW) }
    lines.forEach((line, i) => ctx.fillText(line, lp, y + i * lh)); y += lines.length * lh + 36
  }
  if (album.weighted_score > 0) {
    ctx.fillStyle = '#555'; ctx.font = '28px Arial, sans-serif'
    ctx.fillText(`${album.weighted_score} / 10`, lp, y + 28)
  }
  ctx.fillStyle = '#2e2e2e'; ctx.font = '24px Arial, sans-serif'; ctx.textAlign = 'left'
  ctx.fillText('spindown.app', lp, H - 60)
  if (totalPages > 1) {
    ctx.textAlign = 'right'
    ctx.fillText(`${page} / ${totalPages}`, W - lp, H - 60)
    ctx.textAlign = 'left'
  }
}

function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)[1]
  const binary = atob(data)
  const arr = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

function renderCanvas(drawFn, params) {
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  drawFn(canvas.getContext('2d'), params)
  return canvas.toDataURL('image/jpeg', 0.92)
}

// ─── Mini preview components ──────────────────────────────────────────────────

const PREVIEW_BG = {
  backgroundImage: [
    'radial-gradient(ellipse at 0% 0%, rgba(140,100,220,0.42) 0%, transparent 60%)',
    'radial-gradient(ellipse at 100% 100%, rgba(40,80,160,0.34) 0%, transparent 55%)',
  ].join(','),
}

function GridPreview({ year }) {
  return (
    <div style={{
      ...PREVIEW_BG,
      width: 180, height: 320, background: '#0f0f0f',
      borderRadius: 10, padding: '16px 14px',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Arial, sans-serif', color: '#f0f0f0',
      flexShrink: 0, overflow: 'hidden',
      border: '1px solid #1e1e1e',
    }}>
      <div style={{ fontSize: 5.5, color: '#555', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 3 }}>Spindown</div>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 14 }}>
        {year}<br />Year-End List
      </div>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ width: 10, textAlign: 'right', color: '#2e2e2e', fontWeight: 700, fontSize: 8, flexShrink: 0 }}>{i}</span>
          <div style={{ width: 26, height: 26, background: '#1e1e1e', borderRadius: 2, flexShrink: 0, border: '1px solid #2a2a2a' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 6.5, fontWeight: 600, color: '#e0e0e0' }}>Album Title</div>
            <div style={{ fontSize: 5.5, color: '#666', marginTop: 1 }}>Artist Name</div>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 'auto', paddingTop: 8, fontSize: 5.5, color: '#2a2a2a' }}>spindown.app</div>
    </div>
  )
}

function ReviewPreview({ year }) {
  return (
    <div style={{
      ...PREVIEW_BG,
      width: 180, height: 320, background: '#0f0f0f',
      borderRadius: 10, padding: '14px 12px',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Arial, sans-serif', color: '#f0f0f0',
      flexShrink: 0, overflow: 'hidden',
      border: '1px solid #1e1e1e',
    }}>
      <div style={{ fontSize: 5, color: '#555', marginBottom: 5 }}>SPINDOWN  •  {year} Year-End List</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#1e1e1e', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 2 }}>#1</div>
      <div style={{ fontSize: 8.5, fontWeight: 700, marginBottom: 1 }}>Album Title</div>
      <div style={{ fontSize: 7, color: '#777', marginBottom: 7 }}>Artist Name</div>
      <div style={{ width: '100%', height: 110, background: '#1a1a1a', borderRadius: 3, marginBottom: 8, flexShrink: 0, border: '1px solid #2a2a2a' }} />
      <div style={{ fontSize: 6, color: '#aaa', lineHeight: 1.6, fontStyle: 'italic', flex: 1, overflow: 'hidden' }}>
        "A thoughtful and deeply moving record that stays with you long after the last track fades away..."
      </div>
      <div style={{ paddingTop: 6, fontSize: 5.5, color: '#2a2a2a' }}>spindown.app</div>
    </div>
  )
}

// ─── Format selection card ────────────────────────────────────────────────────

function FormatCard({ title, subtitle, description, preview, onClick, loading, disabled }) {
  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: '10px',
      padding: '28px 24px',
      background: 'var(--surface)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
    }}>
      {preview}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '4px' }}>{title}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--accent)', marginBottom: '8px', fontWeight: '500' }}>{subtitle}</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: '1.55' }}>{description}</div>
      </div>
      <button
        onClick={onClick}
        disabled={disabled}
        style={{ width: '100%', padding: '10px', opacity: disabled ? 0.6 : 1, fontSize: '0.875rem' }}
      >
        {loading ? 'Generating…' : '↓ Export'}
      </button>
    </div>
  )
}

// ─── Bluesky sharing ──────────────────────────────────────────────────────────

const BSKY_BASE = 'https://bsky.social'

async function bskyUploadBlob(accessJwt, blob) {
  const res = await fetch(`${BSKY_BASE}/xrpc/com.atproto.repo.uploadBlob`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessJwt}`,
      'Content-Type': blob.type || 'image/jpeg',
    },
    body: blob,
  })
  if (!res.ok) return null
  return (await res.json()).blob
}

async function bskyCreateRecord(accessJwt, did, record) {
  const res = await fetch(`${BSKY_BASE}/xrpc/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessJwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo: did, collection: 'app.bsky.feed.post', record }),
  })
  if (!res.ok) throw new Error(`Post failed: ${res.status}`)
  return res.json()
}

function BlueskyShare({ albums, year, standalone }) {
  const [handle, setHandle] = useState('')
  const [password, setPassword] = useState('')
  const [stage, setStage] = useState('idle') // idle | posting | done | error
  const [progress, setProgress] = useState(0)
  const [threadUrl, setThreadUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const total = albums.length + 1

  async function handleShare() {
    if (!handle || !password) return
    setStage('posting')
    setProgress(0)
    setErrorMsg('')

    try {
      const authRes = await fetch(`${BSKY_BASE}/xrpc/com.atproto.server.createSession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: handle.replace(/^@/, ''), password }),
      })
      if (!authRes.ok) throw new Error('Login failed — check your handle and app password')
      const { did, accessJwt } = await authRes.json()

      const blobRefs = await Promise.all(albums.map(async (album) => {
        try {
          const blob = await fetchCoverBlob(album)
          if (!blob) return null
          return bskyUploadBlob(accessJwt, blob)
        } catch { return null }
      }))

      function makePost(text, blobRef, replyRef) {
        const record = {
          '$type': 'app.bsky.feed.post',
          text: text.slice(0, 300),
          createdAt: new Date().toISOString(),
        }
        if (blobRef) {
          record.embed = {
            '$type': 'app.bsky.embed.images',
            images: [{ image: blobRef, alt: '' }],
          }
        }
        if (replyRef) record.reply = replyRef
        return bskyCreateRecord(accessJwt, did, record)
      }

      const rootPost = await makePost(`My top ${albums.length} albums of ${year} 🎵`, blobRefs[0], null)
      const rootRef = { uri: rootPost.uri, cid: rootPost.cid }
      setProgress(1)

      let parentRef = rootRef
      for (let i = 0; i < albums.length; i++) {
        const a = albums[i]
        const header = `#${a.rank} ${a.title} — ${a.artist}`
        const scoreStr = a.weighted_score > 0 ? `\n${a.weighted_score}/10` : ''
        const budget = 298 - header.length - scoreStr.length - 2
        const reviewStr = a.review && budget > 20
          ? `\n\n${a.review.slice(0, budget)}${a.review.length > budget ? '…' : ''}`
          : ''
        const post = await makePost(`${header}${scoreStr}${reviewStr}`, blobRefs[i], { root: rootRef, parent: parentRef })
        parentRef = { uri: post.uri, cid: post.cid }
        setProgress(i + 2)
      }

      const cleanHandle = handle.replace(/^@/, '')
      const rkey = rootPost.uri.split('/').pop()
      setThreadUrl(`https://bsky.app/profile/${cleanHandle}/post/${rkey}`)
      setStage('done')
    } catch (err) {
      setErrorMsg(err.message)
      setStage('error')
    }
  }

  const bskyLogo = (
    <svg width="28" height="28" viewBox="0 0 568 501" fill="#0085ff">
      <path d="M123.121 33.664C188.241 82.553 258.281 181.68 284 234.873c25.719-53.192 95.759-152.32 160.879-201.209C491.866-1.611 568-28.906 568 57.947c0 17.346-9.945 145.713-15.778 166.555-20.275 72.453-94.155 90.933-159.875 79.748C507.222 323.8 536.444 388.997 473.333 454c-105.213 108.01-150.765-27.097-162.078-61.768-2.117-6.215-3.107-9.13-3.255-6.658-.149-2.472-1.139.443-3.255 6.658C293.431 426.903 248 562.01 142.667 454 79.556 388.997 108.778 323.8 223.653 304.25c-65.72 11.185-139.6-7.295-159.875-79.748C57.945 203.66 48 75.293 48 57.947c0-86.853 76.134-59.558 75.121-24.283z"/>
    </svg>
  )

  if (stage === 'done') {
    return (
      <div style={standalone ? {} : { marginTop: '48px', paddingTop: '40px', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '440px', border: '1px solid var(--border)', borderRadius: '12px', padding: '32px', background: 'var(--surface)', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🎉</div>
          <div style={{ fontWeight: '700', fontSize: '1.05rem', marginBottom: '8px' }}>Thread posted!</div>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '24px' }}>
            Your {year} year-end list is now live on Bluesky.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <a href={threadUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <button style={{ width: '100%', padding: '12px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {bskyLogo} View on Bluesky →
              </button>
            </a>
            <button
              onClick={() => { setStage('idle'); setPassword('') }}
              style={{ width: '100%', color: 'var(--muted)', borderColor: 'transparent', background: 'transparent', fontSize: '0.85rem' }}
            >
              Post again
            </button>
          </div>
        </div>
      </div>
    )
  }

  const posting = stage === 'posting'

  return (
    <div style={standalone ? {} : { marginTop: '48px', paddingTop: '40px', borderTop: '1px solid var(--border)' }}>
      <div style={{ maxWidth: '440px', border: '1px solid var(--border)', borderRadius: '12px', padding: '32px', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          {bskyLogo}
          <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>Connect your Bluesky account</div>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '24px', lineHeight: '1.55' }}>
          Posts your {year} list as a thread — one post per album with cover art attached.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--subtle)', marginBottom: '6px', fontWeight: '500' }}>
              Bluesky handle
            </label>
            <input
              type="text"
              placeholder="you.bsky.social"
              value={handle}
              onChange={e => setHandle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleShare()}
              disabled={posting}
              style={{ display: 'block', width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--subtle)', marginBottom: '6px', fontWeight: '500' }}>
              App password
            </label>
            <input
              type="password"
              placeholder="xxxx-xxxx-xxxx-xxxx"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleShare()}
              disabled={posting}
              style={{ display: 'block', width: '100%', fontFamily: 'monospace', letterSpacing: '0.05em' }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '6px 0 0' }}>
              Not your main password —{' '}
              <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noopener noreferrer">
                create an app password in Settings
              </a>
            </p>
          </div>

          <button
            onClick={handleShare}
            disabled={posting || !handle || !password}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '0.95rem',
              opacity: posting || !handle || !password ? 0.55 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '4px',
            }}
          >
            {posting ? (
              <>Posting… ({progress} / {total})</>
            ) : (
              <>{bskyLogo} Post to Bluesky</>
            )}
          </button>

          {posting && (
            <div style={{ height: '4px', borderRadius: '2px', background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                borderRadius: '2px',
                background: '#0085ff',
                width: `${(progress / total) * 100}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>
          )}

          {stage === 'error' && (
            <p style={{ color: '#e05c5c', fontSize: '0.85rem', margin: 0 }}>{errorMsg}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Export page ──────────────────────────────────────────────────────────────

function ExportPage({ userId, year, section }) {
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(null)

  useEffect(() => {
    supabase.from('albums').select('*')
      .eq('user_id', userId).eq('year', year)
      .order('rank', { ascending: true })
      .then(({ data }) => { setAlbums(data || []); setLoading(false) })
  }, [])

  async function handleExport(format) {
    setExporting(format)
    try {
      const imageEntries = await Promise.all(albums.map(async a => [a.id, await loadImage(a)]))
      const images = Object.fromEntries(imageEntries)

      if (format === 'grid') {
        const chunks = []
        for (let i = 0; i < albums.length; i += PER_SLIDE) chunks.push(albums.slice(i, i + PER_SLIDE))
        if (chunks.length === 1) {
          saveAs(dataUrlToBlob(renderCanvas(drawGridSlide, { albums: chunks[0], page: 1, totalPages: 1, year, images })), `spindown-${year}.jpg`)
        } else {
          const zip = new JSZip()
          for (let i = 0; i < chunks.length; i++) {
            zip.file(`spindown-${year}-${i + 1}-of-${chunks.length}.jpg`,
              dataUrlToBlob(renderCanvas(drawGridSlide, { albums: chunks[i], page: i + 1, totalPages: chunks.length, year, images })))
          }
          saveAs(await zip.generateAsync({ type: 'blob' }), `spindown-${year}.zip`)
        }
      } else {
        if (albums.length === 1) {
          saveAs(dataUrlToBlob(renderCanvas(drawReviewSlide, { album: albums[0], page: 1, totalPages: 1, year, image: images[albums[0].id] })), `spindown-${year}-1.jpg`)
        } else {
          const zip = new JSZip()
          for (let i = 0; i < albums.length; i++) {
            zip.file(`spindown-${year}-${i + 1}-of-${albums.length}.jpg`,
              dataUrlToBlob(renderCanvas(drawReviewSlide, { album: albums[i], page: i + 1, totalPages: albums.length, year, image: images[albums[i].id] })))
          }
          saveAs(await zip.generateAsync({ type: 'blob' }), `spindown-${year}-reviews.zip`)
        }
      }

      Object.values(images).filter(Boolean).forEach(img => { try { URL.revokeObjectURL(img.src) } catch {} })
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(null)
    }
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading…</p>

  if (section === 'bluesky') {
    return <BlueskyShare albums={albums} year={year} standalone />
  }

  return (
    <div>
      <div style={{ marginBottom: '36px' }}>
        <h2>Export for Instagram</h2>
        <p style={{ color: 'var(--muted)', marginTop: '8px', fontSize: '0.875rem' }}>
          Images are sized for Instagram Stories (1080 × 1920 px).
          {albums.length > PER_SLIDE && ' Multiple images will download as a zip file.'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', maxWidth: '680px' }}>
        <FormatCard
          title="Grid"
          subtitle={`5 albums per image · ${Math.ceil(albums.length / PER_SLIDE)} image${Math.ceil(albums.length / PER_SLIDE) !== 1 ? 's' : ''}`}
          description="Your full ranked list at a glance — best for a quick share of your top picks."
          preview={<GridPreview year={year} />}
          onClick={() => handleExport('grid')}
          loading={exporting === 'grid'}
          disabled={!!exporting}
        />
        <FormatCard
          title="With Reviews"
          subtitle={`1 album per image · ${albums.length} image${albums.length !== 1 ? 's' : ''}`}
          description="One album per image with your mini-review — best for sharing the story behind each pick."
          preview={<ReviewPreview year={year} />}
          onClick={() => handleExport('review')}
          loading={exporting === 'review'}
          disabled={!!exporting}
        />
      </div>
    </div>
  )
}

export default ExportPage
