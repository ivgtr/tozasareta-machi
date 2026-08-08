import type { FlowPresentationModel } from '../playback/flow-model'

export const AUDIO_CUES = [
  'select',
  'confirm',
  'cancel',
  'assign',
  'unassign',
  'invalid',
  'minor-result',
  'normal-result',
  'major-result',
  'threat',
  'boon',
  'arrival',
  'facility',
  'warning',
] as const

export type AudioCue = (typeof AUDIO_CUES)[number]
export type AudioWave = OscillatorType

export interface AudioNote {
  frequency: number
  delayMs: number
  durationMs: number
  gain: number
  wave: AudioWave
}

const note = (
  frequency: number,
  durationMs: number,
  gain: number,
  delayMs = 0,
  wave: AudioWave = 'square',
): AudioNote => ({ frequency, delayMs, durationMs, gain, wave })

export const AUDIO_CUE_NOTES: Record<AudioCue, readonly AudioNote[]> = {
  select: [note(660, 42, 0.035)],
  confirm: [note(523, 55, 0.05), note(784, 85, 0.045, 52)],
  cancel: [note(440, 55, 0.04), note(294, 90, 0.035, 48)],
  assign: [note(392, 45, 0.04), note(587, 75, 0.045, 40)],
  unassign: [note(587, 45, 0.04), note(392, 75, 0.035, 40)],
  invalid: [note(147, 70, 0.055, 0, 'sawtooth'), note(123, 90, 0.045, 62, 'sawtooth')],
  'minor-result': [note(330, 55, 0.025, 0, 'triangle')],
  'normal-result': [note(392, 70, 0.035), note(494, 90, 0.035, 68)],
  'major-result': [
    note(196, 150, 0.05, 0, 'triangle'),
    note(392, 180, 0.05, 120, 'square'),
    note(587, 240, 0.045, 260, 'square'),
  ],
  threat: [note(165, 140, 0.055, 0, 'sawtooth'), note(156, 180, 0.05, 110, 'sawtooth')],
  boon: [note(523, 80, 0.04), note(659, 90, 0.04, 75), note(784, 150, 0.04, 160)],
  arrival: [note(294, 90, 0.04), note(440, 110, 0.045, 82), note(587, 180, 0.04, 184)],
  facility: [note(220, 45, 0.035, 0, 'triangle'), note(440, 60, 0.03, 35)],
  warning: [note(220, 90, 0.055), note(220, 90, 0.055, 145)],
}

export function audioCueForFlow(model: FlowPresentationModel): AudioCue {
  if (model.importance === 'minor') return 'minor-result'
  if (model.importance === 'major') {
    if (model.tone === 'negative') return 'threat'
    if (model.tone === 'positive') return 'boon'
    return 'major-result'
  }
  if (model.fx.kind !== 'float' && model.fx.kind !== 'weather') return 'facility'
  return 'normal-result'
}
