import Phaser from 'phaser'
import { autoAssign } from '../../game/actions'
import { randomSeed, reducedMotion } from '../../store'
import { CharacterDeck } from '../character/character-deck'
import { CharacterDragGhost } from '../character/character-drag-ghost'
import { CharacterFocus } from '../character/character-focus'
import { MenuPresentation } from '../global/menu-presentation'
import { transitionToScene } from '../global/scene-transition'
import { HudBar } from '../hud'
import { KEYS, SCENE_EVENTS } from '../keys'
import { CONFIRM_NEW_GAME } from '../labels'
import { deviceClassOf, readSafeInsets, toLogicalSafeInsets } from '../layout'
import { LogDrawer } from '../log-drawer'
import {
  buildPlan,
  emptyPlan,
  fromAutoAssign,
  unassignedUnits,
  withMove,
  withRemove,
  type PlanState,
} from '../plan'
import { deriveFlowPresentation, type FlowPresentationModel } from '../playback/flow-model'
import { FlowPresentation, flowAccent } from '../playback/flow-presentation'
import { PlaybackController } from '../playback/playback'
import { TownPlaybackFx } from '../playback/town-playback-fx'
import { CommitConfirmPresentation } from '../planning/commit-confirm-presentation'
import { FacilityFocus } from '../planning/facility-focus'
import { PlanningControls } from '../planning/planning-controls'
import { PresentationDirector } from '../presentation'
import { computeRegions, type Regions } from '../regions'
import { sharedStore, type SceneStore } from '../store-bridge'
import { StoryPresentations, isStoryPresentation } from '../story/story-presentations'
import { TASK_LABEL, TASK_PRESENTATION } from '../task-presentation'
import { COLORS } from '../tokens'
import { deriveFacilityView } from '../town/facility-view'
import { FACILITIES } from '../town/facilities'
import type { FacilityId } from '../town/layout'
import { TownLayer } from '../town/town-layer'
import {
  deriveTownViewport,
  type TownViewportPreset,
  type TownViewportTransform,
} from '../town/viewport'
import { TurnCoordinator } from '../turn-coordinator'
import { DRAG_THRESHOLD } from '../ui/token'
import { UnitDragController } from '../unit-drag-controller'

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
  private playbackFx!: TownPlaybackFx
  private townMask!: Phaser.GameObjects.Graphics
  private deck!: CharacterDeck
  private characterFocus!: CharacterFocus
  private facilityFocus!: FacilityFocus
  private hud!: HudBar
  private controls!: PlanningControls
  private log!: LogDrawer
  private menu!: MenuPresentation
  private confirm!: CommitConfirmPresentation
  private story!: StoryPresentations
  private flow!: FlowPresentation
  private lastBeatKey: string | null = null
  private townViewportKey: string | null = null
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

    this.townMask = new Phaser.GameObjects.Graphics(this)
    this.town = new TownLayer(this, {
      onFacilityTap: (id) => this.onFacilityTap(id),
      onTokenPointerDown: (unitId, x, y) => this.beginUnitDrag(unitId, x, y),
    })
    this.playbackFx = new TownPlaybackFx(this)
    const townGeometryMask = this.townMask.createGeometryMask()
    this.town.setMask(townGeometryMask)
    this.playbackFx.setMask(townGeometryMask)
    this.deck = new CharacterDeck(this, {
      onCharacterPointerDown: (unitId, x, y) => this.beginUnitDrag(unitId, x, y),
    })
    this.characterFocus = new CharacterFocus(this, {
      onClose: () => {
        this.selectedUnitId = null
        this.refresh()
      },
    })
    this.facilityFocus = new FacilityFocus(this, {
      onClose: () => {
        this.selectedFacility = null
        this.refresh()
      },
      onSelectUnit: (unitId) => {
        this.selectedFacility = null
        this.selectedUnitId = unitId
        this.refresh()
      },
    })
    this.log = new LogDrawer(this)
    this.hud = new HudBar(this, {
      onUndo: () => {
        if (this.busy) return
        this.store.dispatch({ type: 'undo' })
        this.clearPlan()
      },
      onLog: () => this.log.toggle(),
      onMenu: () => this.menu.show(this.view()),
    })
    this.controls = new PlanningControls(this, {
      onAuto: () => {
        if (this.busy) return
        this.plan = fromAutoAssign(autoAssign(this.store.get().state))
        this.selectedUnitId = null
        this.refresh()
      },
      onCommit: () => this.tryCommit(),
      onUnassignSelected: () => {
        if (this.busy || !this.selectedUnitId) return
        this.plan = withRemove(this.plan, this.selectedUnitId)
        this.refresh()
      },
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
    this.menu = new MenuPresentation(this, {
      onClose: () => this.menu.hide(),
      onBackToTitle: () => {
        this.menu.hide()
        transitionToScene(this, KEYS.title)
      },
      onRestart: () => {
        this.menu.hide()
        if (window.confirm(CONFIRM_NEW_GAME)) this.startNewGame()
      },
    })
    this.confirm = new CommitConfirmPresentation(this, {
      onConfirm: () => {
        this.confirm.hide()
        this.commit()
      },
      onCancel: () => this.confirm.hide(),
    })
    this.story = new StoryPresentations(this, {
      onConfirmBeat: () => this.playback.confirm(),
      onChoose: (optionId) => this.resolveChoice(optionId),
      onEndingRestart: () => this.startNewGame(),
      onEndingTitle: () => transitionToScene(this, KEYS.title),
    })
    this.flow = new FlowPresentation(this, {
      onSkip: () => this.playback.skipFlow(),
    })
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
      if (this.log.isOpen) {
        this.log.hide()
        return
      }
      if (this.characterFocus.isOpen || this.facilityFocus.isOpen) {
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
    return this.playback.projectedState ?? this.store.get().state
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
    if (this.deck.containsWorld(worldX, worldY)) this.plan = withRemove(this.plan, unitId)
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

  private selectedUnitAssigned(): boolean {
    const selectedUnitId = this.selectedUnitId
    if (!selectedUnitId) return false
    return Object.values(this.plan.placements).some((ids) => ids?.includes(selectedUnitId))
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
    this.townMask.clear()
    this.townMask.fillStyle(0xffffff)
    this.townMask.fillRect(regions.town.x, regions.town.y, regions.town.width, regions.town.height)
    this.townViewportKey = null
    this.hud.setBounds(regions.hud, deviceClass)
    this.controls.setBounds(regions.controls, deviceClass)
    this.deck.setBounds(
      regions.deck.x,
      regions.deck.y,
      regions.deck.width,
      regions.deck.height,
      deviceClass,
    )
    this.characterFocus.setBounds(regions.town, deviceClass)
    this.facilityFocus.setBounds(regions.town, deviceClass)
    this.log.setAnchor(
      regions.hud.x + 8,
      regions.hud.y + regions.hud.height + 8,
      Math.min(440, regions.hud.width - 16),
    )
    this.menu.setViewport(width, height, deviceClass)
    this.story.setViewport(width, height, deviceClass)
    this.flow.setViewport(width, height, deviceClass)
  }

  private triggerPlaybackFx(model: FlowPresentationModel | null): void {
    const playback = this.playback.current
    const beat = this.playback.beat
    const beatKey = playback && beat ? `${playback.base.day}:${playback.index}:${beat.kind}` : null
    if (playback && beat && beatKey !== this.lastBeatKey) {
      if (beat.kind === 'flow' && model) {
        this.playbackFx.play(model.fx, flowAccent(model.tone))
      } else if (beat.kind === 'arrival') {
        this.playbackFx.playArrival()
      }
    }
    this.lastBeatKey = beatKey
  }

  private viewportPreset(
    mode: ReturnType<PresentationDirector['resolve']>['mode'],
    flowModel: FlowPresentationModel | null,
  ): TownViewportPreset {
    if (mode === 'facility-focus' && this.selectedFacility) {
      return { mode: 'facility-focus', facility: this.selectedFacility }
    }
    if (mode === 'unit-focus' && this.selectedUnitId) {
      const task = Object.entries(this.plan.placements).find(([, ids]) =>
        ids?.includes(this.selectedUnitId!),
      )?.[0]
      return {
        mode: 'unit-focus',
        facility: task ? TASK_PRESENTATION[task as keyof typeof TASK_PRESENTATION].facility : null,
      }
    }
    if (mode === 'flow' && flowModel?.facility) {
      return { mode: 'playback-target', facility: flowModel.facility }
    }
    if (mode === 'arrival') return { mode: 'playback-target', facility: 'road' }
    return { mode: 'overview' }
  }

  private applyTownViewport(preset: TownViewportPreset): void {
    const deviceClass = deviceClassOf(window.innerWidth)
    const target = deriveTownViewport(this.regions.town, deviceClass, preset)
    const key = `${preset.mode}:${'facility' in preset ? (preset.facility ?? 'hq') : ''}:${target.x}:${target.y}:${target.scale}`
    if (key === this.townViewportKey) return
    this.townViewportKey = key
    this.tweens.killTweensOf([this.town, this.playbackFx])
    if (reducedMotion() || this.town.scaleX === 1) {
      this.setTownTransform(target)
      return
    }
    this.tweens.add({
      targets: [this.town, this.playbackFx],
      x: target.x,
      y: target.y,
      scaleX: target.scale,
      scaleY: target.scale,
      duration: 280,
      ease: 'Cubic.Out',
    })
  }

  private setTownTransform(transform: TownViewportTransform): void {
    this.town.setPosition(transform.x, transform.y)
    this.town.setScale(transform.scale)
    this.playbackFx.setTownTransform(transform.x, transform.y, transform.scale)
  }

  private refresh(): void {
    const store = this.store.get()
    const state = store.state
    const view = this.view()
    const busy = this.busy
    const beat = this.playback.beat
    const frame = this.presentation.resolve({
      state,
      beat,
      selectedUnitId: this.selectedUnitId,
      selectedFacility: this.selectedFacility,
    })
    const facilityView = deriveFacilityView(view, this.plan)
    const storyMode = isStoryPresentation(frame.mode)
    const flowBeat = frame.mode === 'flow' && beat?.kind === 'flow' ? beat : null
    const flowModel = flowBeat ? deriveFlowPresentation(flowBeat, view) : null
    const planningChrome = !storyMode && flowModel === null

    this.applyTownViewport(this.viewportPreset(frame.mode, flowModel))

    if (!planningChrome && this.log.isOpen) this.log.hide()
    this.hud.setVisible(planningChrome)
    this.controls.setVisible(planningChrome)
    this.deck.setVisible(planningChrome)

    this.hud.update(view, store.history.length > 0 && !busy)
    this.controls.update(view, this.plan, busy, this.selectedUnitAssigned())
    this.town.update(view, this.plan, facilityView, {
      selectedFacility: busy ? null : this.selectedFacility,
      placeableUnitId: busy ? null : this.selectedUnitId,
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
      this.facilityFocus.show(
        { state: view, plan: this.plan, view: facilityView },
        this.selectedFacility,
      )
    } else {
      this.facilityFocus.hide()
    }

    this.log.update(view.report)
    this.story.update(frame.mode, state, beat)
    const playback = this.playback.current
    this.flow.update(
      flowModel,
      playback?.index ?? 0,
      playback?.beats.length ?? 0,
      playback?.reduced ?? false,
    )
    const focusedFacility =
      flowModel?.facility ?? (frame.mode === 'facility-focus' ? this.selectedFacility : null)
    this.playbackFx.setFocus(focusedFacility, flowModel ? flowAccent(flowModel.tone) : COLORS.cyan)
    this.triggerPlaybackFx(flowModel)
  }
}
