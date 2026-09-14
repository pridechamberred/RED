import type React from 'react'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import { ServiceWorkerRegister } from '@/components/service-worker-register'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-jb',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'incREDible',
  description:
    "The Pride Chamber's RED Group activity tracker — record vous, referrals, done deals, volunteering and chamber events in seconds.",
  generator: 'v0.app',
  applicationName: 'incREDible',
  manifest: '/manifest.webmanifest',
  // iOS uses these instead of the manifest for its home-screen launch.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'incREDible',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icons/icon-app.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
  // Brand red for the status bar / browser chrome in both schemes so the
  // system's white clock, signal and battery icons stay legible (they vanished
  // against the near-white default). White text is the brand's own
  // --primary-foreground, so contrast is guaranteed.
  themeColor: '#c1362d',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`bg-background ${jakarta.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <ServiceWorkerRegister />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
