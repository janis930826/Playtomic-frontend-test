import React, { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { AuthInitializeConfig, Auth, TokensData, UserData } from './types'
import { useApiFetcher } from '../api'

interface AuthProviderProps extends AuthInitializeConfig {
  children?: ReactNode
  initialTokens?: AuthInitializeConfig['initialTokens']
  onAuthChange?: AuthInitializeConfig['onAuthChange']
}

// Helper to resolve initialTokens (can be sync value or Promise)
async function resolveInitialTokens(initialTokens: AuthProviderProps['initialTokens']) {
  if (typeof initialTokens === 'function') {
    return initialTokens()
  }
  if (initialTokens instanceof Promise) {
    return await initialTokens
  }
  return initialTokens
}

const AuthContext = React.createContext<Auth | undefined>(undefined)

function AuthProvider(props: AuthProviderProps): JSX.Element {
  const { initialTokens, onAuthChange, children } = props
  const fetcher = useApiFetcher()

  const [tokens, setTokens] = useState<undefined | null | TokensData>(undefined)
  const [currentUser, setCurrentUser] = useState<undefined | null | UserData>(undefined)

  // 1. On mount, resolve and set initial tokens (handles both async and sync)
  useEffect(() => {
    let cancelled = false
    resolveInitialTokens(initialTokens).then(tok => {
      if (!cancelled) setTokens(tok ?? null)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line
  }, [initialTokens])

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
            name: res.data.displayName, // map to match Auth type!
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
