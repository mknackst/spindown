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
  if (!artist || !year) return new Response('Missing artist or year', { status: 400, headers: CORS })

  try {
    const token = await getToken()
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
