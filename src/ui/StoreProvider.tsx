import { useEffect, useReducer, type ReactNode } from 'react'
import type { StoreState } from './store'
import { loadStore, randomSeed, saveStore, storeReducer } from './store'
import { StoreContext } from './store-context'
import { createInitialState } from '../game/state'

function initStore(): StoreState {
  return loadStore() ?? { state: createInitialState(randomSeed()), history: [] }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [store, dispatch] = useReducer(storeReducer, undefined, initStore)
  useEffect(() => {
    saveStore(store)
  }, [store])
  return <StoreContext.Provider value={{ store, dispatch }}>{children}</StoreContext.Provider>
}
