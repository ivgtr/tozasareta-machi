import Phaser from 'phaser'
import { audioDirectorFor, type AudioDirector } from '../audio/audio-director'
import { fadeInScene, transitionToScene } from '../global/scene-transition'
import { KEYS, SCENE_EVENTS } from '../keys'
import { deviceClassOf } from '../layout'
import {
  advanceStoryMilestone,
  createStoryMilestoneSession,
  storyMilestoneView,
  type StoryMilestoneId,
  type StoryMilestoneSession,
} from '../story/milestone-model'
import { MilestonePresentation } from '../story/milestone-presentation'
import { setPageMode } from '../page-shell'
import { COLORS } from '../tokens'

export interface StorySceneData {
  milestone: StoryMilestoneId
  nextScene: string
}

export class StoryScene extends Phaser.Scene {
  private launch: StorySceneData = { milestone: 'prologue', nextScene: KEYS.play }
  private session!: StoryMilestoneSession
  private presentation!: MilestonePresentation
  private audio!: AudioDirector
  private transitioning = false

  constructor() {
    super(KEYS.story)
  }

  init(data: StorySceneData): void {
    this.launch = data
  }

  create(): void {
    setPageMode('game')
    this.transitioning = false
    this.session = createStoryMilestoneSession(this.launch.milestone)
    this.audio = audioDirectorFor(this.game)
    this.audio.setMood('silent')
    void this.audio.unlock()
    this.cameras.main.setBackgroundColor(COLORS.night900)

    this.presentation = new MilestonePresentation(this, {
      onConfirm: () => this.advance(),
    })
    this.input.keyboard?.on('keydown-ENTER', (event: KeyboardEvent) => {
      if (event.repeat || this.transitioning) return
      event.preventDefault()
      this.advance()
    })
    this.game.events.on(SCENE_EVENTS.deviceClass, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(SCENE_EVENTS.deviceClass, this.layout, this)
    })

    this.layout()
    fadeInScene(this)
    if (this.shouldAutoCompleteForE2E()) this.finish()
  }

  private advance(): void {
    if (this.transitioning) return
    this.audio.play('confirm')
    const next = advanceStoryMilestone(this.session)
    if (!next) {
      this.finish()
      return
    }
    this.session = next
    this.render()
  }

  private finish(): void {
    if (this.transitioning) return
    this.transitioning = true
    transitionToScene(this, this.launch.nextScene)
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize
    this.presentation.setViewport(width, height, deviceClassOf(window.innerWidth))
    this.render()
  }

  private render(): void {
    this.presentation.show(storyMilestoneView(this.session))
  }

  private shouldAutoCompleteForE2E(): boolean {
    if (!import.meta.env.DEV) return false
    const params = new URLSearchParams(window.location.search)
    return params.get('e2e') === '1' && params.get('story') !== 'hold'
  }
}
