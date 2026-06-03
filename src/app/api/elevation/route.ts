import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { points } = await request.json()

  // 最大256点に間引く
  const MAX_POINTS = 256
  const step = Math.max(1, Math.floor(points.length / MAX_POINTS))
  const sampled = points.filter((_: unknown, i: number) => i % step === 0)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const url = `https://maps.googleapis.com/maps/api/elevation/json?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locations: sampled.map((p: { lat: number; lng: number }) => ({ lat: p.lat, lng: p.lng })),
    }),
  })

  const text = await res.text()
  console.log('Elevation response status:', res.status)
  console.log('Elevation response:', text.substring(0, 300))

  let data
  try {
    data = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid response from Elevation API' }, { status: 500 })
  }

  if (data.status !== 'OK') {
    return NextResponse.json({ error: data.error_message || data.status }, { status: 500 })
  }

  return NextResponse.json({
    elevations: data.results.map((r: { elevation: number }) => r.elevation),
  })
}
