import type { StoreAction, StoreState } from '../store'
import { clearSave, loadStore, randomSeed, saveStore, storeReducer } from '../store'
import { createInitialState } from '../game/state'

export class SceneStore {
  private store: StoreState
  private readonly listeners = new Set<() => void>()

  constructor(initial: StoreState) {
    this.store = initial
  }

  get(): StoreState {
    return this.store
  }

  dispatch(action: StoreAction): void {
    const next = storeReducer(this.store, action)
    if (next === this.store) return
    this.store = next
    if (next.state.phase === 'ended') clearSave()
    else saveStore(next)
    this.listeners.forEach((l) => l())
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}

let shared: SceneStore | null = null

export function sharedStore(): SceneStore {
  if (!shared) {
    shared = new SceneStore(loadStore() ?? { state: createInitialState(randomSeed()), history: [] })
  }
  return shared
}
