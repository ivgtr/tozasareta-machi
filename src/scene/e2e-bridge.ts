import Phaser from 'phaser'
import type { Effect, GameState } from '../game/types'
import { KEYS } from './keys'
import { deviceClassOf } from './layout'
import type { PresentationMode } from './presentation'
import { emptyPlan, type PlanState } from './plan'
import { sharedStore } from './store-bridge'
import { ChoiceCard } from './story/choice-presentation'
import {
  buildPresentationFixture,
  type PresentationFixtureName,
} from './testing/presentation-fixtures'
import { PixelButton } from './ui/button'

interface CssBounds {
  x: number
  y: number
  width: number
  height: number
}

interface PlaySceneInternals {
  menu?: { isOpen: boolean; show: (state: GameState) => void; hide: () => void }
  confirm?: { isOpen: boolean }
  characterFocus?: { isOpen: boolean }
  playback?: {
    current: unknown | null
    cancel: () => void
    start: (state: GameState, effects: Effect[]) => void
  }
  presentation?: { mode: PresentationMode }
  selectedUnitId?: string | null
  selectedFacility?: string | null
  plan?: PlanState
  startNewGame?: () => void
  refresh?: () => void
}

interface E2ESnapshot {
  activeScenes: string[]
  day: number
  phase: string
  historyLength: number
  menuOpen: boolean
  confirmOpen: boolean
  characterFocusOpen: boolean
  presentationMode: PresentationMode
  busy: boolean
  selectedUnitId: string | null
  deviceClass: 'wide' | 'narrow'
  gameSize: { width: number; height: number }
  canvas: {
    width: number
    height: number
    cssWidth: number
    cssHeight: number
  }
}

interface E2EButtonSize {
  width: number
  height: number
}

interface E2EBridge {
  snapshot(): E2ESnapshot
  textBounds(text: string, exact?: boolean): CssBounds | null
  firstUnitBounds(): CssBounds | null
  buttonSizes(): E2EButtonSize[]
  choiceSizes(): E2EButtonSize[]
  restartNewGame(): void
  showFixture(name: PresentationFixtureName): void
}

type E2EWindow = Window & {
  __TOZASARETA_MACHI_E2E__?: E2EBridge
}

function isVisible(object: Phaser.GameObjects.GameObject): boolean {
  const candidate = object as Phaser.GameObjects.GameObject & {
    visible?: boolean
    alpha?: number
  }
  return object.active && candidate.visible !== false && (candidate.alpha ?? 1) > 0
}

function collectVisible(
  objects: readonly Phaser.GameObjects.GameObject[],
  result: Phaser.GameObjects.GameObject[] = [],
): Phaser.GameObjects.GameObject[] {
  for (const object of objects) {
    if (!isVisible(object)) continue
    result.push(object)
    if (object instanceof Phaser.GameObjects.Container) collectVisible(object.list, result)
  }
  return result
}

function activeScene(game: Phaser.Game): Phaser.Scene | null {
  const scenes = game.scene.getScenes(true)
  return scenes[scenes.length - 1] ?? null
}

function boundsOf(object: Phaser.GameObjects.GameObject): Phaser.Geom.Rectangle | null {
  const candidate = object as Phaser.GameObjects.GameObject & {
    getBounds?: () => Phaser.Geom.Rectangle
  }
  return candidate.getBounds?.() ?? null
}

function toCssBounds(game: Phaser.Game, bounds: Phaser.Geom.Rectangle): CssBounds {
  const canvas = game.canvas.getBoundingClientRect()
  const gameWidth = Number(game.scale.gameSize.width)
  const gameHeight = Number(game.scale.gameSize.height)
  const scaleX = canvas.width / gameWidth
  const scaleY = canvas.height / gameHeight
  return {
    x: canvas.left + bounds.x * scaleX,
    y: canvas.top + bounds.y * scaleY,
    width: bounds.width * scaleX,
    height: bounds.height * scaleY,
  }
}

function visibleObjects(game: Phaser.Game): Phaser.GameObjects.GameObject[] {
  const scene = activeScene(game)
  return scene ? collectVisible(scene.children.list) : []
}

