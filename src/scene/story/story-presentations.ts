import Phaser from 'phaser'
import type { GameState } from '../../game/types'
import type { DeviceClass } from '../layout'
import type { Beat } from '../playback/beats'
import type { PresentationMode } from '../presentation'
import { ArrivalPresentation } from './arrival-presentation'
import { ChoicePresentation } from './choice-presentation'
import { DeathPresentation } from './death-presentation'
import { EndingPresentation } from './ending-presentation'
import { EventPresentation } from './event-presentation'

export interface StoryPresentationCallbacks {
  onConfirmBeat: () => void
  onChoose: (optionId: string) => void
  onEndingRestart: () => void
  onEndingTitle: () => void
}

export class StoryPresentations {
  private readonly event: EventPresentation
  private readonly choice: ChoicePresentation
  private readonly arrival: ArrivalPresentation
  private readonly death: DeathPresentation
  private readonly ending: EndingPresentation
  private readonly callbacks: StoryPresentationCallbacks

  constructor(scene: Phaser.Scene, callbacks: StoryPresentationCallbacks) {
    this.callbacks = callbacks
    this.event = new EventPresentation(scene, { onConfirm: callbacks.onConfirmBeat })
    this.choice = new ChoicePresentation(scene, { onChoose: callbacks.onChoose })
    this.arrival = new ArrivalPresentation(scene, { onConfirm: callbacks.onConfirmBeat })
    this.death = new DeathPresentation(scene, { onConfirm: callbacks.onConfirmBeat })
    this.ending = new EndingPresentation(scene, {
      onRestart: callbacks.onEndingRestart,
      onTitle: callbacks.onEndingTitle,
    })
  }

  setViewport(width: number, height: number, deviceClass: DeviceClass): void {
    this.event.setViewport(width, height, deviceClass)
    this.choice.setViewport(width, height, deviceClass)
    this.arrival.setViewport(width, height, deviceClass)
    this.death.setViewport(width, height, deviceClass)
    this.ending.setViewport(width, height, deviceClass)
  }

  update(mode: PresentationMode, state: GameState, beat: Beat | undefined): void {
    this.hideAll()
    if (mode === 'event' && beat?.kind === 'death') {
      this.death.show(beat)
      return
    }
    if (mode === 'event' && beat?.kind === 'event') {
      this.event.show(state, beat)
      return
    }
    if (mode === 'arrival' && beat?.kind === 'arrival') {
      this.arrival.show(state, beat)
      return
    }
    if (mode === 'choice') {
      this.choice.show(state)
      return
    }
    if (mode === 'ending') this.ending.show(state)
  }

  hideAll(): void {
    this.event.hide()
    this.choice.hide()
    this.arrival.hide()
    this.death.hide()
    this.ending.hide()
  }

  moveChoiceSelection(delta: -1 | 1): string | null {
    return this.choice.moveKeyboardSelection(delta)
  }

  confirmChoiceSelection(): boolean {
    return this.choice.confirmKeyboardSelection()
  }

  confirmBeat(): void {
    this.callbacks.onConfirmBeat()
  }
}

export function isStoryPresentation(mode: PresentationMode): boolean {
  return mode === 'event' || mode === 'choice' || mode === 'arrival' || mode === 'ending'
}
