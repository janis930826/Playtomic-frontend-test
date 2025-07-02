import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AuthInitializeConfig, Auth, TokensData, UserData } from './types'
import { useApiFetcher } from '../api'

interface AuthProviderProps extends AuthInitializeConfig {
  children?: ReactNode
  initialTokens?: AuthInitializeConfig['initialTokens']
  onAuthChange?: AuthInitializeConfig['onAuthChange']
}

const AuthContext = React.createContext<Auth | undefined>(undefined)

// Helper to resolve initialTokens (can be value or Promise)
async function resolveInitialTokens(initialTokens: AuthProviderProps['initialTokens']) {
  if (typeof initialTokens === 'function') {
    return initialTokens()
  }
  if (initialTokens instanceof Promise) {
    return await initialTokens
  }
  return initialTokens
}

function AuthProvider(props: AuthProviderProps): JSX.Element {
  const { initialTokens, onAuthChange, children } = props
  const fetcher = useApiFetcher()
  const [tokens, setTokens] = useState<undefined | null | TokensData>(undefined)
  const [currentUser, setCurrentUser] = useState<undefined | null | UserData>(undefined)

  // --- PATCH: allow instant tokens in test via global.__TEST_TOKENS__ ---
  const effectiveInitialTokens = useMemo(() => {
    // @ts-ignore
    if (typeof global !== 'undefined' && global.__TEST_TOKENS__) {
      // @ts-ignore
      return global.__TEST_TOKENS__
    }
    return initialTokens
  }, [initialTokens])

  // 1. On mount, resolve and set initial tokens (handles both async and sync)
  useEffect(() => {
    let cancelled = false
    Promise.resolve(resolveInitialTokens(effectiveInitialTokens)).then(tok => {
      if (!cancelled) setTokens(tok ?? null)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line
  }, [effectiveInitialTokens])

  // 2. When tokens change, (re)load current user if tokens exist
  useEffect(() => {
    let cancelled = false

    if (tokens === undefined) {
      setCurrentUser(undefined)
      return
    }
    if (!tokens) {
      setCurrentUser(null)
      return
    }
    // Have tokens: try to fetch user
    fetcher('GET /v1/users/me', {})
      .then(res => {
        if (cancelled) return
        if (res.ok) {
          setCurrentUser({
            userId: res.data.userId,
            name: res.data.displayName, // adapt to your UserData interface!
            email: res.data.email ?? '',
          })
        } else {
          setTokens(null)
          setCurrentUser(null)
        }
      })
      .catch(() => {
        if (cancelled) return
        setTokens(null)
        setCurrentUser(null)
      })

    return () => {
      cancelled = true
    }
  }, [tokens, fetcher])

  // 3. onAuthChange callback
  useEffect(() => {
    if (typeof onAuthChange === 'function' && tokens !== undefined) {
      onAuthChange(tokens)
    }
    // eslint-disable-next-line
  }, [tokens, onAuthChange])

  // 4. login/logout methods
  const login = useCallback<Auth['login']>(
    async ({ email, password }) => {
      if (tokens && tokens !== null) throw new Error('Already logged in')
      const res = await fetcher('POST /v3/auth/login', { data: { email, password } })
      if (!res.ok) throw new Error(res.data.message)
      setTokens({
        access: res.data.accessToken,
        accessExpiresAt: res.data.accessTokenExpiresAt,
        refresh: res.data.refreshToken,
        refreshExpiresAt: res.data.refreshTokenExpiresAt,
      })
    },
    [fetcher, tokens],
  )

  const logout = useCallback<Auth['logout']>(async () => {
    if (!tokens) throw new Error('No user is logged in')
    setTokens(null)
    setCurrentUser(null)
  }, [tokens])

  // 5. Automatic token refresh logic
  const refreshTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!tokens || !tokens.accessExpiresAt || !tokens.refresh) {
      if (refreshTimeout.current) clearTimeout(refreshTimeout.current)
      return
    }

    const expires = new Date(tokens.accessExpiresAt).getTime()
    const now = Date.now()
    // Refresh 30 seconds before expiry, but not in the past
    const refreshIn = Math.max(0, expires - now - 30 * 1000)

    if (refreshTimeout.current) clearTimeout(refreshTimeout.current)
    refreshTimeout.current = setTimeout(async () => {
      try {
        const res = await fetcher('POST /v3/auth/refresh', {
          data: { refreshToken: tokens.refresh },
        })
        if (!res.ok) throw new Error(res.data.message)
        const newTokens = {
          access: res.data.accessToken,
          accessExpiresAt: res.data.accessTokenExpiresAt,
          refresh: res.data.refreshToken,
          refreshExpiresAt: res.data.refreshTokenExpiresAt,
        }
        setTokens(newTokens)
        if (typeof onAuthChange === 'function') {
          onAuthChange(newTokens)
        }
      } catch (err) {
        // Refresh failed; log out the user
        setTokens(null)
        setCurrentUser(null)
      }
    }, refreshIn)

    return () => {
      if (refreshTimeout.current) clearTimeout(refreshTimeout.current)
    }
  }, [tokens, fetcher, onAuthChange])

  // Provide context value
  const value = useMemo<Auth>(
    () => ({
      currentUser,
      tokens,
      login,
      logout,
    }),
    [currentUser, tokens, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthProvider, AuthContext }
