const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

let cachedToken: { value: string; expires: number } | null = null

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) return cachedToken.value

  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID')
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET')
  if (!clientId || !clientSecret) throw new Error('Spotify credentials not configured')

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) throw new Error(`Token request failed: ${res.status}`)
  const data = await res.json()

  cachedToken = { value: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 }
  return cachedToken.value
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const params = new URL(req.url).searchParams
  const artist = params.get('artist')
  const year = params.get('year')
  const title = params.get('title')

  if (!artist) return new Response('Missing artist', { status: 400, headers: CORS })
  if (!year && !title) return new Response('Missing year or title', { status: 400, headers: CORS })

  try {
    const token = await getToken()

    if (title) {
      const titleLower = title.toLowerCase()
      const artistLower = artist.toLowerCase()
      const headers = { 'Authorization': `Bearer ${token}` }

      // Step 1: find the artist ID by name
      const artistRes = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(artist)}&type=artist&limit=5&market=US`,
        { headers }
      )
      if (!artistRes.ok) throw new Error(`Artist search failed: ${artistRes.status}`)
      const artistData = await artistRes.json()
      const artistItems: any[] = artistData.artists?.items ?? []
      const artistMatch = artistItems.find((a: any) => a.name.toLowerCase() === artistLower)
        ?? artistItems[0]

      if (artistMatch) {
        // Step 2: get all studio albums for this artist and match by title
        const albumsRes = await fetch(
          `https://api.spotify.com/v1/artists/${artistMatch.id}/albums?include_groups=album&limit=50&market=US`,
          { headers }
        )
        if (albumsRes.ok) {
          const albumsData = await albumsRes.json()
          const albums: any[] = albumsData.items ?? []
          const albumMatch = albums.find((a: any) => a.name.toLowerCase() === titleLower)
            ?? albums.find((a: any) => a.name.toLowerCase().includes(titleLower))
          if (albumMatch) {
            return new Response(JSON.stringify({ spotify_url: albumMatch.external_urls?.spotify ?? null }), {
              headers: { ...CORS, 'Content-Type': 'application/json' },
            })
          }
        }
      }

      // Fallback: plain search query
      const fallbackRes = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(`${artist} ${title}`)}&type=album&limit=10&market=US`,
        { headers }
      )
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json()
        const fallbackItems: any[] = fallbackData.albums?.items ?? []
        const fallbackMatch = fallbackItems.find((a: any) =>
          a.artists?.some((ar: any) => ar.name.toLowerCase() === artistLower) &&
          a.name.toLowerCase() === titleLower
        ) ?? null
        return new Response(JSON.stringify({ spotify_url: fallbackMatch?.external_urls?.spotify ?? null }), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ spotify_url: null }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Year-based search — returns array of albums for recommendations
    const q = encodeURIComponent(`artist:"${artist}" year:${year}`)
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${q}&type=album&limit=10&market=US`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
    if (!res.ok) throw new Error(`Spotify search failed: ${res.status}`)
    const data = await res.json()

    const albums = (data.albums?.items ?? [])
      .filter((a: any) => (a.release_date ?? '').startsWith(year) && a.album_type === 'album')
      .map((a: any) => ({
        title: a.name,
        artist: a.artists?.[0]?.name ?? artist,
        cover_url: a.images?.[0]?.url ?? null,
        spotify_url: a.external_urls?.spotify ?? null,
      }))

    return new Response(JSON.stringify(albums), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
