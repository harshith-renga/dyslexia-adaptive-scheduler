import { createContext, useContext, useEffect, useState } from 'react'
import * as api from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })

  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user))
    else localStorage.removeItem('user')
  }, [user])

  const login = async ({ username, password }) => {
    // Backend now returns { message, user_id, username }
    const res = await api.login({ username, password })
    const userObj = {
      username: res.username || username,
      user_id:  res.user_id,
    }
    setUser(userObj)
    return userObj
  }

  const register = async ({ username, email, password }) => {
    // Backend returns { message, user_id } — then auto-login
    const res = await api.register({ username, email, password })
    const userObj = {
      username,
      user_id: res.user_id,
    }
    setUser(userObj)
    return userObj
  }

  const logout = () => setUser(null)

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
export default AuthContext
