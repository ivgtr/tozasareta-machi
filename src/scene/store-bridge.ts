import type { StoreAction, StoreState, StoreTransition } from '../store'
import { clearSave, loadStore, randomSeed, saveStore, transitionStore } from '../store'
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

  dispatch(action: StoreAction): StoreTransition {
    const transition = transitionStore(this.store, action)
    if (!transition.changed) return transition
    this.store = transition.store
    if (transition.store.state.phase === 'ended') clearSave()
    else saveStore(transition.store)
    this.listeners.forEach((listener) => listener())
    return transition
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
