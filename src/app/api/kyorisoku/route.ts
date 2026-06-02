import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'URLを指定してください' }, { status: 400 });

  // aidを抽出（aid=xxxxxx または /aid=xxxxxx/）
  const aidMatch = url.match(/aid=([a-zA-Z0-9]+)/);
  if (!aidMatch) return NextResponse.json({ error: 'ルートIDが見つかりません' }, { status: 400 });
  const aid = aidMatch[1];

  const apiUrl = `https://www.mapion.co.jp/f/route/web-api/route_alias/get.html?aid=${aid}`;
  const res = await fetch(apiUrl);
  const xml = await res.text();

  // XMLから座標を抽出
  const allPoints: { lat: number; lng: number }[] = [];
  const pointMatches = xml.matchAll(/<point>\s*<x>([\d.]+)<\/x>\s*<y>([\d.]+)<\/y>\s*<\/point>/g);
  for (const match of pointMatches) {
    allPoints.push({ lat: parseFloat(match[2]), lng: parseFloat(match[1]) });
  }

  const titleMatch = xml.match(/<title>(.*?)<\/title>/);
  const distanceMatch = xml.match(/<distance>([\d.]+)<\/distance>/);

  if (allPoints.length < 2) {
    return NextResponse.json({
      points: allPoints,
      title: titleMatch?.[1] || '無題のルート',
      distance: distanceMatch ? parseFloat(distanceMatch[1]) : 0,
    });
  }

  // 間引き処理：100点以下はそのまま、100点超は100点に間引く（始点・終点は必ず含める）
  const MAX_POINTS = 100;
  const step = Math.max(1, Math.floor(allPoints.length / MAX_POINTS));
  const waypoints = allPoints.filter((_, i) => i % step === 0 || i === allPoints.length - 1);

  // OSRMのURL（radiusesで各点50mのスナップ許容）
  const coords = waypoints.map((p) => `${p.lng},${p.lat}`).join(';');
  const radiuses = waypoints.map(() => '50').join(';');
  const osrmUrl = `https://router.project-osrm.org/route/v1/cycling/${coords}?overview=full&geometries=geojson&radiuses=${radiuses}`;

  try {
    const osrmRes = await fetch(osrmUrl);
    if (osrmRes.ok) {
      const osrmData = await osrmRes.json();
      const route = osrmData.routes?.[0];
      if (route) {
        const geometry: { lat: number; lng: number }[] = (
          route.geometry.coordinates as [number, number][]
        ).map(([lng, lat]) => ({ lat, lng }));
        return NextResponse.json({
          points: geometry,
          title: titleMatch?.[1] || '無題のルート',
          distance: distanceMatch ? parseFloat(distanceMatch[1]) : route.distance,
        });
      }
    }
  } catch {
    // OSRM失敗時は生座標にフォールバック
  }

  return NextResponse.json({
    points: waypoints,
    title: titleMatch?.[1] || '無題のルート',
    distance: distanceMatch ? parseFloat(distanceMatch[1]) : 0,
  });
}
