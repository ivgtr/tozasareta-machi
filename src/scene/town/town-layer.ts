import Phaser from 'phaser'
import type { GameState } from '../../game/types'
import { COLORS, TEXT_SIZE } from '../tokens'
import type { PlanState } from '../plan'
import { FACILITIES, type FacilityViewMap } from './facilities'
import { facilityAssetId } from './facility-view'
import {
  FACILITY_PLOTS,
  FACILITY_VISUAL,
  FOOTPRINT,
  TOWN_BASE,
  facilityAt,
  footprintDiamond,
  type FacilityId,
} from './layout'
import { textureKey } from '../art/assets'
import { reconcileTokens } from '../ui/token'
import { pixelText } from '../ui/pixel-text'
import { TownAmbience } from './ambience'

const TOKEN_FAN: Array<{ x: number; y: number }> = [
  { x: -20, y: 8 },
  { x: 0, y: 8 },
  { x: 20, y: 8 },
  { x: -30, y: 18 },
  { x: -10, y: 18 },
  { x: 10, y: 18 },
  { x: 30, y: 18 },
  { x: -20, y: 28 },
  { x: 0, y: 28 },
  { x: 20, y: 28 },
]

export interface TownSelection {
  selectedFacility: FacilityId | null
  placeableUnitId: string | null
}

export interface TownCallbacks {
  onFacilityTap: (id: FacilityId) => void
  onTokenPointerDown: (unitId: string, worldX: number, worldY: number) => void
}

interface FacilityVisual {
  host: Phaser.GameObjects.Container
  highlight: Phaser.GameObjects.Graphics
  tokens: Phaser.GameObjects.Container
  sprite: Phaser.GameObjects.Image | null
  label: Phaser.GameObjects.Text
}

export class TownLayer extends Phaser.GameObjects.Container {
  private readonly world: Phaser.GameObjects.Container
  private readonly ambience: TownAmbience
  private readonly overlay: Phaser.GameObjects.Container
  private readonly visuals = new Map<FacilityId, FacilityVisual>()
  private readonly callbacks: TownCallbacks
  private readonly persistentLabels = new Set<FacilityId>()
  private hoveredFacility: FacilityId | null = null

  constructor(scene: Phaser.Scene, callbacks: TownCallbacks) {
    super(scene)
    this.callbacks = callbacks

    const base = scene.add.image(0, 0, textureKey('town', 'base'))
    base.setOrigin(0)

    this.world = scene.add.container()
    this.ambience = new TownAmbience(scene)
    this.overlay = scene.add.container()
    this.add([base, this.world, this.ambience, this.overlay])

    for (const plot of FACILITY_PLOTS) {
      const meta = FACILITIES[plot.id]
      const host = scene.add.container(plot.x, plot.y)

      const zone = scene.add.zone(0, 0, FOOTPRINT.width, FOOTPRINT.height)
      zone.setInteractive(
        new Phaser.Geom.Polygon(footprintDiamond(FOOTPRINT.width / 2, FOOTPRINT.height / 2)),
        Phaser.Geom.Polygon.Contains,
      )
      zone.on('pointerdown', () => this.callbacks.onFacilityTap(plot.id))

      const tokens = scene.add.container()
      host.add([zone, tokens])
      this.world.add(host)

      const highlight = scene.add.graphics()
      const label = pixelText(scene, meta.label, {
        fontSize: TEXT_SIZE.labelWide,
        color: COLORS.ink,
        backgroundColor: '#0a0e24',
      })
      label.setPosition(plot.x, plot.y + 18)
      label.setOrigin(0.5)
      label.setVisible(false)
      label.setInteractive()
      label.on('pointerdown', () => this.callbacks.onFacilityTap(plot.id))

      zone.on('pointerover', () => {
        this.hoveredFacility = plot.id
        label.setVisible(true)
      })
      zone.on('pointerout', () => {
        if (this.hoveredFacility === plot.id) this.hoveredFacility = null
        label.setVisible(this.persistentLabels.has(plot.id))
      })

      this.overlay.add([highlight, label])
      this.visuals.set(plot.id, { host, highlight, tokens, sprite: null, label })
    }

    this.world.sort('y')
    scene.add.existing(this)
  }

