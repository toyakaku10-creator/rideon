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
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
