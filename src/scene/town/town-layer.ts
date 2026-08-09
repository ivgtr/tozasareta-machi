import Phaser from 'phaser'
import type { GameState } from '../../game/types'
import {
  deriveFacilityPlacementCandidates,
  type FacilityPlacementCandidate,
} from '../planning/placement'
import type { PlanState } from '../plan'
import { COLORS, TEXT_SIZE } from '../tokens'
import { textureKey } from '../art/assets'
import { pixelText } from '../ui/pixel-text'
import { reconcileTokens } from '../ui/token'
import { TownAmbience } from './ambience'
import { FACILITIES, type FacilityViewMap } from './facilities'
import { facilityPlacementAlpha } from './facility-feedback'
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
  focusedFacilityId: FacilityId | null
  placementUnitId: string | null
}

export interface TownCallbacks {
  onFacilityTap: (id: FacilityId) => void
  onTokenPointerDown: (unitId: string, worldX: number, worldY: number) => void
}

interface FacilityVisual {
  host: Phaser.GameObjects.Container
  tokens: Phaser.GameObjects.Container
  sprite: Phaser.GameObjects.Image | null
  label: Phaser.GameObjects.Text
  status: Phaser.GameObjects.Text
}

export class TownLayer extends Phaser.GameObjects.Container {
  private readonly world: Phaser.GameObjects.Container
  private readonly ambience: TownAmbience
  private readonly overlay: Phaser.GameObjects.Container
  private readonly visuals = new Map<FacilityId, FacilityVisual>()
  private readonly callbacks: TownCallbacks
  private placementCandidates: Record<FacilityId, FacilityPlacementCandidate> | null = null
  private focusedFacility: FacilityId | null = null
  private hoveredFacility: FacilityId | null = null
  private dragTarget: FacilityId | null = null
  private dragCandidate: FacilityPlacementCandidate | null = null

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

      const tokens = scene.add.container()
      host.add(tokens)
      this.world.add(host)

      const label = pixelText(scene, meta.label, {
        fontSize: TEXT_SIZE.labelWide,
        color: COLORS.ink,
        backgroundColor: '#0a0e24',
        align: 'center',
      })
      label.setPosition(plot.x, plot.y + 18)
      label.setOrigin(0.5)
      label.setVisible(false)
      const status = pixelText(scene, '', {
        fontSize: TEXT_SIZE.labelNarrow,
        color: COLORS.inkDim,
        backgroundColor: '#0a0e24',
        align: 'center',
      })
      status.setPosition(plot.x, plot.y + 36)
      status.setOrigin(0.5)
      status.setVisible(false)

      this.overlay.add([label, status])
      this.visuals.set(plot.id, { host, tokens, sprite: null, label, status })
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

  setPlacementDropTarget(facility: FacilityId, candidate: FacilityPlacementCandidate): void {
    const previous = this.dragTarget
    this.dragTarget = facility
    this.dragCandidate = candidate
    if (previous && previous !== facility) this.refreshFacilityFeedback(previous)
    this.refreshFacilityFeedback(facility)
  }

  clearPlacementDropTarget(): void {
    const previous = this.dragTarget
    this.dragTarget = null
    this.dragCandidate = null
    if (previous) this.refreshFacilityFeedback(previous)
  }

  update(state: GameState, plan: PlanState, view: FacilityViewMap, selection: TownSelection): void {
    this.ambience.update(state)
    this.placementCandidates = selection.placementUnitId
      ? deriveFacilityPlacementCandidates(state, plan, selection.placementUnitId)
      : null
    this.focusedFacility = selection.focusedFacilityId

    for (const plot of FACILITY_PLOTS) {
      const meta = FACILITIES[plot.id]
      const visual = this.visuals.get(plot.id)
      if (!visual) continue

      const stateId = view[plot.id]
      visual.label.setText(meta.label)
      visual.label.setColor('#e8ecff')

      const unitIds = meta.task ? (plan.placements[meta.task] ?? []) : []
      this.syncTokens(visual.tokens, state, unitIds)
      this.syncSprite(visual, plot.id, stateId)
      this.refreshFacilityFeedback(plot.id)
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
      const footprint = new Phaser.Geom.Polygon(
        footprintDiamond(FACILITY_VISUAL.width / 2, FACILITY_VISUAL.height - FOOTPRINT.height / 2),
      )
      const pixelPerfect = this.scene.input.makePixelPerfect(
        FACILITY_VISUAL.alphaTolerance,
      ) as Phaser.Types.Input.HitAreaCallback
      sprite.setInteractive(
        footprint,
        (hitArea, x, y, gameObject) =>
          Phaser.Geom.Polygon.Contains(hitArea as Phaser.Geom.Polygon, x, y) ||
          pixelPerfect(hitArea, x, y, gameObject),
      )
      if (sprite.input) sprite.input.cursor = 'pointer'
      sprite.on('pointerdown', () => this.callbacks.onFacilityTap(facility))
      sprite.on('pointerover', () => {
        this.hoveredFacility = facility
        this.refreshFacilityFeedback(facility)
      })
      sprite.on('pointerout', () => {
        if (this.hoveredFacility === facility) this.hoveredFacility = null
        this.refreshFacilityFeedback(facility)
      })
      visual.host.addAt(sprite, 0)
      visual.sprite = sprite
      return
    }

    if (visual.sprite.texture.key !== key) visual.sprite.setTexture(key)
  }

  private refreshFacilityFeedback(facility: FacilityId): void {
    const visual = this.visuals.get(facility)
    if (!visual) return
    const dragCandidate = this.dragTarget === facility ? this.dragCandidate : null
    const candidate = dragCandidate ?? this.placementCandidates?.[facility] ?? null
    const targeted = this.hoveredFacility === facility || this.dragTarget === facility
    const labelVisible = targeted || this.focusedFacility === facility
    visual.sprite?.setAlpha(facilityPlacementAlpha(candidate))
    visual.label.setVisible(labelVisible)
    visual.status.setText(candidate && targeted ? placementStatus(candidate) : '')
    visual.status.setColor(candidate ? placementColorCss(candidate) : '#a8b1d9')
    visual.status.setVisible(Boolean(candidate && targeted))
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

function placementStatus(candidate: FacilityPlacementCandidate): string {
  if (candidate.kind === 'available') return '配置可能'
  if (candidate.kind === 'current') return '配置済み'
  if (candidate.kind === 'passive') return '配置不可'
  if (candidate.reason === 'budget') return '配置不可・予算不足'
  if (candidate.reason === 'stockpile') return '配置不可・備蓄不足'
  if (candidate.reason === 'task-disabled') return '配置不可・行動不可'
  return '配置不可'
}

function placementColorCss(candidate: FacilityPlacementCandidate): string {
  if (candidate.kind === 'available' || candidate.kind === 'current') return '#5ee6a8'
  if (candidate.kind === 'blocked' && candidate.reason === 'task-disabled') return '#ff5f66'
  if (candidate.kind === 'blocked') return '#ffc857'
  return '#a8b1d9'
}
