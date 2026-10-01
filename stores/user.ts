import { defineStore } from 'pinia'
import type { AuthUser } from '~/types/dummyjson'

export const useUserStore = defineStore('user', () => {
  const user = ref<AuthUser | null>(null)
  const isLoggedIn = computed((): boolean => user.value !== null)

  function setUser(value: AuthUser | null): void {
    user.value = value
  }

  return { user, isLoggedIn, setUser }
})
