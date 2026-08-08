import type { GameState } from '../../game/types'
import { findEvent } from '../../game/events'
import type { AudioDirector } from '../audio/audio-director'
import { audioCueForFlow } from '../audio/audio-cues'
import { COLORS } from '../tokens'
import type { FacilityId } from '../town/layout'
import { deriveFlowPresentation, type FlowPresentationModel } from './flow-model'
import { FlowPresentation, flowAccent } from './flow-presentation'
import type { PlaybackController } from './playback'
import { TownPlaybackFx } from './town-playback-fx'

export class PlaybackPresentationCoordinator {
  private lastBeatKey: string | null = null

  constructor(
    private readonly flow: FlowPresentation,
    private readonly townFx: TownPlaybackFx,
    private readonly audio: AudioDirector,
  ) {}

  update(
    playback: PlaybackController,
    state: GameState,
    fallbackFacility: FacilityId | null,
  ): FlowPresentationModel | null {
    const current = playback.current
    const beat = playback.beat
    const model = beat?.kind === 'flow' ? deriveFlowPresentation(beat, state) : null
    this.flow.update(
      model,
      current?.index ?? 0,
      current?.beats.length ?? 0,
      current?.reduced ?? false,
    )
    this.townFx.setFocus(
      model?.facility ?? fallbackFacility,
      model ? flowAccent(model.tone) : COLORS.cyan,
    )

    const beatKey = current && beat ? `${current.base.day}:${current.index}:${beat.kind}` : null
    if (current && beat && beatKey !== this.lastBeatKey) {
      if (beat.kind === 'flow' && model) {
        this.townFx.play(model.fx, flowAccent(model.tone), model.importance)
        this.audio.play(audioCueForFlow(model))
      } else if (beat.kind === 'arrival') {
        this.townFx.playArrival()
        this.audio.play('arrival')
      } else if (beat.kind === 'event') {
        const tone = findEvent(beat.id)?.tone
        this.audio.play(tone === 'threat' ? 'threat' : tone === 'boon' ? 'boon' : 'normal-result')
      }
    }
    this.lastBeatKey = beatKey
    return model
  }
}
