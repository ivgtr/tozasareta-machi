import Phaser from 'phaser'
import { KEYS, SCENE_EVENTS } from '../keys'
import { COLORS } from '../tokens'
import { deviceClassOf, readSafeInsets, toLogicalSafeInsets } from '../layout'
import { computeRegions, type Regions } from '../regions'
import { PresentationDirector } from '../presentation'
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
import { applyEffects } from '../../game/effects'
import { deriveFacilityView } from '../town/facility-view'
import { FACILITIES } from '../town/facilities'
import { TOWN_BASE, type FacilityId } from '../town/layout'
import { TownLayer } from '../town/town-layer'
import { CharacterDeck } from '../character/character-deck'
import { CharacterFocus } from '../character/character-focus'
import { CharacterDragGhost } from '../character/character-drag-ghost'
import { FacilityDetailPanel } from '../facility-detail'
import { HudBar } from '../hud'
import { PlanStrip, TASK_LABEL } from '../plan-strip'
import { LogDrawer } from '../log-drawer'
import { ConfirmOverlay, MenuOverlay } from '../menu'
import { OverlayStack } from '../overlays'
import { PlaybackController } from '../playback/playback'
import { TurnCoordinator } from '../turn-coordinator'
import { UnitDragController } from '../unit-drag-controller'
import { TownAmbience } from '../town/ambience'
import { resolveFx } from '../town/fx-map'
import { formatDelta, CONFIRM_NEW_GAME } from '../labels'
import { PixelButton } from '../ui/button'
import { DRAG_THRESHOLD } from '../ui/token'

export class PlayScene extends Phaser.Scene {
  private store!: SceneStore
  private turns!: TurnCoordinator
  private drag!: UnitDragController
  private dragGhost!: CharacterDragGhost
  private plan: PlanState = emptyPlan()
  private selectedUnitId: string | null = null
  private selectedFacility: FacilityId | null = null
  private regions!: Regions
  private town!: TownLayer
  private deck!: CharacterDeck
  private characterFocus!: CharacterFocus
  private facilityDetail!: FacilityDetailPanel
  private hud!: HudBar
  private strip!: PlanStrip
  private log!: LogDrawer
  private menu!: MenuOverlay
  private confirm!: ConfirmOverlay
  private overlays!: OverlayStack
  private ambience!: TownAmbience
  private skipButton!: PixelButton
  private lastBeatKey: string | null = null
  private readonly playback = new PlaybackController()
  private readonly presentation = new PresentationDirector()
  private unsubscribe: (() => void) | null = null

  constructor() {
    super(KEYS.play)
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.night900)
    this.store = sharedStore()
    this.turns = new TurnCoordinator(this.store, this.playback)

    this.dragGhost = new CharacterDragGhost(this)
    this.drag = new UnitDragController({
      threshold: DRAG_THRESHOLD,
      ghost: this.dragGhost,
      canInteract: () => !this.busy,
      onTap: (unitId) => this.selectUnit(unitId),
      onDrop: (unitId, worldX, worldY) => {
        this.resolveDrop(unitId, worldX, worldY)
        this.refresh()
      },
    })

