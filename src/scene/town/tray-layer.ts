import Phaser from 'phaser'
import type { GameState } from '../../game/types'
import { COLORS, colorCss } from '../tokens'
import { expeditionUnits, unassignedUnits, type PlanState } from '../plan'
import { TOKEN_HIT, reconcileTokens, type UnitToken } from '../ui/token'
import { pixelText } from '../ui/pixel-text'
import type { DeviceClass } from '../layout'

export interface TrayCallbacks {
  onTokenPointerDown: (unitId: string, worldX: number, worldY: number) => void
}

const TOKEN_GAP = 8
const ROW_HEIGHT = 52
const HEADER_HEIGHT = 18
const TRAY_SCALE = 0.8
const MIN_PITCH = { wide: 40, narrow: 44 } as const

export class TrayLayer extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics
  private readonly header: Phaser.GameObjects.Text
  private readonly awayHeader: Phaser.GameObjects.Text
  private readonly row: Phaser.GameObjects.Container
  private readonly awayRow: Phaser.GameObjects.Container
  private readonly awayBadges = new Map<string, Phaser.GameObjects.Text>()
  private readonly callbacks: TrayCallbacks
  private trayWidth = 0
  private trayHeight = 0
  private deviceClass: DeviceClass = 'narrow'

  constructor(scene: Phaser.Scene, callbacks: TrayCallbacks) {
    super(scene)
    this.callbacks = callbacks
    this.bg = scene.add.graphics()
    this.header = pixelText(scene, '', { fontSize: 12, color: COLORS.inkDim })
    this.header.setPosition(8, 4)
    this.awayHeader = pixelText(scene, '', { fontSize: 12, color: COLORS.inkDim })
    this.awayHeader.setPosition(8, 0)
    this.row = scene.add.container(8, HEADER_HEIGHT + ROW_HEIGHT / 2)
    this.awayRow = scene.add.container(8, 0)
    this.add([this.bg, this.header, this.awayHeader, this.row, this.awayRow])
    scene.add.existing(this)
  }

  setBounds(x: number, y: number, width: number, height: number, deviceClass: DeviceClass): void {
    this.setPosition(x, y)
    this.trayWidth = width
    this.trayHeight = height
    this.deviceClass = deviceClass
    this.redrawBg()
  }

  containsWorld(worldX: number, worldY: number): boolean {
    const point = this.getLocalPoint(worldX, worldY)
    return point.x >= 0 && point.x <= this.trayWidth && point.y >= 0 && point.y <= this.trayHeight
  }

  private redrawBg(): void {
    const g = this.bg
    g.clear()
    g.fillStyle(COLORS.night800, 0.6)
    g.fillRect(0, 0, this.trayWidth, this.trayHeight)
    g.lineStyle(2, COLORS.frameLo)
    g.strokeRect(1, 1, this.trayWidth - 2, this.trayHeight - 2)
  }

  update(state: GameState, plan: PlanState, selectedUnitId: string | null): void {
    const unassigned = unassignedUnits(state, plan)
    const away = expeditionUnits(state)
    if (this.deviceClass === 'wide') {
      this.header.setVisible(false)
      this.awayHeader.setVisible(false)
      this.row.setPosition(8, this.trayHeight / 2)
      this.awayRow.removeAll(true)
      this.awayRow.setVisible(false)
      this.syncRow(
        this.row,
        state,
        [...unassigned.map((u) => u.id), ...away.map((u) => u.id)],
        selectedUnitId,
        TRAY_SCALE,
        away.map((u) => u.id),
      )
      return
    }
    this.header.setVisible(true)
    this.header.setText(`待機中の人員（${unassigned.length}）`)
    this.row.setPosition(8, HEADER_HEIGHT + ROW_HEIGHT / 2)
    this.syncRow(
      this.row,
      state,
      unassigned.map((u) => u.id),
      selectedUnitId,
      1,
      [],
    )
    const showAway = away.length > 0
    this.awayHeader.setVisible(showAway)
    this.awayRow.setVisible(showAway)
    if (showAway) {
      this.awayHeader.setText(`探索中（${away.length}）`)
      this.awayHeader.setY(HEADER_HEIGHT + ROW_HEIGHT + 4)
      this.awayRow.setY(HEADER_HEIGHT + ROW_HEIGHT + 4 + HEADER_HEIGHT + ROW_HEIGHT / 2)
      this.syncRow(
        this.awayRow,
        state,
        away.map((u) => u.id),
        null,
        1,
        [],
      )
    }
  }

  private pitchFor(count: number): number {
    const min = MIN_PITCH[this.deviceClass]
    const avail = Math.max(min, this.trayWidth - 16)
    return Math.max(min, Math.min(TOKEN_HIT + TOKEN_GAP, Math.floor(avail / Math.max(1, count))))
  }

  private syncRow(
    host: Phaser.GameObjects.Container,
    state: GameState,
    unitIds: string[],
    selectedUnitId: string | null,
    scale: number,
    awayIds: string[],
  ): void {
    const { tokens } = reconcileTokens(this.scene, host, state, unitIds, {
      unitOptions: { scale },
      onPointerDown: (id, x, y) => this.callbacks.onTokenPointerDown(id, x, y),
      onRemoved: (id) => this.removeAwayBadge(host, id),
    })
    const awaySet = new Set(awayIds)
    const pitch = this.pitchFor(unitIds.length)
    tokens.forEach((token, i) => {
      const id = token.unitId
      if (awaySet.has(id)) {
        token.disableInteractive()
        token.setAlpha(0.5)
      } else {
        token.setInteractive()
        token.setAlpha(1)
      }
      token.setPosition(i * pitch + TOKEN_HIT / 2, 0)
      token.setSelected(selectedUnitId === id)
      if (awaySet.has(id)) this.ensureAwayBadge(host, id, token)
      else this.removeAwayBadge(host, id)
    })
  }

  private ensureAwayBadge(host: Phaser.GameObjects.Container, id: string, token: UnitToken): void {
    let badge = this.awayBadges.get(id)
    if (!badge) {
      badge = pixelText(this.scene, '探', {
        fontSize: 11,
        color: COLORS.night900,
        backgroundColor: colorCss(COLORS.cyan),
      })
      badge.setOrigin(1, 0)
      this.awayBadges.set(id, badge)
      host.add(badge)
    }
    badge.setPosition(token.x + 17, token.y - 17)
  }

  private removeAwayBadge(host: Phaser.GameObjects.Container, id: string): void {
    const badge = this.awayBadges.get(id)
    if (badge) {
      host.remove(badge)
      badge.destroy()
      this.awayBadges.delete(id)
    }
  }
}