function findTextBounds(game: Phaser.Game, text: string, exact: boolean): CssBounds | null {
  const match = visibleObjects(game).find((object) => {
    if (!(object instanceof Phaser.GameObjects.Text)) return false
    return exact ? object.text === text : object.text.includes(text)
  })
  if (!match) return null
  const bounds = boundsOf(match)
  return bounds ? toCssBounds(game, bounds) : null
}

function findFirstUnitBounds(game: Phaser.Game): CssBounds | null {
  const match = visibleObjects(game).find((object) => {
    const candidate = object as Phaser.GameObjects.GameObject & { unitId?: unknown }
    return typeof candidate.unitId === 'string'
  })
  if (!match) return null
  const bounds = boundsOf(match)
  return bounds ? toCssBounds(game, bounds) : null
}

function visibleButtonSizes(game: Phaser.Game): E2EButtonSize[] {
  return visibleObjects(game)
    .filter((object): object is PixelButton => object instanceof PixelButton)
    .map((button) => ({ width: button.buttonWidth, height: button.buttonHeight }))
}

function visibleChoiceSizes(game: Phaser.Game): E2EButtonSize[] {
  return visibleObjects(game)
    .filter((object): object is ChoiceCard => object instanceof ChoiceCard)
    .flatMap((object) => {
      const hitArea = object.input?.hitArea as { width?: unknown; height?: unknown } | undefined
      return typeof hitArea?.width === 'number' && typeof hitArea.height === 'number'
        ? [{ width: hitArea.width, height: hitArea.height }]
        : []
    })
}

function snapshot(game: Phaser.Game): E2ESnapshot {
  const store = sharedStore().get()
  const play = game.scene.getScene(KEYS.play) as unknown as PlaySceneInternals
  const canvas = game.canvas.getBoundingClientRect()
  return {
    activeScenes: game.scene.getScenes(true).map((scene) => scene.scene.key),
    day: store.state.day,
    phase: store.state.phase,
    historyLength: store.history.length,
    menuOpen: play.menu?.isOpen ?? false,
    confirmOpen: play.confirm?.isOpen ?? false,
    characterFocusOpen: play.characterFocus?.isOpen ?? false,
    presentationMode: play.presentation?.mode ?? 'planning',
    busy: play.playback?.current != null,
    selectedUnitId: play.selectedUnitId ?? null,
    deviceClass: deviceClassOf(window.innerWidth),
    gameSize: {
      width: Number(game.scale.gameSize.width),
      height: Number(game.scale.gameSize.height),
    },
    canvas: {
      width: game.canvas.width,
      height: game.canvas.height,
      cssWidth: canvas.width,
      cssHeight: canvas.height,
    },
  }
}

function restartNewGame(game: Phaser.Game): void {
  const play = game.scene.getScene(KEYS.play) as unknown as PlaySceneInternals
  play.startNewGame?.()
}

function showFixture(game: Phaser.Game, name: PresentationFixtureName): void {
  const fixture = buildPresentationFixture(name)
  const current = sharedStore().get()
  current.state = fixture.state
  current.history = []

  if (fixture.scene === 'title') {
    const active = activeScene(game)
    active?.scene.start(KEYS.title)
    return
  }

  const play = game.scene.getScene(KEYS.play) as unknown as PlaySceneInternals
  play.playback?.cancel()
  play.menu?.hide()
  play.selectedUnitId = fixture.selectedUnitId ?? null
  play.selectedFacility = fixture.selectedFacility ?? null
  play.plan = fixture.plan ?? emptyPlan()
  if (fixture.beat && fixture.baseState) {
    play.playback?.start(fixture.baseState, fixture.beat.effects)
  } else {
    play.refresh?.()
  }
  if (fixture.menuOpen) play.menu?.show(fixture.state)
}

export function installE2EBridge(game: Phaser.Game): void {
  const target = window as E2EWindow
  target.__TOZASARETA_MACHI_E2E__ = {
    snapshot: () => snapshot(game),
    textBounds: (text, exact = true) => findTextBounds(game, text, exact),
    firstUnitBounds: () => findFirstUnitBounds(game),
    buttonSizes: () => visibleButtonSizes(game),
    choiceSizes: () => visibleChoiceSizes(game),
    restartNewGame: () => restartNewGame(game),
    showFixture: (name) => showFixture(game, name),
  }
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    delete target.__TOZASARETA_MACHI_E2E__
  })
}
