import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { points } = await request.json()

  const MAX_POINTS = 512

  // 累積距離を計算
  const cumDist: number[] = [0]
  for (let i = 1; i < points.length; i++) {
    const dLat = (points[i].lat - points[i-1].lat) * Math.PI / 180
    const dLng = (points[i].lng - points[i-1].lng) * Math.PI / 180
    const d = Math.sqrt(dLat * dLat + dLng * dLng) * 6371000
    cumDist.push(cumDist[i-1] + d)
  }
  const totalDist = cumDist[cumDist.length - 1]

  // 距離ベースで均等にMAX_POINTS点を選ぶ
  const sampled: {lat: number, lng: number}[] = []
  for (let i = 0; i < MAX_POINTS; i++) {
    const targetDist = (i / (MAX_POINTS - 1)) * totalDist
    let idx = 0
    for (let j = 1; j < cumDist.length; j++) {
      if (cumDist[j] >= targetDist) { idx = j - 1; break }
      idx = j
    }
    sampled.push(points[idx])
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const locations = sampled
    .map((p: { lat: number; lng: number }) => `${p.lat},${p.lng}`)
    .join('|')

  const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${locations}&key=${apiKey}`

  const res = await fetch(url)
  const text = await res.text()
  console.log('Elevation API response status:', res.status)
  console.log('Elevation API response text:', text.substring(0, 500))

  let data
  try {
    data = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid response' }, { status: 500 })
  }

  console.log('Elevation data status:', data.status)
  console.log('Elevation error:', data.error_message)
  if (data.status !== 'OK') {
    console.error('Elevation API error:', data.status, data.error_message)
    return NextResponse.json({ error: data.error_message || data.status }, { status: 500 })
  }

  return NextResponse.json({
    elevations: data.results.map((r: { elevation: number }) => r.elevation),
  })
}
