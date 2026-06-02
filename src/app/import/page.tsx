'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ImportPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!url.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/kyorisoku?url=${encodeURIComponent(url.trim())}`);
      const data: unknown = await res.json();
      if (!res.ok) {
        setError((data as { error?: string }).error ?? '取得に失敗しました');
        setLoading(false);
        return;
      }
      const { points, distance } = data as { points: { lat: number; lng: number }[]; distance: number };
      if (!Array.isArray(points) || points.length < 2) {
        setError('座標データが不足しています');
        setLoading(false);
        return;
      }
      sessionStorage.setItem('cycle-map-import-result', JSON.stringify({ points, distance }));
      router.push('/');
    } catch {
      setError('ネットワークエラーが発生しました');
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#ffffff', display: 'flex', flexDirection: 'column', maxWidth: '480px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#1a1a1a' }}>キョリ測からインポート</h2>
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666', lineHeight: 1 }}
        >✕</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '24px 16px 16px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <p style={{ fontSize: '13px', color: '#666', margin: '0 0 8px' }}>キョリ測のURL</p>
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
          placeholder="https://www.mapion.co.jp/m/route/..."
          disabled={loading}
          autoFocus
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '12px', fontSize: '16px', border: '1px solid #ddd', borderRadius: '10px', outline: 'none', WebkitAppearance: 'none' } as React.CSSProperties}
        />
        {error && (
          <p style={{ color: '#E53935', fontSize: '13px', margin: '10px 0 0' }}>{error}</p>
        )}
      </div>

      {/* Footer */}
      <div style={{ flexShrink: 0, padding: '16px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
        <button
          onClick={handleConfirm}
          disabled={!url.trim() || loading}
          style={{ width: '100%', padding: '14px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', opacity: !url.trim() || loading ? 0.4 : 1 }}
        >
          {loading ? '取得中...' : '取得する'}
        </button>
      </div>
    </div>
  );
}
