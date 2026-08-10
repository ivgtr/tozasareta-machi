import { findEvent } from '../../game/events'
import type { EventDef, GameState, Unit } from '../../game/types'

export interface StoryPresentationModel {
  event: EventDef
  speaker: Unit | null
}

const STORY_SPEAKERS: Record<string, string> = {
  elderly_illness: 'medic',
  generator_failure: 'engineer',
  hidden_stockpile: 'farmer',
  foraging: 'farmer',
  power_restored: 'engineer',
  medical_donation: 'medic',
  volunteers: 'mayor',
  ration_protest: 'mayor',
  infection: 'medic',
  protest: 'mayor',
  water_shortage: 'farmer',
  theft: 'mayor',
  radio_repair: 'engineer',
  childbirth: 'medic',
  elder_death: 'mayor',
  gratitude: 'mayor',
  trade_offer: 'mayor',
  power_crisis: 'engineer',
  stockpile_crisis: 'farmer',
  expedition: 'mayor',
}

export function deriveStoryPresentation(
  eventId: string,
  state: Pick<GameState, 'units'>,
): StoryPresentationModel | null {
  const event = findEvent(eventId)
  if (!event) return null
  const speakerId = STORY_SPEAKERS[event.id]
  return {
    event,
    speaker: speakerId
      ? (state.units.find((candidate) => candidate.id === speakerId) ?? null)
      : null,
  }
}
