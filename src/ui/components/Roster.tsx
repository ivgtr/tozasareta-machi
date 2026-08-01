import type { Character, TaskId } from '../../game/types'
import { PixelArt } from '../art/PixelArt'
import { artSpec } from '../art/manifest'

interface RosterProps {
  characters: Character[]
  chars: Partial<Record<TaskId, string>>
  selected: string | null
  onSelect: (id: string | null) => void
}

export function Roster({ characters, chars, selected, onSelect }: RosterProps) {
  const placedTask = (charId: string): string | null => {
    for (const [task, id] of Object.entries(chars)) {
      if (id === charId) return artSpec('icon', task)?.label ?? task
    }
    return null
  }

  return (
    <div className="roster">
      {characters.map((c) => {
        const placed = placedTask(c.id)
        const classes = [
          'roster__char',
          selected === c.id ? 'roster__char--selected' : '',
          placed ? 'roster__char--placed' : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <button
            key={c.id}
            type="button"
            className={classes}
            onClick={() => onSelect(selected === c.id ? null : c.id)}
          >
            <PixelArt kind="portrait" id={c.id} />
            <span className="roster__name">{c.name}</span>
            <span className="roster__skill">技 {c.skill}</span>
            <span className="roster__placed">{placed ? `→ ${placed}` : '配置先 —'}</span>
          </button>
        )
      })}
      <p className="roster__hint">人物を選ぶ → 任務の「人員」を押すと配置できます</p>
    </div>
  )
}
