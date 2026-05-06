import { useState } from 'react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

const PER_SLIDE = 5
const W = 1080
const H = 1920
export const REVIEW_MAX = 280

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

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
  return new Promise((resolve) => {
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
    const blob = await fetchBlob(artUrl)
    return blobToImg(blob)
  } catch {
    return null
  }
}

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
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
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
  ctx.fillStyle = g1
  ctx.fillRect(0, 0, W, H)
  const g2 = ctx.createRadialGradient(W, H, 0, W, H, W * 0.6)
  g2.addColorStop(0, 'rgba(40,80,160,0.28)')
  g2.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g2
  ctx.fillRect(0, 0, W, H)
}

// Format 1: 5 albums per slide, no reviews
function drawGridSlide(ctx, { albums, page, totalPages, year, images }) {
  drawBackground(ctx)
  const lp = 96
  let y = 100

  ctx.fillStyle = '#555'
  ctx.font = '500 26px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('SPINDOWN', lp, y + 26)
  y += 56

  ctx.fillStyle = '#f0f0f0'
  ctx.font = 'bold 80px Arial, sans-serif'
  ctx.fillText(String(year), lp, y + 80)
  y += 94
  ctx.fillText('Year-End List', lp, y + 80)
  y += 94

  if (totalPages > 1) {
    ctx.fillStyle = '#555'
    ctx.font = '30px Arial, sans-serif'
    ctx.fillText(`${page} / ${totalPages}`, lp, y + 30)
    y += 52
  }
  y += 60

  const imgSize = 180
  const rankW = 80
  const gap = 36

  for (const album of albums) {
    ctx.fillStyle = '#2e2e2e'
    ctx.font = 'bold 64px Arial, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(String(album.rank), lp + rankW, y + imgSize * 0.62)
    ctx.textAlign = 'left'

    const imgX = lp + rankW + 20
    if (images[album.id]) {
      ctx.save()
      roundRect(ctx, imgX, y, imgSize, imgSize, 10)
      ctx.clip()
      ctx.drawImage(images[album.id], imgX, y, imgSize, imgSize)
      ctx.restore()
    } else {
      ctx.fillStyle = '#1c1c1c'
      roundRect(ctx, imgX, y, imgSize, imgSize, 10)
      ctx.fill()
    }

    const tx = imgX + imgSize + 32
    const maxW = W - tx - lp
    ctx.fillStyle = '#f0f0f0'
    ctx.font = '600 38px Arial, sans-serif'
    ctx.fillText(clipText(ctx, album.title, maxW), tx, y + 52)
    ctx.fillStyle = '#999'
    ctx.font = '32px Arial, sans-serif'
    ctx.fillText(clipText(ctx, album.artist, maxW), tx, y + 102)
    if (album.weighted_score > 0) {
      ctx.fillStyle = '#555'
      ctx.font = '28px Arial, sans-serif'
      ctx.fillText(`${album.weighted_score} / 10`, tx, y + 152)
    }
    y += imgSize + gap
  }

  ctx.fillStyle = '#2e2e2e'
  ctx.font = '26px Arial, sans-serif'
  ctx.fillText('spindown.app', lp, H - 80)
}

// Format 2: 1 album per slide with review text
function drawReviewSlide(ctx, { album, page, totalPages, year, image }) {
  drawBackground(ctx)
  const lp = 80
  const contentW = W - lp * 2
  let y = 72

  // Header
  ctx.fillStyle = '#555'
  ctx.font = '500 24px Arial, sans-serif'
  ctx.textAlign = 'left'
  const pageStr = totalPages > 1 ? `  ${page} / ${totalPages}` : ''
  ctx.fillText(`SPINDOWN  •  ${year} Year-End List${pageStr}`, lp, y + 24)
  y += 60

  // Rank
  ctx.fillStyle = '#222'
  ctx.font = 'bold 108px Arial, sans-serif'
  ctx.fillText(`#${album.rank}`, lp, y + 108)
  y += 124

  // Title
  ctx.fillStyle = '#f0f0f0'
  ctx.font = 'bold 52px Arial, sans-serif'
  ctx.fillText(clipText(ctx, album.title, contentW), lp, y + 52)
  y += 66

  // Artist
  ctx.fillStyle = '#888'
  ctx.font = '36px Arial, sans-serif'
  ctx.fillText(clipText(ctx, album.artist, contentW), lp, y + 36)
  y += 60

  // Cover art — full content width, square
  const imgSize = contentW
  if (image) {
    ctx.save()
    roundRect(ctx, lp, y, imgSize, imgSize, 12)
    ctx.clip()
    ctx.drawImage(image, lp, y, imgSize, imgSize)
    ctx.restore()
  } else {
    ctx.fillStyle = '#1c1c1c'
    roundRect(ctx, lp, y, imgSize, imgSize, 12)
    ctx.fill()
  }
  y += imgSize + 52

  // Review text
  if (album.review) {
    const review = album.review.slice(0, REVIEW_MAX)
    ctx.fillStyle = '#bbb'
    ctx.font = '34px Arial, sans-serif'
    const lineHeight = 52
    const maxLines = 5
    let lines = wrapText(ctx, review, contentW)
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines)
      lines[maxLines - 1] = clipText(ctx, lines[maxLines - 1] + '…', contentW)
    }
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], lp, y + i * lineHeight)
    }
    y += lines.length * lineHeight + 36
  }

  // Score
  if (album.weighted_score > 0) {
    ctx.fillStyle = '#555'
    ctx.font = '28px Arial, sans-serif'
    ctx.fillText(`${album.weighted_score} / 10`, lp, y + 28)
  }

  // Footer
  ctx.fillStyle = '#2e2e2e'
  ctx.font = '24px Arial, sans-serif'
  ctx.fillText('spindown.app', lp, H - 60)
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
  canvas.width = W
  canvas.height = H
  drawFn(canvas.getContext('2d'), params)
  return canvas.toDataURL('image/jpeg', 0.92)
}

function StoryExport({ albums, year }) {
  const [exporting, setExporting] = useState(false)
  const [format, setFormat] = useState('grid')

  async function handleExport() {
    setExporting(true)
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
      setExporting(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <button
        onClick={() => setFormat('grid')}
        style={{
          fontSize: '0.75rem',
          padding: '4px 10px',
          background: format === 'grid' ? 'var(--surface-raised)' : 'var(--surface)',
          borderColor: format === 'grid' ? 'var(--border-hover)' : 'var(--border)',
        }}
      >
        5-up
      </button>
      <button
        onClick={() => setFormat('review')}
        style={{
          fontSize: '0.75rem',
          padding: '4px 10px',
          background: format === 'review' ? 'var(--surface-raised)' : 'var(--surface)',
          borderColor: format === 'review' ? 'var(--border-hover)' : 'var(--border)',
        }}
      >
        Review
      </button>
      <button onClick={handleExport} disabled={exporting} style={{ opacity: exporting ? 0.6 : 1 }}>
        {exporting ? 'Generating…' : '↓ Export'}
      </button>
    </div>
  )
}

export default StoryExport
