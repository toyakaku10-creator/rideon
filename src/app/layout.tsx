import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'cycle-map',
  description: '自転車ルート計測アプリ',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
