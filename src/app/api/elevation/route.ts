import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { points } = await request.json()

  // 最大256点に間引く（長いルートでURLが上限を超えないよう、POST bodyで送る）
  const MAX_POINTS = 256
  const step = Math.max(1, Math.floor(points.length / MAX_POINTS))
  const sampled = points.filter((_: unknown, i: number) => i % step === 0)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const url = `https://maps.googleapis.com/maps/api/elevation/json`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locations: sampled.map((p: { lat: number; lng: number }) => ({ lat: p.lat, lng: p.lng })),
      key: apiKey,
    }),
  })
  const text = await res.text()
  console.log('Elevation API response:', text.substring(0, 200))

  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    console.error('Failed to parse elevation response:', text.substring(0, 500))
    return NextResponse.json({ error: 'Invalid API response' }, { status: 500 })
  }

  if (data.status !== 'OK') {
    console.error('Elevation API status:', data.status, data.error_message)
    return NextResponse.json({ error: 'Elevation API error', status: data.status }, { status: 500 })
  }

  return NextResponse.json({
    elevations: data.results.map((r: { elevation: number }) => r.elevation),
  })
}
