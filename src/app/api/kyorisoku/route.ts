import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const kyorisokuUrl = request.nextUrl.searchParams.get('url');

  if (!kyorisokuUrl) {
    return Response.json({ error: 'URLが指定されていません' }, { status: 400 });
  }

  let html: string;
  try {
    const res = await fetch(kyorisokuUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
    if (!res.ok) {
      return Response.json(
        { error: `ページの取得に失敗しました (HTTP ${res.status})` },
        { status: 502 }
      );
    }
    html = await res.text();
  } catch (err) {
    return Response.json(
      { error: `ネットワークエラー: ${err instanceof Error ? err.message : '不明なエラー'}` },
      { status: 502 }
    );
  }

  // Extract _latlngs array from the Vue app state embedded in HTML
  const match = html.match(
    /"_latlngs"\s*:\s*(\[[\s\S]*?\])\s*,\s*"_initHooksCalled"/
  );
  if (!match) {
    return Response.json(
      { error: 'ルートデータが見つかりませんでした。URLを確認してください。' },
      { status: 404 }
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(match[1]);
  } catch {
    return Response.json({ error: 'ルートデータの解析に失敗しました' }, { status: 500 });
  }

  if (!Array.isArray(raw)) {
    return Response.json({ error: 'ルートデータの形式が不正です' }, { status: 500 });
  }

  // Support both flat [{lat,lng}] and nested [[{lat,lng}]] (Leaflet multi-polyline)
  const flat: unknown[] = Array.isArray(raw[0]) ? (raw as unknown[][]).flat() : raw;

  const points = flat
    .filter(
      (p): p is { lat: number; lng: number } =>
        p !== null &&
        typeof p === 'object' &&
        typeof (p as Record<string, unknown>).lat === 'number' &&
        typeof (p as Record<string, unknown>).lng === 'number'
    )
    .map((p) => ({ lat: p.lat, lng: p.lng }));

  if (points.length < 2) {
    return Response.json({ error: 'ルートの座標が不足しています' }, { status: 404 });
  }

  return Response.json(points);
}
