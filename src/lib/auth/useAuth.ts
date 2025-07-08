import { useContext } from 'react'
import { Auth } from './types'
import { AuthContext } from './AuthProvider'

function useAuth(): Auth {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new TypeError('useAuth must be used within an AuthProvider')
  }
  return ctx
}

export { useAuth }
