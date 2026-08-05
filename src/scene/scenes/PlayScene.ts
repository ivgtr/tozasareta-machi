import Phaser from 'phaser'
import { KEYS, SCENE_EVENTS } from '../keys'
import { COLORS, SPACING } from '../tokens'
import { deviceClassOf } from '../layout'
import { initialSceneStore, type SceneStore } from '../store-bridge'
import {
  buildPlan,
  emptyPlan,
  fromAutoAssign,
  unassignedUnits,
  withMove,
  withRemove,
  type PlanState,
} from '../plan'
import { autoAssign } from '../../game/actions'
import { deriveFacilityView } from '../town/facility-view'
import { FACILITIES } from '../town/facilities'
import { TOWN_BASE, type FacilityId } from '../town/layout'
import { TownLayer } from '../town/town-layer'
import { TrayLayer } from '../town/tray-layer'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'
import { DRAG_THRESHOLD } from '../ui/token'

export class PlayScene extends Phaser.Scene {
  private store!: SceneStore
  private plan: PlanState = emptyPlan()
  private selectedUnitId: string | null = null
  private selectedFacility: FacilityId | null = null
  private town!: TownLayer
  private tray!: TrayLayer
  private statusText!: Phaser.GameObjects.Text
  private autoButton!: PixelButton
  private commitButton!: PixelButton
  private ghost: Phaser.GameObjects.Text | null = null
  private pendingTap: { unitId: string; x: number; y: number } | null = null
  private dragUnitId: string | null = null
  private unsubscribe: (() => void) | null = null

  constructor() {
    super(KEYS.play)
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.night900)
    this.store = initialSceneStore()
    this.town = new TownLayer(this, {
      onFacilityTap: (id) => this.onFacilityTap(id),
      onTokenPointerDown: (unitId, x, y) => {
        this.pendingTap = { unitId, x, y }
      },
    })
    this.tray = new TrayLayer(this, {
      onTokenPointerDown: (unitId, x, y) => {
        this.pendingTap = { unitId, x, y }
      },
    })
    this.statusText = pixelText(this, '', { color: COLORS.inkDim })
    this.autoButton = new PixelButton(this, {
      label: 'おまかせ配置',
      width: 150,
      height: 44,
      onAction: () => {
        this.plan = fromAutoAssign(autoAssign(this.store.get().state))
        this.selectedUnitId = null
        this.refresh()
      },
    })
    this.commitButton = new PixelButton(this, {
      label: '本日の対応を確定',
      width: 190,
      height: 44,
      primary: true,
      onAction: () => this.commit(),
    })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.pendingTap) {
        const dx = pointer.worldX - this.pendingTap.x
        const dy = pointer.worldY - this.pendingTap.y
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
          this.dragUnitId = this.pendingTap.unitId
          this.pendingTap = null
          this.showGhost(pointer.worldX, pointer.worldY)
        }
      }
      if (this.dragUnitId && this.ghost) {
        this.ghost.setPosition(pointer.worldX, pointer.worldY)
      }
    })
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.dragUnitId) {
        this.resolveDrop(this.dragUnitId, pointer.worldX, pointer.worldY)
        this.dragUnitId = null
        this.hideGhost()
        this.refresh()
        return
      }
      if (this.pendingTap) {
        const { unitId } = this.pendingTap
        this.pendingTap = null
        this.selectedUnitId = this.selectedUnitId === unitId ? null : unitId
        this.refresh()
      }
    })
    this.unsubscribe = this.store.subscribe(() => {
      this.plan = emptyPlan()
      this.selectedUnitId = null
      this.selectedFacility = null
      this.refresh()
    })
    this.game.events.on(SCENE_EVENTS.deviceClass, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.()
      this.game.events.off(SCENE_EVENTS.deviceClass, this.layout, this)
    })
    this.layout()
  }

  private onFacilityTap(id: FacilityId): void {
    const meta = FACILITIES[id]
    if (this.selectedUnitId && meta.tasks.length > 0) {
      const next = withMove(this.store.get().state, this.plan, this.selectedUnitId, meta.tasks[0]!)
      if (next) {
        this.plan = next
        this.selectedUnitId = null
      }
      this.refresh()
      return
    }
    this.selectedFacility = this.selectedFacility === id ? null : id
    this.refresh()
  }

  private resolveDrop(unitId: string, worldX: number, worldY: number): void {
    const facility = this.town.facilityAtWorld(worldX, worldY)
    if (facility) {
      const meta = FACILITIES[facility]
      if (meta.tasks.length > 0) {
        const next = withMove(this.store.get().state, this.plan, unitId, meta.tasks[0]!)
        if (next) this.plan = next
        return
      }
    }
    if (this.tray.containsWorld(worldX, worldY)) {
      this.plan = withRemove(this.plan, unitId)
    }
  }

  private commit(): void {
    this.store.dispatch({ type: 'commitDay', plan: buildPlan(this.plan) })
  }

  private showGhost(x: number, y: number): void {
    if (!this.ghost) {
      this.ghost = pixelText(this, '人', { fontSize: 20, color: COLORS.gold })
      this.ghost.setOrigin(0.5)
      this.ghost.setDepth(1000)
    }
    this.ghost.setPosition(x, y)
    this.ghost.setVisible(true)
  }

  private hideGhost(): void {
    this.ghost?.setVisible(false)
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize
    const narrow = deviceClassOf(window.innerWidth) === 'narrow'
    const townAreaHeight = narrow ? height * 0.45 : height * 0.64
    const scale = Math.min(
      (width - SPACING.md) / TOWN_BASE.width,
      townAreaHeight / TOWN_BASE.height,
    )
    this.town.setScale(scale)
    this.town.setPosition((width - TOWN_BASE.width * scale) / 2, SPACING.md)
    const trayHeight = narrow ? 120 : 96
    const trayWidth = narrow ? width - SPACING.md * 2 : Math.min(440, width - SPACING.md * 2)
    this.tray.setBounds(
      width - trayWidth - SPACING.md,
      height - trayHeight - SPACING.md,
      trayWidth,
      trayHeight,
    )
    this.autoButton.setPosition(SPACING.md + 75, height - SPACING.md - 22)
    this.commitButton.setPosition(SPACING.md + 75 + 150 + SPACING.sm + 95, height - SPACING.md - 22)
    this.statusText.setPosition(SPACING.md, height - trayHeight - SPACING.md - 20)
    this.refresh()
  }

  private refresh(): void {
    const state = this.store.get().state
    const view = deriveFacilityView(state, this.plan)
    this.town.update(state, this.plan, view, {
      selectedFacility: this.selectedFacility,
      placeableUnitId: this.selectedUnitId,
    })
    this.tray.update(state, this.plan, this.selectedUnitId)
    const remaining = unassignedUnits(state, this.plan).length
    this.statusText.setText(remaining > 0 ? `${remaining}人 待機` : '配置完了')
  }
}
