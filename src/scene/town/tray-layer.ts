import Phaser from 'phaser'
import type { GameState } from '../../game/types'
import { COLORS, colorCss } from '../tokens'
import { expeditionUnits, unassignedUnits, type PlanState } from '../plan'
import { TOKEN_HIT, UnitToken } from '../ui/token'

export interface TrayCallbacks {
  onTokenPointerDown: (unitId: string, worldX: number, worldY: number) => void
}

const TOKEN_GAP = 8
const ROW_HEIGHT = 52
const HEADER_HEIGHT = 18

export class TrayLayer extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics
  private readonly header: Phaser.GameObjects.Text
  private readonly awayHeader: Phaser.GameObjects.Text
  private readonly row: Phaser.GameObjects.Container
  private readonly awayRow: Phaser.GameObjects.Container
  private readonly callbacks: TrayCallbacks
  private trayWidth = 0
  private trayHeight = 0

  constructor(scene: Phaser.Scene, callbacks: TrayCallbacks) {
    super(scene)
    this.callbacks = callbacks
    this.bg = scene.add.graphics()
    this.header = scene.add.text(8, 4, '', {
      fontFamily: 'DotGothic16',
      fontSize: '12px',
      color: colorCss(COLORS.inkDim),
    })
    this.awayHeader = scene.add.text(8, 0, '', {
      fontFamily: 'DotGothic16',
      fontSize: '12px',
      color: colorCss(COLORS.inkDim),
    })
    this.row = scene.add.container(8, HEADER_HEIGHT + ROW_HEIGHT / 2)
    this.awayRow = scene.add.container(8, 0)
    this.add([this.bg, this.header, this.awayHeader, this.row, this.awayRow])
    scene.add.existing(this)
  }

  setBounds(x: number, y: number, width: number, height: number): void {
    this.setPosition(x, y)
    this.trayWidth = width
    this.trayHeight = height
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
    this.header.setText(`待機中の人員（${unassigned.length}）`)
    this.syncRow(
      this.row,
      state,
      unassigned.map((u) => u.id),
      selectedUnitId,
      false,
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
        true,
      )
    }
  }

  private syncRow(
    host: Phaser.GameObjects.Container,
    state: GameState,
    unitIds: string[],
    selectedUnitId: string | null,
    away: boolean,
  ): void {
    const have = new Map(
      (host.list as UnitToken[]).map((t) => [t.unitId, t] as [string, UnitToken]),
    )
    const wanted = new Set(unitIds)
    for (const [id, token] of have) {
      if (!wanted.has(id)) {
        host.remove(token)
        token.destroy()
      }
    }
    unitIds.forEach((id, i) => {
      let token = have.get(id)
      const unit = state.units.find((u) => u.id === id)
      if (!unit) return
      if (!token) {
        token = new UnitToken(this.scene, unit)
        if (!away) {
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
        } else {
          token.disableInteractive()
          token.setAlpha(0.5)
        }
        host.add(token)
      }
      token.setPosition(i * (TOKEN_HIT + TOKEN_GAP) + TOKEN_HIT / 2, 0)
      token.setSelected(selectedUnitId === id)
    })
  }
}
