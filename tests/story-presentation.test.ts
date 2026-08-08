import { describe, expect, it } from 'vitest'
import { findEvent } from '../src/game/events'
import { createInitialState } from '../src/game/state'
import { deriveStoryPresentation, storyPresentationSpec } from '../src/scene/story/story-metadata'

describe('story presentation metadata', () => {
  it('人物が関わるイベントを在籍ユニットへ解決する', () => {
    const model = deriveStoryPresentation('generator_failure', createInitialState(1))

    expect(model?.spec).toEqual({
      speaker: 'engineer',
      layout: 'report',
      portraitSide: 'left',
    })
    expect(model?.speaker?.id).toBe('engineer')
  })

  it('speakerが不在なら人物なしの正式レイアウトへフォールバックする', () => {
    const state = createInitialState(1)
    const model = deriveStoryPresentation('infection', {
      units: state.units.filter((unit) => unit.id !== 'medic'),
    })

    expect(model?.spec.layout).toBe('report')
    expect(model?.speaker).toBeNull()
  })

  it('災害イベントはincident、人物のいない吉報はreportを既定値にする', () => {
    const typhoon = findEvent('typhoon')!
    const clearWeather = findEvent('clear_weather')!

    expect(storyPresentationSpec(typhoon)).toEqual({ layout: 'incident' })
    expect(storyPresentationSpec(clearWeather)).toEqual({ layout: 'report' })
  })

  it('EventとChoiceが同じmetadata resolverを利用する', () => {
    const state = createInitialState(1)

    expect(deriveStoryPresentation('trade_offer', state)?.speaker?.id).toBe('mayor')
    expect(deriveStoryPresentation('power_crisis', state)?.speaker?.id).toBe('engineer')
  })
})
