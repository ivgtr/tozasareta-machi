import Phaser from 'phaser'
import type { GameState } from '../../game/types'
import { reducedMotion } from '../../store'
import { COLORS, colorCss } from '../tokens'
import type { PlanState } from '../plan'
import type { FxEntry } from './fx-map'
import { FACILITIES, type FacilityViewId } from './facilities'
import { facilityAssetId } from './facility-view'
import {
  FACILITY_PLOTS,
  FOOTPRINT,
  TOWN_BASE,
  facilityAt,
  footprintDiamond,
  type FacilityId,
  type FacilityPlot,
} from './layout'
import { textureKey } from '../art/assets'
import { UnitToken } from '../ui/token'

const GROUND_TOP = 84
const TOKEN_FAN: Array<{ x: number; y: number }> = [
  { x: -30, y: 12 },
  { x: 0, y: 12 },
  { x: 30, y: 12 },
  { x: -45, y: 24 },
  { x: -15, y: 24 },
  { x: 15, y: 24 },
  { x: 45, y: 24 },
  { x: -30, y: 36 },
  { x: 0, y: 36 },
  { x: 30, y: 36 },
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
  highlight: Phaser.GameObjects.Graphics
  tokens: Phaser.GameObjects.Container
  sprite: Phaser.GameObjects.Image | null
  glyph: Phaser.GameObjects.Text
}

export class TownLayer extends Phaser.GameObjects.Container {
  private readonly ground: Phaser.GameObjects.Graphics
  private readonly visuals = new Map<FacilityId, FacilityVisual>()
  private readonly callbacks: TownCallbacks

  constructor(scene: Phaser.Scene, callbacks: TownCallbacks) {
    super(scene)
    this.callbacks = callbacks
    this.ground = scene.add.graphics()
    this.add(this.ground)
    this.drawGround()
    for (const p of FACILITY_PLOTS) {
      const meta = FACILITIES[p.id]
      const highlight = scene.add.graphics()
      const glyph = scene.add.text(p.x, p.y - 8, meta.glyph, {
        fontFamily: 'DotGothic16',
        fontSize: '20px',
        color: colorCss(meta.color),
      })
      glyph.setOrigin(0.5)
      const label = scene.add.text(p.x, p.y + 16, meta.label, {
        fontFamily: 'DotGothic16',
        fontSize: '11px',
        color: colorCss(COLORS.inkDim),
      })
      label.setOrigin(0.5)
      const zone = scene.add.zone(p.x, p.y, FOOTPRINT.width, FOOTPRINT.height)
      zone.setInteractive(
        new Phaser.Geom.Polygon(footprintDiamond(0, 0)),
        Phaser.Geom.Polygon.Contains,
      )
      zone.on('pointerdown', () => this.callbacks.onFacilityTap(p.id))
      const tokens = scene.add.container(p.x, p.y)
      this.visuals.set(p.id, { highlight, tokens, sprite: null, glyph })
      this.add([highlight, tokens, glyph, label, zone])
    }
    scene.add.existing(this)
  }

  private drawGround(): void {
    const g = this.ground
    const points = [
      new Phaser.Geom.Point(TOWN_BASE.width / 2, GROUND_TOP),
      new Phaser.Geom.Point(TOWN_BASE.width - 20, TOWN_BASE.height / 2 + 20),
      new Phaser.Geom.Point(TOWN_BASE.width / 2, TOWN_BASE.height - 12),
      new Phaser.Geom.Point(20, TOWN_BASE.height / 2 + 20),
    ]
    g.clear()
    g.fillStyle(COLORS.night800)
    g.fillPoints(points, true)
    g.lineStyle(2, COLORS.frameLo)
    g.strokePoints(points, true)
  }

  facilityAtWorld(worldX: number, worldY: number): FacilityId | null {
    const point = this.getLocalPoint(worldX, worldY)
    return facilityAt(point.x, point.y)
  }

  containsWorld(worldX: number, worldY: number): boolean {
    const point = this.getLocalPoint(worldX, worldY)
    return point.x >= 0 && point.x <= TOWN_BASE.width && point.y >= 0 && point.y <= TOWN_BASE.height
  }

  update(
    state: GameState,
    plan: PlanState,
    view: Record<FacilityId, FacilityViewId>,
    selection: TownSelection,
  ): void {
    for (const p of FACILITY_PLOTS) {
      const meta = FACILITIES[p.id]
      const v = this.visuals.get(p.id)
      if (!v) continue
      const stateId = view[p.id]
      const h = v.highlight
      h.clear()
      const diamond = pointsToGeom(footprintDiamond(p.x, p.y))
      h.lineStyle(
        2,
        stateId === 'working'
          ? meta.color
          : stateId === 'low' || stateId === 'collapsed'
            ? COLORS.red
            : COLORS.frameLo,
      )
      h.strokePoints(diamond, true)
      if (selection.selectedFacility === p.id) {
        h.lineStyle(3, COLORS.gold)
        h.strokePoints(diamond, true)
      } else if (selection.placeableUnitId && meta.tasks.length > 0) {
        h.lineStyle(2, COLORS.green)
        h.strokePoints(diamond, true)
      }
      const unitIds = meta.tasks.flatMap((t) => plan.placements[t] ?? [])
      this.syncTokens(v.tokens, state, unitIds)
      this.syncSprite(v, p, stateId)
    }
  }

