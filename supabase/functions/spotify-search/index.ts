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

      // Strip edition/remaster suffixes; extract primary artist from collaborations
      const normalize = (s: string) => s.toLowerCase().replace(/\s*[\(\[][^\)\]]*[\)\]]/g, '').trim()
      const titleNorm = normalize(title)
      const primaryArtist = artist.split(/\s*[,&]\s*/)[0].trim()

      const titleMatches = (albumName: string) => {
        const n = normalize(albumName)
        return n === titleNorm || albumName.toLowerCase() === titleLower
      }

      // Strategy 1: Spotify field-operator search (most precise)
      const nativeRes = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(`album:${title} artist:${primaryArtist}`)}&type=album&limit=5&market=US`,
        { headers }
      )
      if (nativeRes.ok) {
        const nativeItems: any[] = (await nativeRes.json()).albums?.items ?? []
        const nativeMatch = nativeItems.find((a: any) => titleMatches(a.name))
        if (nativeMatch) {
          return new Response(JSON.stringify({ spotify_url: nativeMatch.external_urls?.spotify ?? null }), {
            headers: { ...CORS, 'Content-Type': 'application/json' },
          })
        }
      }

      // Strategy 2: artist ID → full album catalogue → title match
      const artistRes = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(primaryArtist)}&type=artist&limit=5&market=US`,
        { headers }
      )
      if (artistRes.ok) {
        const artistItems: any[] = (await artistRes.json()).artists?.items ?? []
        const artistMatch = artistItems.find((a: any) => a.name.toLowerCase() === primaryArtist.toLowerCase())
          ?? artistItems[0]
        if (artistMatch) {
          const albumsRes = await fetch(
            `https://api.spotify.com/v1/artists/${artistMatch.id}/albums?include_groups=album&limit=50&market=US`,
            { headers }
          )
          if (albumsRes.ok) {
            const albums: any[] = (await albumsRes.json()).items ?? []
            const albumMatch = albums.find((a: any) => titleMatches(a.name))
            if (albumMatch) {
              return new Response(JSON.stringify({ spotify_url: albumMatch.external_urls?.spotify ?? null }), {
                headers: { ...CORS, 'Content-Type': 'application/json' },
              })
            }
          }
        }
      }

      // Strategy 3: broad keyword search with artist filter
      const fallbackRes = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(`${primaryArtist} ${title}`)}&type=album&limit=10&market=US`,
        { headers }
      )
      if (fallbackRes.ok) {
        const fallbackItems: any[] = (await fallbackRes.json()).albums?.items ?? []
        const fallbackMatch = fallbackItems.find((a: any) =>
          a.artists?.some((ar: any) => ar.name.toLowerCase() === artistLower || ar.name.toLowerCase() === primaryArtist.toLowerCase()) &&
          titleMatches(a.name)
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
      .filter((a: any) => (a.release_date ?? '').startsWith(year) && (a.album_type === 'album' || a.album_type === 'ep'))
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
