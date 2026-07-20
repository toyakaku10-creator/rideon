import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RideOn',
  description: '自転車ライドアプリ',
  openGraph: {
    title: 'RideOn',
    description: '自転車ライドアプリ',
    url: 'https://rideon-map.vercel.app',
    siteName: 'RideOn',
    images: [
      {
        url: 'https://rideon-map.vercel.app/icon-512.png',
        width: 512,
        height: 512,
        alt: 'RideOn',
      },
    ],
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, interactive-widget=resizes-content" />
        <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Bebas+Neue&family=Pacifico&family=Satisfy&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#D4AF37" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="RideOn" />
      </head>
      <body>{children}</body>
    </html>
  );
}
