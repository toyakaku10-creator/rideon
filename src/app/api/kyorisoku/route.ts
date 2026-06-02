import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'URLを指定してください' }, { status: 400 })

  const aidMatch = url.match(/aid=([a-zA-Z0-9]+)/)
  if (!aidMatch) return NextResponse.json({ error: 'ルートIDが見つかりません' }, { status: 400 })
  const aid = aidMatch[1]

  const apiUrl = `https://www.mapion.co.jp/f/route/web-api/route_alias/get.html?aid=${aid}`
  const res = await fetch(apiUrl)
  const xml = await res.text()

  const allPoints: { lat: number; lng: number }[] = []
  const pointMatches = xml.matchAll(/<point>\s*<x>([\d.]+)<\/x>\s*<y>([\d.]+)<\/y>\s*<\/point>/g)
  for (const match of pointMatches) {
    allPoints.push({ lat: parseFloat(match[2]), lng: parseFloat(match[1]) })
  }

  if (allPoints.length === 0) {
    return NextResponse.json({ error: 'ルートデータが見つかりませんでした' }, { status: 404 })
  }

  const titleMatch = xml.match(/<title>(.*?)<\/title>/)
  const distanceMatch = xml.match(/<distance>([\d.]+)<\/distance>/)

  const KYORISOKU_OFFSET = { lat: 0.00245, lng: -0.00372 }
  let points = allPoints.map((p) => ({
    lat: p.lat + KYORISOKU_OFFSET.lat,
    lng: p.lng + KYORISOKU_OFFSET.lng,
  }))

  return NextResponse.json({
    points,
    title: titleMatch?.[1] || '無題のルート',
    distance: distanceMatch ? parseFloat(distanceMatch[1]) : 0,
  })
}
