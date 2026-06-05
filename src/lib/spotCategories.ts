// lucide-react の SVG path（d属性のみ）をマーカー埋め込み用に定義
const LUCIDE_PATHS: Record<string, string> = {
  Droplets: 'M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05zm13-5.3c1.3 0 2.35-1.08 2.35-2.38 0-.68-.33-1.33-1-1.87S20.17 5.8 20 5c-.17.8-.67 1.67-1.35 2.22s-1 1.19-1 1.87c0 1.3 1.05 2.38 2.35 2.38zm-1.35 8.68C17.44 18 16 16.53 16 14.78c0-.68.31-1.39.93-2.04l3.07-2.74 3.07 2.74c.62.65.93 1.36.93 2.04C24 16.53 22.56 18 20.65 19.38z',
  Mountain: 'M8 3l4 8 5-5 5 15H2L8 3z',
  MapPin: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
};

// カスタム SVG（複数要素・非標準 viewBox）の定義
const CUSTOM_SVG_DEFS: Record<string, { inner: string; viewBox: string }> = {
  rest: {
    viewBox: '0 0 32 28',
    inner: '<line x1="1" y1="26" x2="6" y2="7"/><line x1="11" y1="26" x2="6" y2="7"/><line x1="3" y1="19" x2="9" y2="19"/><line x1="17" y1="24" x2="22" y2="5"/><line x1="27" y1="24" x2="22" y2="5"/><line x1="19" y1="17" x2="25" y2="17"/><line x1="6" y1="7" x2="22" y2="5"/>',
  },
};

export const SPOT_CATEGORIES = [
  { id: 'rest',  label: '休憩',   icon: 'custom',    emoji: '🚲' },
  { id: 'water', label: '補給',   icon: 'Droplets',  emoji: '💧' },
  { id: 'view',  label: '絶景',   icon: 'Mountain',  emoji: '🏔' },
  { id: 'pin',   label: 'その他', icon: 'MapPin',    emoji: '📍' },
];

export function spotEmoji(category: string): string {
  return SPOT_CATEGORIES.find((c) => c.id === category)?.emoji ?? '📍';
}

export function spotLucidePath(category: string): string {
  const cat = SPOT_CATEGORIES.find((c) => c.id === category);
  return LUCIDE_PATHS[cat?.icon ?? 'MapPin'] ?? LUCIDE_PATHS.MapPin;
}

/** カスタム SVG を持つカテゴリの場合、inner と viewBox を返す。lucide アイコンの場合は null。 */
export function spotCustomSvg(category: string): { inner: string; viewBox: string } | null {
  return CUSTOM_SVG_DEFS[category] ?? null;
}
