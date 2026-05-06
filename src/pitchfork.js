const PROXY = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cover-proxy`

function slug(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export async function checkPitchforkUrl(artist, title) {
  const url = `https://pitchfork.com/reviews/albums/${slug(artist)}-${slug(title)}/`
  try {
    const proxyUrl = `${PROXY}?url=${encodeURIComponent(url)}&check=1`
    const res = await fetch(proxyUrl)
    if (!res.ok) return null
    const data = await res.json()
    return data.ok ? url : null
  } catch {
    return null
  }
}
