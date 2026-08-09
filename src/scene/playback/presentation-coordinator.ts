import type { GameState } from '../../game/types'
import { findEvent } from '../../game/events'
import type { AudioDirector } from '../audio/audio-director'
import { audioCueForFlow } from '../audio/audio-cues'
import { deriveFlowPresentation, type FlowPresentationModel } from './flow-model'
import { FlowPresentation } from './flow-presentation'
import type { PlaybackController } from './playback'

export class PlaybackPresentationCoordinator {
  private lastBeatKey: string | null = null

  constructor(
    private readonly flow: FlowPresentation,
    private readonly audio: AudioDirector,
  ) {}

  update(playback: PlaybackController, state: GameState): FlowPresentationModel | null {
    const current = playback.current
    const beat = playback.beat
    const model = beat?.kind === 'flow' ? deriveFlowPresentation(beat, state) : null
    this.flow.update(
      model,
      current?.index ?? 0,
      current?.beats.length ?? 0,
      current?.reduced ?? false,
    )

    const beatKey = current && beat ? `${current.base.day}:${current.index}:${beat.kind}` : null
    if (current && beat && beatKey !== this.lastBeatKey) {
      if (beat.kind === 'flow' && model) {
        this.audio.play(audioCueForFlow(model))
      } else if (beat.kind === 'arrival') {
        this.audio.play('arrival')
      } else if (beat.kind === 'death') {
        this.audio.play('death')
      } else if (beat.kind === 'event') {
        const tone = findEvent(beat.id)?.tone
        this.audio.play(tone === 'threat' ? 'threat' : tone === 'boon' ? 'boon' : 'normal-result')
      }
    }
    this.lastBeatKey = beatKey
    return model
  }
}
