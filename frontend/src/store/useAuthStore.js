import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: (userData, token) => set({ user: userData, token }),
      logout: () => set({ user: null, token: null }),
      updateUser: (updates) => set((state) => ({ user: { ...state.user, ...updates } })),
    }),
    {
      name: 'auth-storage', // This saves the auth state to localStorage
    }
  )
);

export default useAuthStore;