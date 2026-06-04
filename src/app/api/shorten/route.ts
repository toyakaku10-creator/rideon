import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { url } = await request.json()

  try {
    const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`)
    if (res.ok) {
      const shortUrl = await res.text()
      return NextResponse.json({ shortUrl })
    }
  } catch (e) {
    console.error('TinyURL error:', e)
  }

  return NextResponse.json({ shortUrl: url })
}
