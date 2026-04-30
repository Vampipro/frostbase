'use client'

import { useEffect, useRef } from 'react'
import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const observerRef = useRef<MutationObserver | null>(null)

  useEffect(() => {
    const html = document.documentElement

    // Set dark once on mount
    html.classList.remove('light')
    html.classList.add('dark')

    // Watch for light class being added by root ThemeProvider
    observerRef.current = new MutationObserver(() => {
      if (html.classList.contains('light')) {
        observerRef.current?.disconnect()
        html.classList.remove('light')
        if (!html.classList.contains('dark')) {
          html.classList.add('dark')
        }
        observerRef.current?.observe(html, {
          attributes: true,
          attributeFilter: ['class'],
        })
      }
    })

    observerRef.current.observe(html, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => {
      observerRef.current?.disconnect()
    }
  }, [])

  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  )
}
