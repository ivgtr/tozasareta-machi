import { createContext, useContext, type Dispatch } from 'react'
import type { StoreAction, StoreState } from '../store'

export interface StoreContextValue {
  store: StoreState
  dispatch: Dispatch<StoreAction>
}

export const StoreContext = createContext<StoreContextValue | null>(null)

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
