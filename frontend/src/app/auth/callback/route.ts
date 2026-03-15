import { createServerSideClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get('next') ?? '/dashboard'

    if (code) {
        const supabase = await createServerSideClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            const host = request.headers.get('host');
            const protocol = request.headers.get('x-forwarded-proto') || 'https';
            const baseUrl = `${protocol}://${host}`;
            return NextResponse.redirect(new URL(next, baseUrl));
        }
    }

    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = `${protocol}://${host}`;

    // return the user to an error page with instructions
    return NextResponse.redirect(new URL(`/login?error=Could not authenticate user`, baseUrl))
}
