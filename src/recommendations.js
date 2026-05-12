import { supabase } from './supabase'

const LASTFM = 'https://ws.audioscrobbler.com/2.0'
const LASTFM_KEY = import.meta.env.VITE_LASTFM_API_KEY
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const QUEUE_TARGET = 10
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function lfm(method, params) {
  const url = new URL(LASTFM)
  url.search = new URLSearchParams({ method, api_key: LASTFM_KEY, format: 'json', ...params })
  const res = await fetch(url)
  return res.json()
}

async function spotifyAlbumsForYear(artist, year) {
  try {
    const url = `${SUPABASE_URL}/functions/v1/spotify-search?artist=${encodeURIComponent(artist)}&year=${year}`
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY },
    })
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.map(a => ({
      id: null,
      title: a.title,
      'artist-credit': [{ name: a.artist }],
      cover_url: a.cover_url,
      spotify_url: a.spotify_url,
    }))
  } catch {
    return []
  }
}

async function itunesAlbumsForYear(artist, year) {
  try {
    const q = encodeURIComponent(artist)
    const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=album&attribute=artistTerm&limit=25`)
    const data = await res.json()
    const skipPattern = /\b(single|remix|live|acoustic|instrumental|deluxe|edition|remaster)\b/i
    return (data.results || []).filter(r =>
      r.wrapperType === 'collection' &&
      r.collectionType === 'Album' &&
      (r.releaseDate || '').startsWith(String(year)) &&
      !skipPattern.test(r.collectionName)
    ).map(r => ({
      id: null,
      title: r.collectionName,
      'artist-credit': [{ name: r.artistName }],
      'first-release-date': r.releaseDate?.slice(0, 10) || '',
      cover_url: r.artworkUrl100?.replace('100x100bb', '600x600bb') || null,
    }))
  } catch {
    return []
  }
}


export async function generateRecommendations(userId, year) {
  if (!LASTFM_KEY) { console.warn('[recs] VITE_LASTFM_API_KEY is not set'); return }

  const { data: albums, error: albumsError } = await supabase
    .from('albums')
    .select('title, artist, mbid')
    .eq('user_id', userId)
    .eq('year', year)

  if (albumsError) { console.error('[recs] albums fetch error', albumsError); return }
  if (!albums?.length) { console.log('[recs] no albums yet'); return }

  const { count, error: countError } = await supabase
    .from('listening_queue')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('year', year)
    .eq('status', 'pending')

  if (countError) { console.error('[recs] queue count error', countError); return }
  if (count >= QUEUE_TARGET) { console.log('[recs] queue full, skipping'); return }

  const { data: existingQueue } = await supabase
    .from('listening_queue')
    .select('title, artist')
    .eq('user_id', userId)
    .eq('year', year)

  const skip = new Set([
    ...(albums || []).map(a => `${a.artist}|||${a.title}`.toLowerCase()),
    ...(existingQueue || []).map(q => `${q.artist}|||${q.title}`.toLowerCase()),
  ])

  const existingArtists = new Set(albums.map(a => a.artist.toLowerCase()))
  const artists = [...new Set(albums.map(a => a.artist))].slice(0, 5)

  const similarArtists = new Set()
  for (const artist of artists) {
    const data = await lfm('artist.getSimilar', { artist, limit: 5 })
    if (data.error) { console.error('[recs] Last.fm getSimilar error', data.message); continue }
    for (const s of data.similarartists?.artist || []) {
      if (!existingArtists.has(s.name.toLowerCase())) similarArtists.add(s.name)
    }
  }

  console.log('[recs] similar artists found:', [...similarArtists])

  const needed = QUEUE_TARGET - count
  const recommendations = []

  for (const artist of [...similarArtists].slice(0, 20)) {
    if (recommendations.length >= needed) break

    let results = await spotifyAlbumsForYear(artist, year)
    if (results.length === 0) results = await itunesAlbumsForYear(artist, year)
    await sleep(200)

    for (const rg of results) {
      const title = rg.title
      const artistName = rg['artist-credit']?.[0]?.name || artist
      const key = `${artistName}|||${title}`.toLowerCase()
      if (skip.has(key)) continue
      recommendations.push({
        user_id: userId, year,
        mbid: null,
        title,
        artist: artistName,
        cover_url: rg.cover_url || null,
        spotify_url: rg.spotify_url || null,
        status: 'pending',
        reason: artist,
      })
      skip.add(key)
      break
    }
  }

  for (const rec of recommendations) {
    if (rec.spotify_url) continue
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/spotify-search?artist=${encodeURIComponent(rec.artist)}&title=${encodeURIComponent(rec.title)}`,
        { headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY } }
      )
      if (res.ok) {
        const data = await res.json()
        if (data?.spotify_url) rec.spotify_url = data.spotify_url
      }
    } catch {}
    await sleep(250)
  }

  console.log('[recs] inserting', recommendations.length, 'recommendations')
  if (recommendations.length > 0) {
    const { error } = await supabase.from('listening_queue').insert(recommendations)
    if (error) console.error('[recs] insert error', error)
  }
}
