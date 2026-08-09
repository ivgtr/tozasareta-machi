import type { AudioDirector } from '../audio/audio-director'
import type { CharacterDeck } from '../character/character-deck'
import type { PlacementStatus } from '../planning/placement-status'
import type { MenuPresentation } from '../global/menu-presentation'
import type { HudBar } from '../hud'
import { gameShortcutOf, type GameShortcut } from './keyboard'
import type { LogDrawer } from '../log-drawer'
import type { CommitConfirmPresentation } from '../planning/commit-confirm-presentation'
import type { FacilityFocus } from '../planning/facility-focus'
import type { PlanningControls } from '../planning/planning-controls'
import type { PresentationDirector } from '../presentation'
import { isStoryPresentation } from '../story/story-presentations'
import type { StoryPresentations } from '../story/story-presentations'

export interface PlaySceneShortcutContext {
  isBusy: () => boolean
  phase: () => string
  clearPlanningIntent: () => void
  refresh: () => void
  commit: () => void
  selectUnit: (unitId: string) => void
  audio: AudioDirector
  menu: MenuPresentation
  confirm: CommitConfirmPresentation
  log: LogDrawer
  placementStatus: PlacementStatus
  facilityFocus: FacilityFocus
  hud: HudBar
  controls: PlanningControls
  deck: CharacterDeck
  presentation: PresentationDirector
  story: StoryPresentations
}

export function handlePlaySceneKeyboard(event: KeyboardEvent, ctx: PlaySceneShortcutContext): void {
  const shortcut = gameShortcutOf(event)
  if (!shortcut) return
  event.preventDefault()
  void ctx.audio.unlock()

  if (shortcut === 'escape') return handleEscape(ctx)
  if (shortcut === 'menu') return handleMenuShortcut(ctx)
  if (shortcut === 'activate') return handleActivateShortcut(ctx)
  if (shortcut === 'previous' || shortcut === 'next') {
    return handleDirectionalShortcut(shortcut, ctx)
  }
  if (shortcut === 'log') {
    const canToggleLog =
      !ctx.isBusy() &&
      !ctx.menu.isOpen &&
      !ctx.confirm.isOpen &&
      ctx.phase() === 'planning' &&
      !isStoryPresentation(ctx.presentation.mode)
    if (!canToggleLog || !ctx.hud.triggerLogFromKeyboard()) ctx.audio.play('invalid')
    return
  }
  if (!planningInputAvailable(ctx)) {
    ctx.audio.play('invalid')
    return
  }
  const handled =
    shortcut === 'auto-assign'
      ? ctx.controls.triggerAutoFromKeyboard()
      : shortcut === 'commit'
        ? ctx.controls.triggerCommitFromKeyboard()
        : false
  if (!handled) ctx.audio.play('invalid')
}

function handleEscape(ctx: PlaySceneShortcutContext): void {
  if (ctx.menu.isOpen) {
    ctx.audio.play('cancel')
    ctx.menu.hide()
    return
  }
  if (ctx.confirm.isOpen) {
    ctx.audio.play('cancel')
    ctx.confirm.hide()
    return
  }
  if (ctx.log.isOpen) {
    ctx.audio.play('cancel')
    ctx.log.hide()
    return
  }
  if (ctx.placementStatus.isOpen || ctx.facilityFocus.isOpen) {
    ctx.audio.play('cancel')
    ctx.clearPlanningIntent()
    ctx.refresh()
    return
  }
  if (ctx.deck.keyboardFocus) {
    ctx.audio.play('cancel')
    ctx.deck.clearKeyboardFocus()
  }
}

function handleMenuShortcut(ctx: PlaySceneShortcutContext): void {
  if (ctx.menu.isOpen) {
    ctx.audio.play('cancel')
    ctx.menu.hide()
    return
  }
  if (ctx.isBusy() || ctx.confirm.isOpen || ctx.phase() === 'ended') {
    ctx.audio.play('invalid')
    return
  }
  ctx.log.hide()
  if (!ctx.hud.triggerMenuFromKeyboard()) ctx.audio.play('invalid')
}

function handleActivateShortcut(ctx: PlaySceneShortcutContext): void {
  if (ctx.menu.isOpen) {
    ctx.audio.play('invalid')
    return
  }
  if (ctx.confirm.isOpen) {
    ctx.confirm.hide()
    ctx.commit()
    return
  }
  if (ctx.presentation.mode === 'event' || ctx.presentation.mode === 'arrival') {
    ctx.story.confirmBeat()
    return
  }
  if (ctx.presentation.mode === 'choice') {
    if (!ctx.story.confirmChoiceSelection()) ctx.audio.play('invalid')
    return
  }
  if (!planningInputAvailable(ctx)) {
    ctx.audio.play('invalid')
    return
  }
  const unitId = ctx.deck.activateKeyboardFocus()
  if (unitId) ctx.selectUnit(unitId)
  else ctx.audio.play('invalid')
}

function handleDirectionalShortcut(
  shortcut: Extract<GameShortcut, 'previous' | 'next'>,
  ctx: PlaySceneShortcutContext,
): void {
  const delta = shortcut === 'previous' ? -1 : 1
  if (ctx.presentation.mode === 'choice') {
    const optionId = ctx.story.moveChoiceSelection(delta)
    ctx.audio.play(optionId ? 'select' : 'invalid')
    return
  }
  if (!planningInputAvailable(ctx)) {
    ctx.audio.play('invalid')
    return
  }
  ctx.clearPlanningIntent()
  const unitId = ctx.deck.moveKeyboardFocus(delta)
  ctx.audio.play(unitId ? 'select' : 'invalid')
  ctx.refresh()
}

function planningInputAvailable(ctx: PlaySceneShortcutContext): boolean {
  return (
    !ctx.isBusy() &&
    !ctx.menu.isOpen &&
    !ctx.confirm.isOpen &&
    !ctx.log.isOpen &&
    ctx.phase() === 'planning' &&
    !isStoryPresentation(ctx.presentation.mode)
  )
}
