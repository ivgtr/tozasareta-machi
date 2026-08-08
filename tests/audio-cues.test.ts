import { describe, expect, it } from 'vitest'
import { AUDIO_CUES, AUDIO_CUE_NOTES, audioCueForFlow } from '../src/scene/audio/audio-cues'
import type { FlowPresentationModel } from '../src/scene/playback/flow-model'

function flow(
  importance: FlowPresentationModel['importance'],
  tone: FlowPresentationModel['tone'],
  kind: FlowPresentationModel['fx']['kind'] = 'float',
): FlowPresentationModel {
  return {
    title: '',
    kicker: '',
    summary: '',
    actors: [],
    primaryActor: null,
    facility: null,
    fx: { facility: null, kind },
    tone,
    deltas: [],
    importance,
  }
}

describe('audio cues', () => {
  it('すべての意味カテゴリに再生可能な音列を定義する', () => {
    expect(Object.keys(AUDIO_CUE_NOTES).sort()).toEqual([...AUDIO_CUES].sort())
    for (const cue of AUDIO_CUES) {
      expect(AUDIO_CUE_NOTES[cue].length).toBeGreaterThan(0)
      expect(AUDIO_CUE_NOTES[cue].every((note) => note.durationMs > 0 && note.gain > 0)).toBe(true)
    }
  })

  it('Playbackの重要度・トーン・施設演出を意味カテゴリへ投影する', () => {
    expect(audioCueForFlow(flow('minor', 'negative'))).toBe('minor-result')
    expect(audioCueForFlow(flow('normal', 'neutral', 'work'))).toBe('facility')
    expect(audioCueForFlow(flow('normal', 'neutral'))).toBe('normal-result')
    expect(audioCueForFlow(flow('major', 'negative'))).toBe('threat')
    expect(audioCueForFlow(flow('major', 'positive'))).toBe('boon')
    expect(audioCueForFlow(flow('major', 'neutral'))).toBe('major-result')
  })
})
