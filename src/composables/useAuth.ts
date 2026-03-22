import { ref, computed } from 'vue'
import type { User } from '@/types'
import { api } from '@/utils/api'

const user = ref<User | null>(null)
const loading = ref(false)
const initialized = ref(false)

export function useAuth() {
  const isLoggedIn = computed(() => !!user.value)

  async function init() {
    if (initialized.value) return
    
    const savedToken = localStorage.getItem('auth_token')
    if (savedToken) {
      api.setToken(savedToken)
      try {
        const response = await api.verifyAuth()
        user.value = response.user
      } catch {
        localStorage.removeItem('auth_token')
        api.setToken(null)
      }
    }
    initialized.value = true
  }

  async function register(username: string, password: string) {
    loading.value = true
    try {
      const response = await api.register(username, password)
      user.value = response.user
      localStorage.setItem('auth_token', response.token)
      api.setToken(response.token)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    } finally {
      loading.value = false
    }
  }

  async function login(username: string, password: string) {
    loading.value = true
    try {
      const response = await api.login(username, password)
      user.value = response.user
      localStorage.setItem('auth_token', response.token)
      api.setToken(response.token)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await api.logout()
    } catch {
    }
    user.value = null
    localStorage.removeItem('auth_token')
    api.setToken(null)
  }

  return {
    user,
    loading,
    isLoggedIn,
    initialized,
    init,
    register,
    login,
    logout
  }
}
