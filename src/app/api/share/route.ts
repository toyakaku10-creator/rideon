import { NextRequest, NextResponse } from 'next/server'

const PROJECT_ID = 'rideon-aad80'
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/shared_routes`

export async function POST(request: NextRequest) {
  const { points, distance, title, spots, elevations } = await request.json()

  const id = Math.random().toString(36).substring(2, 8)
  const url = `${FIRESTORE_BASE}/${id}`

  const body = {
    fields: {
      points: { stringValue: JSON.stringify(points) },
      distance: { doubleValue: distance },
      title: { stringValue: title || '無題のルート' },
      spots: { stringValue: JSON.stringify(spots || []) },
      elevations: { stringValue: JSON.stringify(elevations || []) },
      createdAt: { timestampValue: new Date().toISOString() },
    },
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to save route' }, { status: 500 })
  }

  return NextResponse.json({ id })
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'No id' }, { status: 400 })

  const url = `${FIRESTORE_BASE}/${id}`
  const res = await fetch(url)
  if (!res.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data = await res.json()
  const fields = data.fields

  return NextResponse.json({
    points: JSON.parse(fields.points.stringValue),
    distance: fields.distance.doubleValue,
    title: fields.title.stringValue,
    spots: fields.spots?.stringValue ? JSON.parse(fields.spots.stringValue) : [],
    elevations: fields.elevations?.stringValue ? JSON.parse(fields.elevations.stringValue) : [],
  })
}
