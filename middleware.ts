import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Redirect old chat routes to finance dashboard
  if (request.nextUrl.pathname.startsWith('/chat')) {
    return NextResponse.redirect(new URL('/finance/dashboard', request.url))
  }

  const isProtected = request.nextUrl.pathname.startsWith('/finance')
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') ||
                     request.nextUrl.pathname.startsWith('/register')

  // Skip Supabase call entirely if no auth cookie present on public pages
  const hasAuthCookie = request.cookies.getAll().some(c => c.name.startsWith('sb-'))
  if (isAuthPage && !hasAuthCookie) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/finance/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/finance/:path*', '/login', '/register', '/chat/:path*'],
}
