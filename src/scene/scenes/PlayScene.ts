import Phaser from 'phaser'
import { autoAssign } from '../../game/actions'
import { randomSeed, reducedMotion } from '../../store'
import { audioDirectorFor, type AudioDirector } from '../audio/audio-director'
import { CharacterDeck } from '../character/character-deck'
import { CharacterDragGhost } from '../character/character-drag-ghost'
import { CharacterFocus } from '../character/character-focus'
import { MenuPresentation } from '../global/menu-presentation'
import { transitionToScene } from '../global/scene-transition'
import { HudBar } from '../hud'
import { KEYS, SCENE_EVENTS } from '../keys'
import { gameShortcutOf, type GameShortcut } from '../input/keyboard'
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
import type { FlowPresentationModel } from '../playback/flow-model'
import { FlowPresentation } from '../playback/flow-presentation'
import { PlaybackController } from '../playback/playback'
import { PlaybackPresentationCoordinator } from '../playback/presentation-coordinator'
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
import { deriveTownAmbience } from '../town/ambience-model'
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
  private playbackPresentation!: PlaybackPresentationCoordinator
  private audio!: AudioDirector
  private townViewportKey: string | null = null
  private readonly playback = new PlaybackController()
  private readonly presentation = new PresentationDirector()
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
        this.audio.play('cancel')
        this.selectedUnitId = null
        this.refresh()
      },
    })
    this.facilityFocus = new FacilityFocus(this, {
      onClose: () => {
        this.audio.play('cancel')
        this.selectedFacility = null
        this.refresh()
      },
      onSelectUnit: (unitId) => {
        this.selectedFacility = null
        this.selectedUnitId = unitId
        this.refresh()
      },
      onUnassignUnit: (unitId) => {
        if (this.busy) return
        this.plan = withRemove(this.plan, unitId)
        this.audio.play('unassign')
        this.refresh()
      },
    })
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
        this.selectedUnitId = null
        this.refresh()
      },
      onCommit: () => this.tryCommit(),
      onUnassignSelected: () => {
        if (this.busy || !this.selectedUnitId) return
        this.plan = withRemove(this.plan, this.selectedUnitId)
        this.audio.play('unassign')
        this.refresh()
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
    this.playbackPresentation = new PlaybackPresentationCoordinator(
      this.flow,
      this.playbackFx,
      this.audio,
    )
    this.playback.onChange = () => {
      if (!this.playback.current) this.clearPlan()
      this.refresh()
    }
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.drag.pointerMove(pointer))
    this.input.on('pointerdown', () => void this.audio.unlock())
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.drag.pointerUp(pointer))
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.handleKeyboard(event))
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
    this.deck.clearKeyboardFocus()
    this.dragGhost.setUnit(unit)
    this.drag.pointerDown(unitId, worldX, worldY)
  }

  private selectUnit(unitId: string): void {
    if (this.busy) return
    const deselecting = this.selectedUnitId === unitId
    this.selectedUnitId = deselecting ? null : unitId
    this.audio.play(deselecting ? 'cancel' : 'select')
    this.selectedFacility = null
    this.refresh()
  }

  private onFacilityTap(id: FacilityId): void {
    if (this.busy) return
    this.deck.clearKeyboardFocus()
    const meta = FACILITIES[id]
    if (this.selectedUnitId && meta.tasks.length > 0) {
      const next = withMove(this.store.get().state, this.plan, this.selectedUnitId, meta.tasks[0]!)
      if (next) {
        this.plan = next
        this.audio.play('assign')
        this.selectedUnitId = null
        this.selectedFacility = id
      }
      this.refresh()
      return
    }
    this.selectedFacility = this.selectedFacility === id ? null : id
    this.audio.play(this.selectedFacility ? 'facility' : 'cancel')
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
        if (next) {
          this.plan = next
          this.audio.play('assign')
        } else {
          this.audio.play('invalid')
        }
        return
      }
    }
    if (this.deck.containsWorld(worldX, worldY)) {
      this.plan = withRemove(this.plan, unitId)
      this.audio.play('unassign')
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
    this.selectedUnitId = null
    this.selectedFacility = null
    this.drag.cancel()
  }

  private resolveChoice(optionId: string): void {
    if (this.busy) return
    this.audio.play('confirm')
    this.turns.resolveChoice(optionId)
    this.refresh()
  }

  private handleKeyboard(event: KeyboardEvent): void {
    const shortcut = gameShortcutOf(event)
    if (!shortcut) return
    event.preventDefault()
    void this.audio.unlock()
    if (shortcut === 'escape') {
      this.handleEscape()
      return
    }
    if (shortcut === 'menu') {
      this.handleMenuShortcut()
      return
    }
    if (shortcut === 'activate') {
      this.handleActivateShortcut()
      return
    }
    if (shortcut === 'previous' || shortcut === 'next') {
      this.handleDirectionalShortcut(shortcut)
      return
    }
    if (shortcut === 'log') {
      const canToggleLog =
        !this.busy &&
        !this.menu.isOpen &&
        !this.confirm.isOpen &&
        this.view().phase === 'planning' &&
        !isStoryPresentation(this.presentation.mode)
      if (!canToggleLog || !this.hud.triggerLogFromKeyboard()) this.audio.play('invalid')
      return
    }
    if (!this.planningInputAvailable()) {
      this.audio.play('invalid')
      return
    }
    const handled =
      shortcut === 'auto-assign'
        ? this.controls.triggerAutoFromKeyboard()
        : shortcut === 'commit'
          ? this.controls.triggerCommitFromKeyboard()
          : false
    if (!handled) this.audio.play('invalid')
  }

  private handleEscape(): void {
    if (this.menu.isOpen) {
      this.audio.play('cancel')
      this.menu.hide()
      return
    }
    if (this.confirm.isOpen) {
      this.audio.play('cancel')
      this.confirm.hide()
      return
    }
    if (this.log.isOpen) {
      this.audio.play('cancel')
      this.log.hide()
      return
    }
    if (this.characterFocus.isOpen || this.facilityFocus.isOpen) {
      this.audio.play('cancel')
      this.selectedUnitId = null
      this.selectedFacility = null
      this.refresh()
      return
    }
    if (this.deck.keyboardFocus) {
      this.audio.play('cancel')
      this.deck.clearKeyboardFocus()
    }
  }

  private handleMenuShortcut(): void {
    if (this.menu.isOpen) {
      this.audio.play('cancel')
      this.menu.hide()
      return
    }
    if (this.busy || this.confirm.isOpen || this.view().phase === 'ended') {
      this.audio.play('invalid')
      return
    }
    this.log.hide()
    if (!this.hud.triggerMenuFromKeyboard()) this.audio.play('invalid')
  }

  private handleActivateShortcut(): void {
    if (this.menu.isOpen) {
      this.audio.play('invalid')
      return
    }
    if (this.confirm.isOpen) {
      this.confirm.hide()
      this.commit()
      return
    }
    if (this.presentation.mode === 'event' || this.presentation.mode === 'arrival') {
      this.story.confirmBeat()
      return
    }
    if (this.presentation.mode === 'choice') {
      if (!this.story.confirmChoiceSelection()) this.audio.play('invalid')
      return
    }
    if (!this.planningInputAvailable()) {
      this.audio.play('invalid')
      return
    }
    const unitId = this.deck.activateKeyboardFocus()
    if (unitId) this.selectUnit(unitId)
    else this.audio.play('invalid')
  }

  private handleDirectionalShortcut(shortcut: Extract<GameShortcut, 'previous' | 'next'>): void {
    const delta = shortcut === 'previous' ? -1 : 1
    if (this.presentation.mode === 'choice') {
      const optionId = this.story.moveChoiceSelection(delta)
      this.audio.play(optionId ? 'select' : 'invalid')
      return
    }
    if (!this.planningInputAvailable()) {
      this.audio.play('invalid')
      return
    }
    this.selectedUnitId = null
    this.selectedFacility = null
    const unitId = this.deck.moveKeyboardFocus(delta)
    this.audio.play(unitId ? 'select' : 'invalid')
    this.refresh()
  }

  private planningInputAvailable(): boolean {
    return (
      !this.busy &&
      !this.menu.isOpen &&
      !this.confirm.isOpen &&
      !this.log.isOpen &&
      this.view().phase === 'planning' &&
      !isStoryPresentation(this.presentation.mode)
    )
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
    const ambience = deriveTownAmbience(view, facilityView)
    this.audio.setMood(state.phase === 'ended' ? 'silent' : ambience.danger ? 'crisis' : 'planning')
    const storyMode = isStoryPresentation(frame.mode)
    const fallbackFacility = frame.mode === 'facility-focus' ? this.selectedFacility : null
    const flowModel = this.playbackPresentation.update(this.playback, view, fallbackFacility)
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
  }
}