    this.town = new TownLayer(this, {
      onFacilityTap: (id) => this.onFacilityTap(id),
      onTokenPointerDown: (unitId, x, y) => this.beginUnitDrag(unitId, x, y),
    })
    this.deck = new CharacterDeck(this, {
      onCharacterPointerDown: (unitId, x, y) => this.beginUnitDrag(unitId, x, y),
    })
    this.characterFocus = new CharacterFocus(this, {
      onClose: () => {
        this.selectedUnitId = null
        this.refresh()
      },
    })
    this.facilityDetail = new FacilityDetailPanel(this, {
      onClose: () => {
        this.selectedFacility = null
        this.refresh()
      },
    })
    this.ambience = new TownAmbience(this)
    this.hud = new HudBar(this, {
      onUndo: () => {
        if (this.busy) return
        this.store.dispatch({ type: 'undo' })
        this.clearPlan()
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
    this.log = new LogDrawer(this)
    this.menu = new MenuOverlay(this, {
      onClose: () => this.menu.hide(),
      onBackToTitle: () => {
        this.menu.hide()
        this.scene.start(KEYS.title)
      },
      onRestart: () => {
        this.menu.hide()
        if (window.confirm(CONFIRM_NEW_GAME)) this.startNewGame()
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
      onEndingRestart: () => this.startNewGame(),
      onEndingTitle: () => this.scene.start(KEYS.title),
    })
    this.skipButton = new PixelButton(this, {
      label: 'スキップ ▶▶',
      width: 150,
      height: 40,
      onAction: () => this.playback.skip(),
    })
    this.skipButton.setVisible(false)
    this.playback.onChange = () => {
      if (!this.playback.current) this.clearPlan()
      this.refresh()
    }
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.drag.pointerMove(pointer))
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.drag.pointerUp(pointer))
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.menu.isOpen) {
        this.menu.hide()
        return
      }
      if (this.characterFocus.isOpen || this.facilityDetail.isOpen) {
        this.selectedUnitId = null
        this.selectedFacility = null
        this.refresh()
      }
    })
    this.unsubscribe = this.store.subscribe(() => {
      this.selectedUnitId = null
      this.selectedFacility = null
      this.refresh()
    })
    this.game.events.on(SCENE_EVENTS.deviceClass, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.()
      this.drag.cancel()
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
    const playback = this.playback.current
    if (!playback) return state
    const effects = playback.beats.slice(0, playback.index + 1).flatMap((beat) => beat.effects)
    return { ...applyEffects(playback.prev, effects), day: playback.prev.day }
  }

  private beginUnitDrag(unitId: string, worldX: number, worldY: number): void {
    if (this.busy) return
    const unit = this.store.get().state.units.find((candidate) => candidate.id === unitId)
    if (!unit) return
    this.dragGhost.setUnit(unit)
    this.drag.pointerDown(unitId, worldX, worldY)
  }

  private selectUnit(unitId: string): void {
    if (this.busy) return
    this.selectedUnitId = this.selectedUnitId === unitId ? null : unitId
    this.selectedFacility = null
    this.refresh()
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
    if (this.deck.containsWorld(worldX, worldY)) {
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
    const parts = plan.placements.map(
      (placement) => `${TASK_LABEL[placement.task]} ×${placement.unitIds.length}`,
    )
    if (plan.ration) parts.push('節約配給')
    if (plan.procure) parts.push('備蓄を調達')
    return parts.join(' ／ ')
  }

  private commit(): void {
    this.turns.commit(buildPlan(this.plan))
    this.refresh()
  }

  private startNewGame(): void {
    this.turns.restart(randomSeed())
    this.clearPlan()
  }

  private clearPlan(): void {
    this.plan = emptyPlan()
    this.selectedUnitId = null
    this.selectedFacility = null
    this.drag.cancel()
  }

  private resolveChoice(optionId: string): void {
    if (this.busy) return
    this.turns.resolveChoice(optionId)
    this.refresh()
  }

  private layout(): void {
    this.applyLayout()
    this.refresh()
  }

  private applyLayout(): void {
    const { width, height } = this.scale.gameSize
    const deviceClass = deviceClassOf(window.innerWidth)
    const canvas = this.game.canvas.getBoundingClientRect()
    const insets = toLogicalSafeInsets(
      readSafeInsets(),
      window.innerWidth,
      window.innerHeight,
      {
        left: canvas.left,
        top: canvas.top,
        right: canvas.right,
        bottom: canvas.bottom,
        width: canvas.width,
        height: canvas.height,
      },
      width,
      height,
    )
    this.regions = computeRegions(deviceClass, width, height, insets)
    const regions = this.regions
    const scale = Math.min(
      regions.town.width / TOWN_BASE.width,
      regions.town.height / TOWN_BASE.height,
    )
    this.town.setScale(scale)
    this.town.setPosition(
      regions.town.x + (regions.town.width - TOWN_BASE.width * scale) / 2,
      regions.town.y + (regions.town.height - TOWN_BASE.height * scale) / 2,
    )
    this.hud.setBounds(regions.hud, deviceClass)
    this.strip.setBounds(regions.strip, deviceClass)
    this.deck.setBounds(
      regions.deck.x,
      regions.deck.y,
      regions.deck.width,
      regions.deck.height,
      deviceClass,
    )
    this.characterFocus.setBounds(regions.town, deviceClass)
    this.facilityDetail.setBounds(regions.town, deviceClass)
    this.log.setAnchor(
      regions.hud.x + 8,
      regions.hud.y + regions.hud.height + 8,
      Math.min(440, regions.hud.width - 16),
    )
    this.skipButton.setPosition(width - 100, regions.town.y + regions.town.height - 24)
    this.ambience.setPosition(regions.town.x, regions.town.y)
    this.ambience.setArea(regions.town.width, regions.town.height)
  }

  private triggerBeatFx(): void {
    const playback = this.playback.current
    const beatKey = playback ? `${playback.prev.rng.seed}:${playback.index}` : null
    if (playback && beatKey !== this.lastBeatKey) {
      const beat = playback.beats[playback.index]
      if (beat?.kind === 'flow') {
        const effect = beat.effects[0]
        if (effect) {
          const entry = resolveFx(effect.source, effect.target)
          this.town.playFx(
            entry,
            formatDelta(effect.target, effect.delta),
            effect.delta >= 0 ? COLORS.green : COLORS.red,
          )
        }
      } else if (beat?.kind === 'arrival') {
        this.town.playArrival()
      }
    }
    this.lastBeatKey = beatKey
  }

  private refresh(): void {
    const store = this.store.get()
    const state = store.state
    const view = this.view()
    const busy = this.busy
    const frame = this.presentation.resolve({
      state,
      beat: this.playback.beat,
      selectedUnitId: this.selectedUnitId,
      selectedFacility: this.selectedFacility,
    })
    const facilityView = deriveFacilityView(view, this.plan)

    this.hud.update(view, store.history.length > 0 && !busy)
    this.strip.update(view, this.plan, unassignedUnits(view, this.plan).length, busy)
    this.town.update(view, this.plan, facilityView, {
      selectedFacility: this.selectedFacility,
      placeableUnitId: this.selectedUnitId,
    })
    this.deck.update(view, this.plan, this.selectedUnitId)

    const selectedUnit =
      frame.mode === 'unit-focus'
        ? view.units.find((unit) => unit.id === this.selectedUnitId)
        : undefined
    if (selectedUnit) {
      const assignment =
        Object.entries(this.plan.placements).find(([, unitIds]) =>
          unitIds?.includes(selectedUnit.id),
        )?.[0] ?? '待機中'
      this.characterFocus.show(
        selectedUnit,
        assignment === '待機中' ? assignment : TASK_LABEL[assignment as keyof typeof TASK_LABEL],
      )
    } else {
      this.characterFocus.hide()
    }

    if (frame.mode === 'facility-focus' && this.selectedFacility) {
      this.facilityDetail.show(
        { state: view, plan: this.plan, view: facilityView },
        this.selectedFacility,
      )
    } else {
      this.facilityDetail.hide()
    }

    this.log.update(view.report)
    this.overlays.update({ state, busy, beat: this.playback.beat })
    const playback = this.playback.current
    this.skipButton.setVisible(
      !!playback && !this.playback.waiting && playback.index < playback.beats.length - 1,
    )
    this.ambience.update(view)
    this.triggerBeatFx()
  }
}
