import Phaser from 'phaser'
import { KEYS, SCENE_EVENTS } from '../keys'
import { COLORS } from '../tokens'
import { deviceClassOf, readSafeInsets, type SafeInsets } from '../layout'
import { computeRegions, type Regions } from '../regions'
import { randomSeed } from '../../store'
import { sharedStore, type SceneStore } from '../store-bridge'
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
import { applyEffects, step } from '../../game/engine'
import { deriveFacilityView } from '../town/facility-view'
import { FACILITIES } from '../town/facilities'
import { TOWN_BASE, type FacilityId } from '../town/layout'
import { TownLayer } from '../town/town-layer'
import { TrayLayer } from '../town/tray-layer'
import { HudBar } from '../hud'
import { PlanStrip, TASK_LABEL } from '../plan-strip'
import { DetailPanel, UnitDetailsOverlay } from '../detail-panel'
import { LogDrawer } from '../log-drawer'
import { ConfirmOverlay, MenuOverlay } from '../menu'
import { OverlayStack } from '../overlays'
import { PlaybackController } from '../playback/playback'
import { TownAmbience } from '../town/ambience'
import { resolveFx } from '../town/fx-map'
import { formatDelta } from '../labels'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'
import { DRAG_THRESHOLD } from '../ui/token'

export class PlayScene extends Phaser.Scene {
  private store!: SceneStore
  private plan: PlanState = emptyPlan()
  private selectedUnitId: string | null = null
  private selectedFacility: FacilityId | null = null
  private insets: SafeInsets = readSafeInsets()
  private regions!: Regions
  private town!: TownLayer
  private tray!: TrayLayer
  private hud!: HudBar
  private strip!: PlanStrip
  private detail!: DetailPanel
  private unitDetails!: UnitDetailsOverlay
  private log!: LogDrawer
  private menu!: MenuOverlay
  private confirm!: ConfirmOverlay
  private overlays!: OverlayStack
  private ambience!: TownAmbience
  private skipButton!: PixelButton
  private lastBeatKey: string | null = null
  private readonly playback = new PlaybackController()
  private ghost: Phaser.GameObjects.Text | null = null
  private pendingTap: { unitId: string; x: number; y: number } | null = null
  private dragUnitId: string | null = null
  private unsubscribe: (() => void) | null = null

