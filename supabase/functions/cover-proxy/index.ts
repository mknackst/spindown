const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const imageUrl = new URL(req.url).searchParams.get('url')
  if (!imageUrl) return new Response('Missing url', { status: 400, headers: CORS })

  try {
    const res = await fetch(imageUrl)
    if (!res.ok) return new Response('Upstream error', { status: res.status, headers: CORS })
    const blob = await res.blob()
    return new Response(blob, {
      headers: {
        ...CORS,
        'Content-Type': res.headers.get('Content-Type') ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return new Response('Proxy error', { status: 502, headers: CORS })
  }
})
