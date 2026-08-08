export const GAME_SHORTCUTS = [
  'escape',
  'commit',
  'auto-assign',
  'log',
  'menu',
  'previous',
  'next',
  'activate',
] as const

export type GameShortcut = (typeof GAME_SHORTCUTS)[number]

const SHORTCUT_BY_CODE: Record<string, GameShortcut> = {
  Escape: 'escape',
  Space: 'commit',
  KeyA: 'auto-assign',
  KeyL: 'log',
  KeyM: 'menu',
  ArrowLeft: 'previous',
  ArrowRight: 'next',
  Enter: 'activate',
  NumpadEnter: 'activate',
}

function editableTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined') return false
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function gameShortcutOf(event: KeyboardEvent): GameShortcut | null {
  if (event.altKey || event.ctrlKey || event.metaKey || editableTarget(event.target)) return null
  const shortcut = SHORTCUT_BY_CODE[event.code] ?? null
  if (event.repeat && shortcut !== 'previous' && shortcut !== 'next') return null
  return shortcut
}
