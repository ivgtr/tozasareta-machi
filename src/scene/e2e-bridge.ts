import Phaser from 'phaser'
import type { Effect, GameState } from '../game/types'
import { getSettings } from '../store'
import type { PlaybackContext } from './playback/beats'
import { KEYS } from './keys'
import { deviceClassOf } from './layout'
import type { PresentationMode } from './presentation'
import { emptyPlan, type PlanState } from './plan'
import { focusedFacilityId, placementUnitId, type PlanningIntent } from './planning/placement'
import { sharedStore } from './store-bridge'
import { ChoiceCard } from './story/choice-presentation'
import {
  buildPresentationFixture,
  type PresentationFixtureName,
} from './testing/presentation-fixtures'
import { PixelButton } from './ui/button'
import { UnitToken } from './ui/token'
import { FACILITY_VISUAL, FOOTPRINT, footprintDiamond, type FacilityId } from './town/layout'

interface CssBounds {
  x: number
  y: number
  width: number
  height: number
}

interface PlaySceneInternals {
  menu?: { isOpen: boolean; show: (state: GameState) => void; hide: () => void }
  confirm?: { isOpen: boolean }
  log?: { isOpen: boolean }
  characterInspector?: { isOpen: boolean }
  placementStatus?: { isOpen: boolean }
  deck?: { keyboardFocus: string | null }
  playback?: {
    current: unknown | null
    cancel: () => void
    pause: () => void
    start: (state: GameState, effects: Effect[], context?: PlaybackContext) => void
  }
  presentation?: { mode: PresentationMode }
  planningIntent?: PlanningIntent
  inspectedUnitId?: string | null
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
  characterInspectorOpen: boolean
  placementStatusOpen: boolean
  logOpen: boolean
  presentationMode: PresentationMode
  busy: boolean
  soundEnabled: boolean
  selectedUnitId: string | null
  selectedFacility: string | null
  keyboardFocusedUnitId: string | null
  plannedAssignments: number
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

interface E2EButtonTarget {
  label: string
  labelBounds: CssBounds
  hitBounds: CssBounds
  hovered: boolean
}

interface E2EChoiceTarget {
  label: string
  visualBounds: CssBounds
  hovered: boolean
}

interface E2EBridge {
  snapshot(): E2ESnapshot
  textBounds(text: string, exact?: boolean): CssBounds | null
  firstUnitBounds(): CssBounds | null
  buttonSizes(): E2EButtonSize[]
  buttonTargets(): E2EButtonTarget[]
  choiceSizes(): E2EButtonSize[]
  choiceTargets(): E2EChoiceTarget[]
  townTokenArtPoint(): { unitId: string; x: number; y: number } | null
  facilityArtPoint(id: FacilityId): { x: number; y: number } | null
  facilityFootprintPoint(id: FacilityId): { x: number; y: number } | null
  facilityTexture(id: FacilityId): string | null
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

function transformedBounds(
  object: Phaser.GameObjects.Container,
  rectangle: Phaser.Geom.Rectangle,
): Phaser.Geom.Rectangle {
  const matrix = object.getWorldTransformMatrix()
  const corners = [
    matrix.transformPoint(rectangle.left, rectangle.top),
    matrix.transformPoint(rectangle.right, rectangle.top),
    matrix.transformPoint(rectangle.right, rectangle.bottom),
    matrix.transformPoint(rectangle.left, rectangle.bottom),
  ]
  const xs = corners.map((point) => point.x)
  const ys = corners.map((point) => point.y)
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  return new Phaser.Geom.Rectangle(left, top, Math.max(...xs) - left, Math.max(...ys) - top)
}

function visibleButtonTargets(game: Phaser.Game): E2EButtonTarget[] {
  return visibleObjects(game)
    .filter((object): object is PixelButton => object instanceof PixelButton)
    .flatMap((button) => {
      const label = button.list.find(
        (object): object is Phaser.GameObjects.Text => object instanceof Phaser.GameObjects.Text,
      )
      const hitArea = button.input?.hitArea
      const labelBounds = label ? boundsOf(label) : null
      if (!label || !(hitArea instanceof Phaser.Geom.Rectangle) || !labelBounds) return []
      return [
        {
          label: label.text,
          labelBounds: toCssBounds(game, labelBounds),
          hitBounds: toCssBounds(game, transformedBounds(button, hitArea)),
          hovered: button.isHovered,
        },
      ]
    })
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

function visibleChoiceTargets(game: Phaser.Game): E2EChoiceTarget[] {
  return visibleObjects(game)
    .filter((object): object is ChoiceCard => object instanceof ChoiceCard)
    .flatMap((card) => {
      const label = card.list.find(
        (object): object is Phaser.GameObjects.Text => object instanceof Phaser.GameObjects.Text,
      )
      if (!label) return []
      const visualBounds = transformedBounds(
        card,
        new Phaser.Geom.Rectangle(0, 0, card.cardWidth, card.cardHeight),
      )
      return [
        {
          label: label.text,
          visualBounds: toCssBounds(game, visualBounds),
          hovered: card.isHovered,
        },
      ]
    })
}

function townTokenArtPoint(game: Phaser.Game): { unitId: string; x: number; y: number } | null {
  const token = visibleObjects(game).find(
    (object): object is UnitToken => object instanceof UnitToken,
  )
  if (!token) return null
  const image = token.list.find(
    (object): object is Phaser.GameObjects.Image => object instanceof Phaser.GameObjects.Image,
  )
  if (!image) return null
  const point = imageCssPoint(game, image, image.frame.realWidth / 2, 2)
  return { unitId: token.unitId, ...point }
}

function facilityImage(game: Phaser.Game, id: FacilityId): Phaser.GameObjects.Image | null {
  return (
    visibleObjects(game).find(
      (object): object is Phaser.GameObjects.Image =>
        object instanceof Phaser.GameObjects.Image && object.name === `facility:${id}`,
    ) ?? null
  )
}

function imageCssPoint(
  game: Phaser.Game,
  image: Phaser.GameObjects.Image,
  x: number,
  y: number,
): { x: number; y: number } {
  const localX = (x / image.frame.realWidth - image.originX) * image.displayWidth
  const localY = (y / image.frame.realHeight - image.originY) * image.displayHeight
  const world = image.getWorldTransformMatrix().transformPoint(localX, localY)
  const canvas = game.canvas.getBoundingClientRect()
  return {
    x: canvas.left + (world.x / Number(game.scale.gameSize.width)) * canvas.width,
    y: canvas.top + (world.y / Number(game.scale.gameSize.height)) * canvas.height,
  }
}

function facilityArtPoint(game: Phaser.Game, id: FacilityId): { x: number; y: number } | null {
  const image = facilityImage(game, id)
  if (!image) return null

  const frameWidth = image.frame.realWidth
  const frameHeight = image.frame.realHeight
  const footprintTop = frameHeight / 2 - image.y - FOOTPRINT.height / 2
  for (let y = 2; y < footprintTop - 2; y += 1) {
    for (let x = 2; x < frameWidth - 2; x += 1) {
      let opaque = true
      for (let dy = -2; dy <= 2 && opaque; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          if (
            (game.textures.getPixelAlpha(x + dx, y + dy, image.texture.key) ?? 0) <
            FACILITY_VISUAL.alphaTolerance
          ) {
            opaque = false
            break
          }
        }
      }
      if (opaque) return imageCssPoint(game, image, x, y)
    }
  }
  return null
}

function facilityFootprintPoint(
  game: Phaser.Game,
  id: FacilityId,
): { x: number; y: number } | null {
  const image = facilityImage(game, id)
  if (!image) return null

  const frameWidth = image.frame.realWidth
  const frameHeight = image.frame.realHeight
  const footprint = new Phaser.Geom.Polygon(
    footprintDiamond(frameWidth / 2, frameHeight - FOOTPRINT.height / 2),
  )
  for (let y = 2; y < frameHeight - 2; y += 1) {
    for (let x = 2; x < frameWidth - 2; x += 1) {
      const inside = [-2, 0, 2].every((dy) =>
        [-2, 0, 2].every((dx) => Phaser.Geom.Polygon.Contains(footprint, x + dx, y + dy)),
      )
      if (!inside) continue
      const transparent = [-2, 0, 2].every((dy) =>
        [-2, 0, 2].every(
          (dx) =>
            (game.textures.getPixelAlpha(x + dx, y + dy, image.texture.key) ?? 0) <
            FACILITY_VISUAL.alphaTolerance,
        ),
      )
      if (transparent) return imageCssPoint(game, image, x, y)
    }
  }
  return null
}

function snapshot(game: Phaser.Game): E2ESnapshot {
  const store = sharedStore().get()
  const play = game.scene.getScene(KEYS.play) as unknown as PlaySceneInternals
  const canvas = game.canvas.getBoundingClientRect()
  const intent = play.planningIntent ?? { kind: 'none' }
  return {
    activeScenes: game.scene.getScenes(true).map((scene) => scene.scene.key),
    day: store.state.day,
    phase: store.state.phase,
    historyLength: store.history.length,
    menuOpen: play.menu?.isOpen ?? false,
    confirmOpen: play.confirm?.isOpen ?? false,
    characterInspectorOpen: play.characterInspector?.isOpen ?? false,
    placementStatusOpen: play.placementStatus?.isOpen ?? false,
    logOpen: play.log?.isOpen ?? false,
    presentationMode: play.presentation?.mode ?? 'planning',
    busy: play.playback?.current != null,
    soundEnabled: getSettings().sound,
    selectedUnitId: placementUnitId(intent),
    selectedFacility: focusedFacilityId(intent),
    keyboardFocusedUnitId: play.deck?.keyboardFocus ?? null,
    plannedAssignments: Object.values(play.plan?.placements ?? {}).reduce(
      (total, ids) => total + (ids?.length ?? 0),
      0,
    ),
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
  play.planningIntent = fixture.planningIntent ?? { kind: 'none' }
  play.inspectedUnitId = fixture.inspectedUnitId ?? null
  play.plan = fixture.plan ?? emptyPlan()
  if (fixture.beat && fixture.baseState) {
    play.playback?.start(fixture.baseState, fixture.beat.effects, fixture.playbackContext)
    play.playback?.pause()
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
    buttonTargets: () => visibleButtonTargets(game),
    choiceSizes: () => visibleChoiceSizes(game),
    choiceTargets: () => visibleChoiceTargets(game),
    townTokenArtPoint: () => townTokenArtPoint(game),
    facilityArtPoint: (id) => facilityArtPoint(game, id),
    facilityFootprintPoint: (id) => facilityFootprintPoint(game, id),
    facilityTexture: (id) => facilityImage(game, id)?.texture.key ?? null,
    restartNewGame: () => restartNewGame(game),
    showFixture: (name) => showFixture(game, name),
  }
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    delete target.__TOZASARETA_MACHI_E2E__
  })
}
