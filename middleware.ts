import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({ name, value, ...options })
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLogin = request.nextUrl.pathname.startsWith("/login")
  const isAuthConfirm = request.nextUrl.pathname.startsWith("/auth/confirm")
  const isAuthCodeError = request.nextUrl.pathname.startsWith("/auth/auth-code-error")
  if (!user && !isLogin && !isAuthConfirm && !isAuthCodeError) {
    const url = new URL("/login", request.url)
    return NextResponse.redirect(url)
  }

  if (user && isLogin) {
    const url = new URL("/", request.url)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
