import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware to enforce HTTPS in production and ensure basic security headers.
 * Cloud Run sets the 'x-forwarded-proto' header.
 */
export function proxy(request: NextRequest) {
    const protocol = request.headers.get('x-forwarded-proto')
    const host = request.headers.get('host')

    // Force HTTPS in production
    // Skip if on localhost or development environment
    if (
        process.env.NODE_ENV === 'production' &&
        protocol === 'http' &&
        host &&
        !host.includes('localhost')
    ) {
        const httpsUrl = `https://${host}${request.nextUrl.pathname}${request.nextUrl.search}`
        return NextResponse.redirect(new URL(httpsUrl), 301)
    }

    const response = NextResponse.next()

    // Additional security headers (redundant with next.config.ts but safer to have here as well)
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - logo/ (assets)
         */
        '/((?!_next/static|_next/image|favicon.ico|logo/).*)',
    ],
}
