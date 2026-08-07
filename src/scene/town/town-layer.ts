import Phaser from 'phaser'
import type { GameState } from '../../game/types'
import { reducedMotion } from '../../store'
import { COLORS, TEXT_SIZE } from '../tokens'
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
import { reconcileTokens } from '../ui/token'
import { pixelText } from '../ui/pixel-text'

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
  label: Phaser.GameObjects.Text
}

export class TownLayer extends Phaser.GameObjects.Container {
  private readonly ground: Phaser.GameObjects.Graphics
  private readonly visuals = new Map<FacilityId, FacilityVisual>()
  private readonly callbacks: TownCallbacks
  private readonly persistentLabels = new Set<FacilityId>()
  private hoveredFacility: FacilityId | null = null

  constructor(scene: Phaser.Scene, callbacks: TownCallbacks) {
    super(scene)
    this.callbacks = callbacks
    this.ground = scene.add.graphics()
    this.add(this.ground)
    this.drawGround()
    for (const p of FACILITY_PLOTS) {
      const meta = FACILITIES[p.id]
      const highlight = scene.add.graphics()
      const glyph = pixelText(scene, meta.glyph, {
        fontSize: 20,
        color: meta.color,
      })
      glyph.setPosition(p.x, p.y - 8)
      glyph.setOrigin(0.5)
      const label = pixelText(scene, meta.label, {
        fontSize: TEXT_SIZE.labelWide,
        color: COLORS.ink,
        backgroundColor: '#0a0e24',
      })
      label.setPosition(p.x, p.y + 18)
      label.setOrigin(0.5)
      label.setVisible(false)
      const zone = scene.add.zone(p.x, p.y, FOOTPRINT.width, FOOTPRINT.height)
      zone.setInteractive(
        new Phaser.Geom.Polygon(footprintDiamond(FOOTPRINT.width / 2, FOOTPRINT.height / 2)),
        Phaser.Geom.Polygon.Contains,
      )
      zone.on('pointerdown', () => this.callbacks.onFacilityTap(p.id))
      zone.on('pointerover', () => {
        this.hoveredFacility = p.id
        label.setVisible(true)
      })
      zone.on('pointerout', () => {
        if (this.hoveredFacility === p.id) this.hoveredFacility = null
        label.setVisible(this.persistentLabels.has(p.id))
      })
      const tokens = scene.add.container(p.x, p.y)
      this.visuals.set(p.id, { highlight, tokens, sprite: null, glyph, label })
      this.add([highlight, tokens, glyph, label, zone])
    }
    scene.add.existing(this)
  }

  private drawGround(): void {
    const g = this.ground
    const cx = TOWN_BASE.width / 2
    const cy = TOWN_BASE.height / 2 + 12
    const hw = 220
    const hh = 112
    g.clear()
    g.fillStyle(COLORS.night900)
    g.fillRect(0, 0, TOWN_BASE.width, GROUND_TOP)
    g.fillStyle(COLORS.night600, 0.5)
    this.fillTriangles(g, [
      [0, GROUND_TOP, 0, 34, 96, GROUND_TOP],
      [56, GROUND_TOP, 150, 22, 244, GROUND_TOP],
      [204, GROUND_TOP, 300, 40, 396, GROUND_TOP],
      [356, GROUND_TOP, 452, 26, 480, GROUND_TOP],
    ])
    g.fillStyle(COLORS.night700, 0.9)
    this.fillTriangles(g, [
      [20, GROUND_TOP, 70, 48, 120, GROUND_TOP],
      [100, GROUND_TOP, 160, 36, 220, GROUND_TOP],
      [260, GROUND_TOP, 320, 48, 380, GROUND_TOP],
    ])
    const diamond = (x: number, y: number, w: number, h: number, fill: boolean, alpha: number) => {
      const pts = [x, y - h, x + w, y, x, y + h, x - w, y]
      const geom = pointsToGeom(pts)
      if (fill) {
        g.fillStyle(COLORS.night800, alpha)
        g.fillPoints(geom, true)
      }
      g.lineStyle(1, COLORS.frameLo, alpha)
      g.strokePoints(geom, true)
    }
    diamond(cx, cy, hw, hh, true, 1)
    diamond(cx, cy, hw * 0.9, hh * 0.9, false, 0.5)
    diamond(cx, cy, hw * 0.8, hh * 0.8, false, 0.3)
    g.lineStyle(2, COLORS.frameLo, 0.55)
    const paths: Array<[number, number, number, number]> = [
      [144, 168, 240, 168],
      [240, 168, 216, 192],
      [216, 192, 288, 216],
      [240, 168, 192, 144],
      [240, 168, 288, 144],
      [288, 216, 470, 240],
    ]
    for (const [x1, y1, x2, y2] of paths) g.lineBetween(x1, y1, x2, y2)
    for (const p of FACILITY_PLOTS) {
      const plot = pointsToGeom(footprintDiamond(p.x, p.y))
      g.fillStyle(COLORS.night700, 0.85)
      g.fillPoints(plot, true)
      g.lineStyle(2, COLORS.frameLo, 0.9)
      g.strokePoints(plot, true)
    }
  }

