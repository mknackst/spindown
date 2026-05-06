import { supabase } from './supabase'

const LASTFM = 'https://ws.audioscrobbler.com/2.0'
const LASTFM_KEY = import.meta.env.VITE_LASTFM_API_KEY
const QUEUE_TARGET = 10
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function lfm(method, params) {
  const url = new URL(LASTFM)
  url.search = new URLSearchParams({ method, api_key: LASTFM_KEY, format: 'json', ...params })
  const res = await fetch(url)
  return res.json()
}

async function mbAlbumsForYear(artist, year) {
  await sleep(1100)
  const res = await fetch(
    `https://musicbrainz.org/ws/2/release-group?query=artist:${encodeURIComponent(`"${artist}"`)}&type=album&fmt=json&limit=10`
  )
  const data = await res.json()
  return (data['release-groups'] || []).filter(rg =>
    (rg['first-release-date'] || '').startsWith(String(year))
  )
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

    const mbResults = await mbAlbumsForYear(artist, year)
    for (const rg of mbResults) {
      const key = `${artist}|||${rg.title}`.toLowerCase()
      if (skip.has(key)) continue
      recommendations.push({
        user_id: userId, year,
        mbid: rg.id,
        title: rg.title,
        artist: rg['artist-credit']?.[0]?.name || artist,
        cover_url: `https://coverartarchive.org/release-group/${rg.id}/front`,
        status: 'pending',
      })
      skip.add(key)
      break
    }
  }

  console.log('[recs] inserting', recommendations.length, 'recommendations')
  if (recommendations.length > 0) {
    const { error } = await supabase.from('listening_queue').insert(recommendations)
    if (error) console.error('[recs] insert error', error)
  }
}