  constructor() {
    super(KEYS.play)
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.night900)
    this.store = sharedStore()
    this.town = new TownLayer(this, {
      onFacilityTap: (id) => this.onFacilityTap(id),
      onTokenPointerDown: (unitId, x, y) => this.onTokenPointerDown(unitId, x, y),
    })
    this.tray = new TrayLayer(this, {
      onTokenPointerDown: (unitId, x, y) => this.onTokenPointerDown(unitId, x, y),
    })
    this.ambience = new TownAmbience(this)
    this.hud = new HudBar(this, {
      onUndo: () => {
        if (!this.busy) this.store.dispatch({ type: 'undo' })
      },
      onMenu: () => this.menu.show(),
    })
    this.strip = new PlanStrip(this, {
      onAuto: () => {
        if (this.busy) return
        this.plan = fromAutoAssign(autoAssign(this.store.get().state))
        this.selectedUnitId = null
        this.refresh()
      },
      onReset: () => {
        if (this.busy) return
        this.plan = emptyPlan()
        this.selectedUnitId = null
        this.refresh()
      },
      onCommit: () => this.tryCommit(),
      onToggleRation: () => {
        if (this.busy) return
        this.plan = { ...this.plan, ration: !this.plan.ration }
        this.refresh()
      },
      onToggleProcure: () => {
        if (this.busy) return
        this.plan = { ...this.plan, procure: !this.plan.procure }
        this.refresh()
      },
    })
    this.detail = new DetailPanel(this, {
      onClose: () => {
        this.selectedFacility = null
        this.selectedUnitId = null
        this.refresh()
      },
      onOpenUnit: (unitId) => {
        const unit = this.store.get().state.units.find((u) => u.id === unitId)
        if (unit) this.unitDetails.show(unit)
      },
    })
    this.unitDetails = new UnitDetailsOverlay(this, () => this.unitDetails.hide())
    this.log = new LogDrawer(this)
    this.menu = new MenuOverlay(this, {
      onClose: () => this.menu.hide(),
      onBackToTitle: () => {
        this.menu.hide()
        this.scene.start(KEYS.title)
      },
      onRestart: () => {
        this.menu.hide()
        if (window.confirm('新しいゲームを始めますか？現在の進行は失われます。')) {
          this.store.dispatch({ type: 'newGame', seed: randomSeed() })
        }
      },
    })
    this.confirm = new ConfirmOverlay(this, {
      onConfirm: () => {
        this.confirm.hide()
        this.commit()
      },
      onCancel: () => this.confirm.hide(),
    })
    this.overlays = new OverlayStack(this, {
      onConfirm: () => this.playback.confirm(),
      onChoose: (optionId) => this.resolveChoice(optionId),
      onEndingRestart: () => this.store.dispatch({ type: 'newGame', seed: randomSeed() }),
      onEndingTitle: () => this.scene.start(KEYS.title),
    })
    this.skipButton = new PixelButton(this, {
      label: 'スキップ ▶▶',
      width: 150,
      height: 40,
      onAction: () => this.playback.skip(),
    })
    this.skipButton.setVisible(false)
    this.playback.onChange = () => this.refresh()
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.onPointerMove(pointer))
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.onPointerUp(pointer))
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.menu.isOpen) this.menu.hide()
      else if (this.unitDetails.isOpen) this.unitDetails.hide()
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
      this.playback.destroy()
      this.game.events.off(SCENE_EVENTS.deviceClass, this.layout, this)
    })
    this.layout()
  }

  private get busy(): boolean {
    return this.playback.current !== null
  }

  private view() {
    const state = this.store.get().state
    const pb = this.playback.current
    if (!pb) return state
    const effects = pb.beats.slice(0, pb.index + 1).flatMap((b) => b.effects)
    return { ...applyEffects(pb.prev, effects), day: pb.prev.day }
  }

  private onTokenPointerDown(unitId: string, x: number, y: number): void {
    if (this.busy) return
    this.pendingTap = { unitId, x, y }
  }

  private onFacilityTap(id: FacilityId): void {
    if (this.busy) return
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
    this.selectedUnitId = null
    this.refresh()
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
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
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
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
      if (!this.busy) {
        this.selectedUnitId = this.selectedUnitId === unitId ? null : unitId
        this.selectedFacility = null
        this.refresh()
      }
    }
  }

  private resolveDrop(unitId: string, worldX: number, worldY: number): void {
    if (this.busy) return
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

  private tryCommit(): void {
    if (this.busy) return
    const remaining = unassignedUnits(this.store.get().state, this.plan).length
    if (remaining > 0) {
      this.confirm.show(remaining, this.planSummary())
      return
    }
    this.commit()
  }

  private planSummary(): string {
    const plan = buildPlan(this.plan)
    if (plan.placements.length === 0 && !plan.ration && !plan.procure) return '（割り当てなし）'
    const parts = plan.placements.map((p) => `${TASK_LABEL[p.task]} ×${p.unitIds.length}`)
    if (plan.ration) parts.push('節約配給')
    if (plan.procure) parts.push('備蓄を調達')
    return parts.join(' ／ ')
  }

  private commit(): void {
    const prev = this.store.get().state
    const result = step(prev, { type: 'commitDay', plan: buildPlan(this.plan) })
    this.store.dispatch({ type: 'commitDay', plan: buildPlan(this.plan) })
    this.playback.start(prev, result.effects)
    this.refresh()
  }

  private resolveChoice(optionId: string): void {
    if (this.busy) return
    const prev = this.store.get().state
    const result = step(prev, { type: 'resolveChoice', optionId })
    this.store.dispatch({ type: 'resolveChoice', optionId })
    this.playback.start(prev, result.effects)
    this.refresh()
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
    const deviceClass = deviceClassOf(window.innerWidth)
    this.regions = computeRegions(deviceClass, width, height, this.insets)
    const r = this.regions
    const scale = Math.min(r.town.width / TOWN_BASE.width, r.town.height / TOWN_BASE.height)
    this.town.setScale(scale)
    this.town.setPosition(
      r.town.x + (r.town.width - TOWN_BASE.width * scale) / 2,
      r.town.y + (r.town.height - TOWN_BASE.height * scale) / 2,
    )
    this.hud.setBounds(r.hud, deviceClass)
    this.strip.setBounds(r.strip, deviceClass)
    this.tray.setBounds(r.tray.x, r.tray.y, r.tray.width, r.tray.height, deviceClass)
    this.detail.setBounds(r.detail)
    this.log.setAnchor(r.hud.x + 8, r.hud.y + r.hud.height + 8, Math.min(440, r.hud.width - 16))
    this.skipButton.setPosition(width / 2, r.town.y + r.town.height - 28)
    this.ambience.setPosition(r.town.x, r.town.y)
    this.ambience.setArea(r.town.width, r.town.height)
    this.refresh()
  }

  private triggerBeatFx(): void {
    const pb = this.playback.current
    const beatKey = pb ? `${pb.prev.rng.seed}:${pb.index}` : null
    if (pb && beatKey !== this.lastBeatKey) {
      const beat = pb.beats[pb.index]
      if (beat?.kind === 'flow') {
        const e = beat.effects[0]
        if (e) {
          const entry = resolveFx(e.source, e.target)
          this.town.playFx(
            entry,
            formatDelta(e.target, e.delta),
            e.delta >= 0 ? COLORS.green : COLORS.red,
          )
        }
      } else if (beat?.kind === 'arrival') {
        this.town.playArrival()
      }
    }
    this.lastBeatKey = beatKey
  }

  private refresh(): void {
    const state = this.store.get().state
    const view = this.view()
    const narrow = deviceClassOf(window.innerWidth) === 'narrow'
    const busy = this.busy
    const view2 = deriveFacilityView(view, this.plan)
    this.hud.update(view, this.store.get().history.length > 0 && !busy)
    this.strip.update(view, this.plan, unassignedUnits(view, this.plan).length, busy)
    this.town.update(view, this.plan, view2, {
      selectedFacility: this.selectedFacility,
      placeableUnitId: this.selectedUnitId,
    })
    this.tray.update(view, this.plan, this.selectedUnitId)
    const hasSelection = this.selectedFacility !== null || this.selectedUnitId !== null
    this.detail.setVisible(!narrow || hasSelection)
    if (this.detail.visible) {
      this.detail.update({
        state: view,
        plan: this.plan,
        view: view2,
        selectedFacility: this.selectedFacility,
        selectedUnitId: this.selectedUnitId,
      })
    }
    this.log.update(view.report)
    this.overlays.update({ state, busy, beat: this.playback.beat })
    this.skipButton.setVisible(busy && !this.playback.waiting)
    this.ambience.update(view)
    this.triggerBeatFx()
  }
}