  playFx(entry: FxEntry, text: string, color: number): void {
    if (reducedMotion()) return
    const anchor = entry.facility
      ? (FACILITY_PLOTS.find((p) => p.id === entry.facility) ?? null)
      : null
    const x = anchor ? anchor.x : TOWN_BASE.width - 60
    const y = anchor ? anchor.y - 34 : 48
    const t = this.scene.add.text(x, y, text, {
      fontFamily: 'DotGothic16',
      fontSize: '14px',
      color: colorCss(color),
    })
    t.setOrigin(0.5)
    this.add(t)
    this.scene.tweens.add({
      targets: t,
      y: y - 26,
      alpha: 0,
      duration: 900,
      onComplete: () => {
        this.remove(t)
        t.destroy()
      },
    })
    if (anchor && entry.kind !== 'float') this.pulse(anchor)
  }

  playArrival(): void {
    if (reducedMotion()) return
    const road = FACILITY_PLOTS.find((p) => p.id === 'road')
    if (!road) return
    this.pulse(road)
    const t = this.scene.add.text(road.x, road.y - 40, '到', {
      fontFamily: 'DotGothic16',
      fontSize: '18px',
      color: colorCss(COLORS.gold),
    })
    t.setOrigin(0.5)
    this.add(t)
    this.scene.tweens.add({
      targets: t,
      y: road.y - 66,
      alpha: 0,
      duration: 1100,
      onComplete: () => {
        this.remove(t)
        t.destroy()
      },
    })
  }

  private pulse(p: FacilityPlot): void {
    const g = this.scene.add.graphics()
    g.lineStyle(3, COLORS.gold)
    g.strokePoints(pointsToGeom(footprintDiamond(p.x, p.y)), true)
    this.add(g)
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 700,
      onComplete: () => {
        this.remove(g)
        g.destroy()
      },
    })
  }

  private syncSprite(v: FacilityVisual, p: FacilityPlot, stateId: FacilityViewId): void {
    const key = textureKey('facility', facilityAssetId(p.id, stateId))
    if (this.scene.textures.exists(key)) {
      if (!v.sprite || v.sprite.texture.key !== key) {
        if (v.sprite) v.sprite.destroy()
        const img = this.scene.add.image(p.x, p.y + FOOTPRINT.height / 2 - 56, key)
        img.setDisplaySize(96, 112)
        v.sprite = img
        this.addAt(img, 1)
      }
      v.glyph.setVisible(false)
    } else {
      if (v.sprite) {
        v.sprite.destroy()
        v.sprite = null
      }
      v.glyph.setVisible(true)
    }
  }

  private syncTokens(
    host: Phaser.GameObjects.Container,
    state: GameState,
    unitIds: string[],
  ): void {
    const wanted = new Set(unitIds)
    for (const child of [...host.list]) {
      const token = child as UnitToken
      if (!wanted.has(token.unitId)) {
        host.remove(token)
        token.destroy()
      }
    }
    const have = new Set(host.list.map((c) => (c as UnitToken).unitId))
    unitIds.forEach((id, i) => {
      if (have.has(id)) return
      const unit = state.units.find((u) => u.id === id)
      if (!unit) return
      const token = new UnitToken(this.scene, unit)
      token.on(
        'pointerdown',
        (
          pointer: Phaser.Input.Pointer,
          _lx: number,
          _ly: number,
          event: Phaser.Types.Input.EventData,
        ) => {
          event.stopPropagation()
          this.callbacks.onTokenPointerDown(id, pointer.worldX, pointer.worldY)
        },
      )
      const slot = TOKEN_FAN[i % TOKEN_FAN.length] ?? { x: 0, y: 8 }
      token.setPosition(slot.x, slot.y)
      host.add(token)
    })
    const sorted = [...(host.list as UnitToken[])].sort((a, b) => a.y - b.y)
    sorted.forEach((c, i) => c.setDepth(i))
  }
}

function pointsToGeom(points: number[]): Phaser.Geom.Point[] {
  const out: Phaser.Geom.Point[] = []
  for (let i = 0; i < points.length; i += 2) {
    out.push(new Phaser.Geom.Point(points[i] ?? 0, points[i + 1] ?? 0))
  }
  return out
}
