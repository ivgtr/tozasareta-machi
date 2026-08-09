import Phaser from 'phaser'
import { autoAssign } from '../../game/actions'
import { randomSeed } from '../../store'
import { audioDirectorFor, type AudioDirector } from '../audio/audio-director'
import { CharacterDeck } from '../character/character-deck'
import { CharacterDragGhost } from '../character/character-drag-ghost'
import { CharacterInspector } from '../character/character-inspector'
import { MenuPresentation } from '../global/menu-presentation'
import { transitionToScene } from '../global/scene-transition'
import { HudBar } from '../hud'
import { handlePlaySceneKeyboard } from '../input/play-scene-shortcuts'
import { KEYS, SCENE_EVENTS } from '../keys'
import { CONFIRM_NEW_GAME } from '../labels'
import { LogDrawer } from '../log-drawer'
import {
  assignedTask,
  buildPlan,
  emptyPlan,
  fromAutoAssign,
  unassignedUnits,
  type PlanState,
} from '../plan'
import { FlowPresentation } from '../playback/flow-presentation'
import { PlaybackController } from '../playback/playback'
import { PlaybackPresentationCoordinator } from '../playback/presentation-coordinator'
import { CommitConfirmPresentation } from '../planning/commit-confirm-presentation'
import { FacilityFocus } from '../planning/facility-focus'
import { PlanningInteractionController } from '../planning/planning-interaction'
import { PlacementStatus } from '../planning/placement-status'
import { PlanningControls } from '../planning/planning-controls'
import { focusedFacilityId, placementUnitId, type PlanningIntent } from '../planning/placement'
import { PresentationDirector } from '../presentation'
import type { Regions } from '../regions'
import { sharedStore, type SceneStore } from '../store-bridge'
import { StoryPresentations, isStoryPresentation } from '../story/story-presentations'
import { TASK_LABEL } from '../task-presentation'
import { COLORS } from '../tokens'
import { deriveFacilityView } from '../town/facility-view'
import { deriveTownAmbience } from '../town/ambience-model'
import { TownLayer } from '../town/town-layer'
import {
  derivePlayTownViewportPreset,
  PlayTownViewportController,
} from '../town/play-scene-viewport'
import { TurnCoordinator } from '../turn-coordinator'
import { DRAG_THRESHOLD } from '../ui/token'
import { UnitDragController } from '../unit-drag-controller'
import { applyPlaySceneLayout } from './play-scene-layout'

export class PlayScene extends Phaser.Scene {
  private store!: SceneStore
  private turns!: TurnCoordinator
  private drag!: UnitDragController
  private dragGhost!: CharacterDragGhost
  private plan: PlanState = emptyPlan()
  private planningIntent: PlanningIntent = { kind: 'none' }
  private planningInteraction!: PlanningInteractionController
  private regions!: Regions
  private town!: TownLayer
  private townMask!: Phaser.GameObjects.Graphics
  private deck!: CharacterDeck
  private placementStatus!: PlacementStatus
  private characterInspector!: CharacterInspector
  private facilityFocus!: FacilityFocus
  private hud!: HudBar
  private controls!: PlanningControls
  private log!: LogDrawer
  private menu!: MenuPresentation
  private confirm!: CommitConfirmPresentation
  private story!: StoryPresentations
  private flow!: FlowPresentation
  private playbackPresentation!: PlaybackPresentationCoordinator
  private audio!: AudioDirector
  private townViewport!: PlayTownViewportController
  private readonly playback = new PlaybackController()
  private readonly presentation = new PresentationDirector()
  private inspectedUnitId: string | null = null
  private unsubscribe: (() => void) | null = null

  constructor() {
    super(KEYS.play)
  }

