import type { GameState } from '../../game/types'
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
      } else if (beat.kind === 'arrival') {
        this.townFx.playArrival()
      }
    }
    this.lastBeatKey = beatKey
    return model
  }
}
