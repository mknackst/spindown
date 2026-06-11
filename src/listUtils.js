export function sameAlbum(a, b) {
  if (a.mbid && b.mbid) return a.mbid === b.mbid
  return a.title.toLowerCase().trim() === b.title.toLowerCase().trim() &&
         a.artist.toLowerCase().trim() === b.artist.toLowerCase().trim()
}

// Jaccard overlap (60%) + rank agreement on shared albums (40%)
export function computeTasteMatch(shared, total1, total2) {
  if (total1 === 0 || total2 === 0 || shared.length === 0) return 0
  const union = total1 + total2 - shared.length
  const jaccard = union > 0 ? shared.length / union : 0
  const maxDiff = Math.max(total1, total2) - 1 || 1
  const rankAgreement = shared.reduce((sum, a) => sum + (1 - a.diff / maxDiff), 0) / shared.length
  return Math.round((jaccard * 0.6 + rankAgreement * 0.4) * 100)
}