  create(): void {
    this.audio = audioDirectorFor(this.game)
    void this.audio.unlock()
    this.cameras.main.setBackgroundColor(COLORS.night900)
    this.store = sharedStore()
    this.turns = new TurnCoordinator(this.store, this.playback)

    this.dragGhost = new CharacterDragGhost(this)
    this.drag = new UnitDragController({
      threshold: DRAG_THRESHOLD,
      ghost: this.dragGhost,
      canInteract: () => !this.busy,
      onTap: (unitId) => this.planningInteraction.selectUnit(unitId),
      onDragStart: (unitId) => this.planningInteraction.dragStarted(unitId),
      onDragMove: (unitId, worldX, worldY) =>
        this.planningInteraction.updateDragTarget(unitId, worldX, worldY),
      onDragEnd: () => this.planningInteraction.clearDragTarget(),
      onDrop: (unitId, worldX, worldY) => {
        this.planningInteraction.resolveDrop(unitId, worldX, worldY)
        this.refresh()
      },
    })

    this.townMask = new Phaser.GameObjects.Graphics(this)
    this.town = new TownLayer(this, {
      onFacilityTap: (id) => this.planningInteraction.facilityTap(id),
      onTokenPointerDown: (unitId, x, y) => this.planningInteraction.beginUnitDrag(unitId, x, y),
    })
    const townGeometryMask = this.townMask.createGeometryMask()
    this.town.setMask(townGeometryMask)
    this.deck = new CharacterDeck(this, {
      onCharacterPointerDown: (unitId, x, y) =>
        this.planningInteraction.beginUnitDrag(unitId, x, y),
    })
    this.placementStatus = new PlacementStatus(this, {
      onClose: () => {
        this.audio.play('cancel')
        this.planningIntent = { kind: 'none' }
        this.refresh()
      },
      onInspect: () => {
        const unitId = placementUnitId(this.planningIntent)
        if (!unitId) return
        this.audio.play('select')
        this.inspectedUnitId = unitId
        this.refresh()
      },
    })
    this.characterInspector = new CharacterInspector(this, {
      onClose: () => {
        this.audio.play('cancel')
        this.inspectedUnitId = null
        this.refresh()
      },
    })
    this.facilityFocus = new FacilityFocus(this, {
      onClose: () => {
        this.audio.play('cancel')
        this.planningIntent = { kind: 'none' }
        this.refresh()
      },
      onReassignUnit: (unitId) => this.planningInteraction.reassignUnit(unitId),
      onRequestAssignment: (facilityId) =>
        this.planningInteraction.requestFacilityAssignment(facilityId),
      onUnassignUnit: (unitId) => this.planningInteraction.unassignUnit(unitId),
    })
    this.planningInteraction = new PlanningInteractionController({
      isBusy: () => this.busy,
      state: () => this.store.get().state,
      plan: () => this.plan,
      setPlan: (plan) => {
        this.plan = plan
      },
      intent: () => this.planningIntent,
      setIntent: (intent) => {
        this.planningIntent = intent
      },
      refresh: () => this.refresh(),
      audio: this.audio,
      deck: this.deck,
      drag: this.drag,
      dragGhost: this.dragGhost,
      town: this.town,
      facilityFocus: this.facilityFocus,
    })
    this.townViewport = new PlayTownViewportController(this, this.town)
    this.log = new LogDrawer(this)
    this.hud = new HudBar(this, {
      onUndo: () => {
        if (this.busy) return
        this.store.dispatch({ type: 'undo' })
        this.audio.play('cancel')
        this.clearPlan()
      },
      onLog: () => {
        this.audio.play('select')
        this.log.toggle()
      },
      onMenu: () => {
        this.audio.play('select')
        this.menu.show(this.view())
      },
    })
    this.controls = new PlanningControls(this, {
      onAuto: () => {
        if (this.busy) return
        this.plan = fromAutoAssign(autoAssign(this.store.get().state))
        this.audio.play('assign')
        this.planningIntent = { kind: 'none' }
        this.refresh()
      },
      onCommit: () => this.tryCommit(),
      onUnassignSelected: () => {
        const unitId = placementUnitId(this.planningIntent)
        if (unitId) this.planningInteraction.unassignUnit(unitId)
      },
      onToggleRation: () => {
        if (this.busy) return
        this.plan = { ...this.plan, ration: !this.plan.ration }
        this.audio.play('select')
        this.refresh()
      },
      onToggleProcure: () => {
        if (this.busy) return
        this.plan = { ...this.plan, procure: !this.plan.procure }
        this.audio.play('select')
        this.refresh()
      },
    })
    this.menu = new MenuPresentation(
      this,
      {
        onClose: () => {
          this.audio.play('cancel')
          this.menu.hide()
        },
        onBackToTitle: () => {
          this.audio.play('confirm')
          this.menu.hide()
          transitionToScene(this, KEYS.title)
        },
        onRestart: () => {
          this.menu.hide()
          if (window.confirm(CONFIRM_NEW_GAME)) {
            this.audio.play('confirm')
            this.startNewGame()
          }
        },
      },
      this.audio,
    )
    this.confirm = new CommitConfirmPresentation(this, {
      onConfirm: () => {
        this.confirm.hide()
        this.commit()
      },
      onCancel: () => {
        this.audio.play('cancel')
        this.confirm.hide()
      },
    })
    this.story = new StoryPresentations(this, {
      onConfirmBeat: () => {
        this.audio.play('confirm')
        this.playback.confirm()
      },
      onChoose: (optionId) => this.resolveChoice(optionId),
      onEndingRestart: () => {
        this.audio.play('confirm')
        this.startNewGame()
      },
      onEndingTitle: () => {
        this.audio.play('confirm')
        transitionToScene(this, KEYS.title)
      },
    })
    this.flow = new FlowPresentation(this, {
      onSkip: () => this.playback.skipFlow(),
    })
    this.playbackPresentation = new PlaybackPresentationCoordinator(this.flow, this.audio)
    this.playback.onChange = () => {
      if (!this.playback.current) this.clearPlan()
      this.refresh()
    }
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.drag.pointerMove(pointer))
    this.input.on('pointerdown', () => void this.audio.unlock())
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.drag.pointerUp(pointer))
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.handleKeyboard(event))
    this.unsubscribe = this.store.subscribe(() => {
      this.planningIntent = { kind: 'none' }
      this.inspectedUnitId = null
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
    const empty = plan.placements.length === 0 && !plan.ration && !plan.procure
    if (empty) return '（割り当てなし）'
    const parts = plan.placements.map(
      (placement) => `${TASK_LABEL[placement.task]} ×${placement.unitIds.length}`,
    )
    if (plan.ration) parts.push('節約配給')
    if (plan.procure) parts.push('備蓄を調達')
    return parts.join(' ／ ')
  }

  private commit(): void {
    this.audio.play('confirm')
    this.turns.commit(buildPlan(this.plan))
    this.refresh()
  }

  private startNewGame(): void {
    this.turns.restart(randomSeed())
    this.clearPlan()
  }

  private clearPlan(): void {
    this.plan = emptyPlan()
    this.planningIntent = { kind: 'none' }
    this.inspectedUnitId = null
    this.drag.cancel()
  }

  private resolveChoice(optionId: string): void {
    if (this.busy) return
    this.audio.play('confirm')
    this.turns.resolveChoice(optionId)
    this.refresh()
  }

  private handleKeyboard(event: KeyboardEvent): void {
    handlePlaySceneKeyboard(event, {
      isBusy: () => this.busy,
      phase: () => this.view().phase,
      clearPlanningIntent: () => {
        this.planningIntent = { kind: 'none' }
      },
      closeCharacterInspector: () => {
        this.inspectedUnitId = null
      },
      refresh: () => this.refresh(),
      commit: () => this.commit(),
      selectUnit: (unitId) => this.planningInteraction.selectUnit(unitId),
      audio: this.audio,
      menu: this.menu,
      confirm: this.confirm,
      log: this.log,
      placementStatus: this.placementStatus,
      characterInspector: this.characterInspector,
      facilityFocus: this.facilityFocus,
      hud: this.hud,
      controls: this.controls,
      deck: this.deck,
      presentation: this.presentation,
      story: this.story,
    })
  }

  private placementUnitAssigned(): boolean {
    const unitId = placementUnitId(this.planningIntent)
    return unitId ? assignedTask(this.plan, unitId) !== null : false
  }

  private layout(): void {
    this.applyLayout()
    this.refresh()
  }

  private applyLayout(): void {
    this.regions = applyPlaySceneLayout({
      game: this.game,
      gameSize: this.scale.gameSize,
      townMask: this.townMask,
      townViewport: this.townViewport,
      hud: this.hud,
      controls: this.controls,
      deck: this.deck,
      placementStatus: this.placementStatus,
      characterInspector: this.characterInspector,
      facilityFocus: this.facilityFocus,
      log: this.log,
      menu: this.menu,
      confirm: this.confirm,
      story: this.story,
      flow: this.flow,
    })
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
      planningIntent: this.planningIntent,
    })
    const facilityView = deriveFacilityView(view, this.plan)
    const ambience = deriveTownAmbience(view)
    this.audio.setMood(state.phase === 'ended' ? 'silent' : ambience.danger ? 'crisis' : 'planning')
    const storyMode = isStoryPresentation(frame.mode)
    const facilityId = focusedFacilityId(this.planningIntent)
    const unitId = placementUnitId(this.planningIntent)
    const placementUnit = this.planningInteraction.draggingUnitId ?? unitId
    const flowModel = this.playbackPresentation.update(this.playback, view)
    const planningChrome = !storyMode && flowModel === null

    this.townViewport.apply(
      this.regions.town,
      derivePlayTownViewportPreset(frame.mode, flowModel, this.planningIntent, this.plan),
    )

    if (!planningChrome && this.log.isOpen) this.log.hide()
    this.hud.setVisible(planningChrome)
    this.controls.setVisible(planningChrome)
    this.deck.setVisible(planningChrome)

    this.hud.update(view, store.history.length > 0 && !busy)
    this.controls.update(view, this.plan, busy, this.placementUnitAssigned())
    this.town.update(view, this.plan, facilityView, {
      focusedFacilityId: busy ? null : facilityId,
      placementUnitId: busy ? null : placementUnit,
    })
    this.deck.update(view, this.plan, unitId)

    if (this.inspectedUnitId && frame.mode !== 'unit-focus') this.inspectedUnitId = null
    if (this.inspectedUnitId && unitId && this.inspectedUnitId !== unitId) {
      this.inspectedUnitId = unitId
    }

    const inspectedUnit = this.inspectedUnitId
      ? view.units.find((unit) => unit.id === this.inspectedUnitId)
      : undefined
    if (this.inspectedUnitId && !inspectedUnit) this.inspectedUnitId = null
    const inspectorOpen = Boolean(inspectedUnit && frame.mode === 'unit-focus')

    const selectedUnit =
      frame.mode === 'unit-focus' ? view.units.find((unit) => unit.id === unitId) : undefined
    if (selectedUnit && !inspectorOpen) {
      const assignment = assignedTask(this.plan, selectedUnit.id) ?? '待機中'
      this.placementStatus.show(
        selectedUnit,
        assignment === '待機中' ? assignment : TASK_LABEL[assignment],
      )
    } else {
      this.placementStatus.hide()
    }

    if (inspectedUnit && inspectorOpen) {
      const assignment = assignedTask(this.plan, inspectedUnit.id) ?? '待機中'
      this.characterInspector.show(
        inspectedUnit,
        assignment === '待機中' ? assignment : TASK_LABEL[assignment],
      )
    } else {
      this.characterInspector.hide()
    }

    if (frame.mode === 'facility-focus' && facilityId) {
      this.facilityFocus.show(
        { state: view, plan: this.plan, view: facilityView },
        facilityId,
        this.planningIntent.kind === 'choose-unit-for-facility',
      )
    } else {
      this.facilityFocus.hide()
    }

    this.log.update(view.report)
    this.story.update(frame.mode, state, beat)
  }
}