  private fillTriangles(
    g: Phaser.GameObjects.Graphics,
    tris: Array<[number, number, number, number, number, number]>,
  ): void {
    for (const [x1, y1, x2, y2, x3, y3] of tris) {
      g.fillPoints(
        [
          new Phaser.Geom.Point(x1, y1),
          new Phaser.Geom.Point(x2, y2),
          new Phaser.Geom.Point(x3, y3),
        ],
        true,
      )
    }
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
    this.persistentLabels.clear()
    for (const p of FACILITY_PLOTS) {
      const meta = FACILITIES[p.id]
      const v = this.visuals.get(p.id)
      if (!v) continue
      const stateId = view[p.id]
      const h = v.highlight
      h.clear()
      const diamond = pointsToGeom(footprintDiamond(p.x, p.y))
      const danger = stateId === 'low' || stateId === 'collapsed' || stateId === 'damaged'
      const selected = selection.selectedFacility === p.id
      const placeable = Boolean(selection.placeableUnitId && meta.tasks.length > 0)
      h.lineStyle(2, stateId === 'working' ? meta.color : danger ? COLORS.red : COLORS.frameLo)
      h.strokePoints(diamond, true)
      if (selected) {
        h.lineStyle(3, COLORS.gold)
        h.strokePoints(diamond, true)
      } else if (placeable) {
        h.lineStyle(2, COLORS.green)
        h.strokePoints(diamond, true)
      }
      if (danger || selected || placeable) this.persistentLabels.add(p.id)
      v.label.setVisible(this.hoveredFacility === p.id || this.persistentLabels.has(p.id))
      const unitIds = meta.tasks.flatMap((task) => plan.placements[task] ?? [])
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
    const t = pixelText(this.scene, text, {
      fontSize: TEXT_SIZE.bodyWide,
      color,
    })
    t.setPosition(x, y)
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
    const t = pixelText(this.scene, '到', {
      fontSize: 18,
      color: COLORS.gold,
    })
    t.setPosition(road.x, road.y - 40)
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
    const { tokens, created } = reconcileTokens(this.scene, host, state, unitIds, {
      unitOptions: { variant: 'town' },
      onPointerDown: (id, x, y) => this.callbacks.onTokenPointerDown(id, x, y),
    })
    for (const token of created) {
      const i = tokens.indexOf(token)
      const slot = TOKEN_FAN[i % TOKEN_FAN.length] ?? { x: 0, y: 8 }
      token.setPosition(slot.x, slot.y)
    }
    const sorted = [...tokens].sort((a, b) => a.y - b.y)
    sorted.forEach((component, index) => component.setDepth(index))
  }
}

function pointsToGeom(points: number[]): Phaser.Geom.Point[] {
  const out: Phaser.Geom.Point[] = []
  for (let i = 0; i < points.length; i += 2) {
    out.push(new Phaser.Geom.Point(points[i] ?? 0, points[i + 1] ?? 0))
  }
  return out
}
