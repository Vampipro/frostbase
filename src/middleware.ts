import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Paths that require admin role
const ADMIN_API_PATHS = ['/api/panel/']
const ADMIN_PAGE_PATHS = ['/panel']
// Public paths under /panel that don't require admin
const PANEL_PUBLIC_PATHS = ['/panel/register']

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl

    // Skip protection for public panel paths (e.g. /panel/register)
    if (PANEL_PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
      // But still check if already admin — redirect to panel
      try {
        const token = await getToken({
          req: request,
          secret: process.env.NEXTAUTH_SECRET,
        })
        if (token?.role === 'admin') {
          return NextResponse.redirect(new URL('/panel', request.url))
        }
      } catch {
        // If token check fails, just let them through to register page
      }
      return NextResponse.next()
    }

    // Check if path requires admin protection
    const isProtectedApi = ADMIN_API_PATHS.some((p) => pathname.startsWith(p))
    const isProtectedPage = ADMIN_PAGE_PATHS.some((p) => pathname.startsWith(p))

    if (!isProtectedApi && !isProtectedPage) {
      return NextResponse.next()
    }

    // Get JWT token
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token) {
      // For API routes return 401 JSON, for pages redirect to register
      if (isProtectedApi) {
        return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
      }
      const loginUrl = new URL('/', request.url)
      return NextResponse.redirect(loginUrl)
    }

    // Check admin role
    if (token.role !== 'admin') {
      if (isProtectedApi) {
        return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 })
      }
      const registerUrl = new URL('/panel/register', request.url)
      return NextResponse.redirect(registerUrl)
    }

    return NextResponse.next()
  } catch (error) {
    // If middleware crashes, let the request through — page handles auth itself
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/api/panel/:path*',
    '/panel/:path*',
  ],
}