  facilityAtWorld(worldX: number, worldY: number): FacilityId | null {
    const point = this.getLocalPoint(worldX, worldY)
    return facilityAt(point.x, point.y)
  }

  containsWorld(worldX: number, worldY: number): boolean {
    const point = this.getLocalPoint(worldX, worldY)
    return point.x >= 0 && point.x <= TOWN_BASE.width && point.y >= 0 && point.y <= TOWN_BASE.height
  }

  update(state: GameState, plan: PlanState, view: FacilityViewMap, selection: TownSelection): void {
    this.persistentLabels.clear()
    this.ambience.update(state, view)

    for (const plot of FACILITY_PLOTS) {
      const meta = FACILITIES[plot.id]
      const visual = this.visuals.get(plot.id)
      if (!visual) continue

      const stateId = view[plot.id]
      const highlight = visual.highlight
      highlight.clear()

      const diamond = pointsToGeom(footprintDiamond(plot.x, plot.y))
      const danger = stateId === 'low' || stateId === 'collapsed'
      const selected = selection.selectedFacility === plot.id
      const placeable = Boolean(selection.placeableUnitId && meta.tasks.length > 0)
      const border = stateId === 'working' ? meta.color : danger ? COLORS.red : COLORS.frameLo

      highlight.lineStyle(2, border)
      highlight.strokePoints(diamond, true)

      if (selected) {
        highlight.lineStyle(3, COLORS.gold)
        highlight.strokePoints(diamond, true)
      } else if (placeable) {
        highlight.lineStyle(2, COLORS.green)
        highlight.strokePoints(diamond, true)
      }

      if (danger || selected || placeable) this.persistentLabels.add(plot.id)
      visual.label.setVisible(
        this.hoveredFacility === plot.id || this.persistentLabels.has(plot.id),
      )

      const unitIds = meta.tasks.flatMap((task) => plan.placements[task] ?? [])
      this.syncTokens(visual.tokens, state, unitIds)
      this.syncSprite(visual, plot.id, stateId)
    }
  }

  private syncSprite(
    visual: FacilityVisual,
    facility: FacilityId,
    view: FacilityViewMap[FacilityId],
  ): void {
    const key = textureKey('facility', facilityAssetId(facility, view))

    if (!visual.sprite) {
      const sprite = this.scene.add.image(0, FACILITY_VISUAL.centerY, key)
      sprite.setName(`facility:${facility}`)
      sprite.setDisplaySize(FACILITY_VISUAL.width, FACILITY_VISUAL.height)
      sprite.setInteractive({
        pixelPerfect: true,
        alphaTolerance: FACILITY_VISUAL.alphaTolerance,
        useHandCursor: true,
      })
      sprite.on(
        'pointerdown',
        (
          _pointer: Phaser.Input.Pointer,
          _localX: number,
          _localY: number,
          event: Phaser.Types.Input.EventData,
        ) => {
          event.stopPropagation()
          this.callbacks.onFacilityTap(facility)
        },
      )
      visual.host.addAt(sprite, 0)
      visual.sprite = sprite
      return
    }

    if (visual.sprite.texture.key !== key) visual.sprite.setTexture(key)
  }

  private syncTokens(
    host: Phaser.GameObjects.Container,
    state: GameState,
    unitIds: string[],
  ): void {
    const { tokens, created } = reconcileTokens(this.scene, host, state, unitIds, {
      onPointerDown: (id, x, y) => this.callbacks.onTokenPointerDown(id, x, y),
    })

    for (const token of created) {
      const index = tokens.indexOf(token)
      const slot = TOKEN_FAN[index % TOKEN_FAN.length] ?? { x: 0, y: 8 }
      token.setPosition(slot.x, slot.y)
    }

    host.sort('y')
  }
}

function pointsToGeom(points: number[]): Phaser.Geom.Point[] {
  const out: Phaser.Geom.Point[] = []
  for (let index = 0; index < points.length; index += 2) {
    out.push(new Phaser.Geom.Point(points[index] ?? 0, points[index + 1] ?? 0))
  }
  return out
}
