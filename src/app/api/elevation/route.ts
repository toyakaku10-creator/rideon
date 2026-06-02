import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { points } = await request.json()

  // 最大512点に間引く
  const step = Math.max(1, Math.floor(points.length / 512))
  const sampled = points.filter((_: unknown, i: number) => i % step === 0)

  const locations = sampled.map((p: { lat: number; lng: number }) =>
    `${p.lat},${p.lng}`
  ).join('|')

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${locations}&key=${apiKey}`

  const res = await fetch(url)
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
