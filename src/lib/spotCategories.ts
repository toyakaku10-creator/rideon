export const SPOT_CATEGORIES = [
  { id: 'convenience', label: 'コンビニ', emoji: '🏪' },
  { id: 'water', label: '補給', emoji: '💧' },
  { id: 'view', label: '絶景', emoji: '🏔' },
  { id: 'rest', label: '休憩', emoji: '🪑' },
  { id: 'pin', label: 'その他', emoji: '📍' },
];

export function spotEmoji(category: string): string {
  return SPOT_CATEGORIES.find((c) => c.id === category)?.emoji ?? '📍';
}
