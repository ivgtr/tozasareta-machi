import { useState, type KeyboardEvent } from 'react'
import type { Assignment, DayPlan, GameState, TaskId } from '../../game/types'
import { preview, resolveAssignment } from '../../game/actions'
import { BALANCE } from '../../game/data/balance'
import { artSpec } from '../art/manifest'
import { PixelArt } from '../art/PixelArt'
import { PixelButton } from './PixelButton'
import { WorkerToken } from './WorkerToken'
import { useTokenDnD, type DragSlot } from '../hooks/useTokenDnD'

const PHYSICAL_TASKS: TaskId[] = [
  'repair_power',
  'restore_road',
  'reinforce_medical',
  'soup_kitchen',
]

const TARGET_LABEL: Record<string, string> = {
  food: '食料',
  power: '電力',
  medical: '医療',
  morale: '士気',
  budget: '予算',
  stockpile: '備蓄',
}

function budgetCost(task: TaskId): number {
  if (task === 'repair_power') return BALANCE.tasks.repair_power.budget
  if (task === 'reinforce_medical') return BALANCE.tasks.reinforce_medical.budget
  return 0
}

function stockpileCost(task: TaskId): number {
  if (task === 'soup_kitchen') return BALANCE.tasks.soup_kitchen.stockpile
  return 0
}

function formatEffects(
  state: GameState,
  task: TaskId,
  workers: number,
  characterId?: string,
): string {
  const fx = resolveAssignment(state, { task, workers, characterId })
  return fx
    .map((e) => `${TARGET_LABEL[e.target] ?? e.target} ${e.delta >= 0 ? '+' : ''}${e.delta}`)
    .join(' · ')
}

interface DecisionBoardProps {
  state: GameState
  chars: Partial<Record<TaskId, string>>
  selectedChar: string | null
  busy?: boolean
  onCommit: (plan: DayPlan) => void
  onAssignChar: (task: TaskId) => void
  onReleaseChar: (task: TaskId) => void
}

export function DecisionBoard({
  state,
  chars,
  selectedChar,
  busy = false,
  onCommit,
  onAssignChar,
  onReleaseChar,
}: DecisionBoardProps) {
  const [workers, setWorkers] = useState<Partial<Record<TaskId, number>>>({})
  const [ration, setRation] = useState(false)
  const ended = state.phase === 'ended'

  const assignedTotal = PHYSICAL_TASKS.reduce((s, t) => s + (workers[t] ?? 0), 0)
  const remaining = state.workers - assignedTotal
  const spentBudget = PHYSICAL_TASKS.reduce(
    (s, t) => ((workers[t] ?? 0) > 0 ? s + budgetCost(t) : s),
    0,
  )
  const spentStockpile = PHYSICAL_TASKS.reduce(
    (s, t) => ((workers[t] ?? 0) > 0 ? s + stockpileCost(t) : s),
    0,
  )

  const canAdd = (task: TaskId): boolean =>
    remaining >= 1 &&
    state.budget - spentBudget >= budgetCost(task) &&
    state.stockpile - spentStockpile >= stockpileCost(task)

  const addWorker = (task: TaskId) => {
    if (!canAdd(task)) return
    setWorkers((w) => ({ ...w, [task]: (w[task] ?? 0) + 1 }))
  }

  const removeWorker = (task: TaskId) => {
    setWorkers((w) => {
      const next = Math.max(0, (w[task] ?? 0) - 1)
      if (next === 0) onReleaseChar(task)
      return { ...w, [task]: next }
    })
  }

  const handleMove = (from: DragSlot, to: DragSlot) => {
    if (from === to || ended) return
    if (to === 'pool') {
      if (from !== 'pool') removeWorker(from as TaskId)
      return
    }
    const target = to as TaskId
    if (from === 'pool') {
      addWorker(target)
      return
    }
    const source = from as TaskId
    if ((workers[source] ?? 0) <= 0) return
    const budgetRoom = state.budget - spentBudget + budgetCost(source)
    const stockRoom = state.stockpile - spentStockpile + stockpileCost(source)
    if (budgetRoom < budgetCost(target) || stockRoom < stockpileCost(target)) return
    setWorkers((w) => ({
      ...w,
      [source]: Math.max(0, (w[source] ?? 0) - 1),
      [target]: (w[target] ?? 0) + 1,
    }))
  }

  const { drag, startDrag } = useTokenDnD({ onMove: handleMove })

  const buildPlan = (): DayPlan => {
    const assignments: Assignment[] = PHYSICAL_TASKS.filter((t) => (workers[t] ?? 0) > 0).map(
      (t) => ({
        task: t,
        workers: workers[t] ?? 0,
        characterId: chars[t],
      }),
    )
    if (ration) assignments.push({ task: 'ration', workers: 0 })
    return { assignments }
  }

  const commit = () => onCommit(buildPlan())

  const onSlotKeyDown = (task: TaskId) => (e: KeyboardEvent<HTMLLIElement>) => {
    if (e.key === 'Enter' || e.key === '+' || e.key === '=') {
      e.preventDefault()
      addWorker(task)
    } else if (e.key === '-' || e.key === 'Backspace') {
      e.preventDefault()
      removeWorker(task)
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const slots = Array.from(document.querySelectorAll<HTMLElement>('[data-slot]'))
      const idx = slots.indexOf(e.currentTarget)
      const dir = e.key === 'ArrowRight' ? 1 : -1
      slots[(idx + dir + slots.length) % slots.length]?.focus()
    }
  }

  const rationPreview = preview(state, { assignments: [{ task: 'ration', workers: 0 }] })
    .map((e) => `${TARGET_LABEL[e.target] ?? e.target} ${e.delta >= 0 ? '+' : ''}${e.delta}`)
    .join(' · ')

  const charName = (task: TaskId): string | null => {
    const id = chars[task]
    if (!id) return null
    return state.characters.find((c) => c.id === id)?.name ?? null
  }

  return (
    <div className={['board', busy ? 'board--busy' : ''].filter(Boolean).join(' ')}>
      <ul className="board__tasks">
        {PHYSICAL_TASKS.map((task) => {
          const w = workers[task] ?? 0
          const slotClasses = [
            'taskslot',
            drag?.over === task ? 'taskslot--over' : '',
            drag?.from === task ? 'taskslot--dragging' : '',
            !canAdd(task) && w === 0 ? 'taskslot--locked' : '',
          ]
            .filter(Boolean)
            .join(' ')
          const cost =
            budgetCost(task) > 0
              ? `予算 ${budgetCost(task)}`
              : stockpileCost(task) > 0
                ? `備蓄 ${stockpileCost(task)}`
                : 'コストなし'
          return (
            <li
              key={task}
              className={slotClasses}
              data-slot={task}
              tabIndex={0}
              role="group"
              aria-label={artSpec('icon', task)?.label ?? task}
              onClick={() => addWorker(task)}
              onKeyDown={onSlotKeyDown(task)}
            >
              <PixelArt kind="icon" id={task} size="md" />
              <div className="taskslot__body">
                <div className="taskslot__name">{artSpec('icon', task)?.label}</div>
                <div className="taskslot__cost">{cost}</div>
                <div className="taskslot__fx">
                  {formatEffects(state, task, Math.max(1, w), chars[task])}
                </div>
              </div>
              <div className="taskslot__tokens">
                {Array.from({ length: w }, (_, i) => (
                  <span
                    key={i}
                    className="taskslot__token"
                    onPointerDown={startDrag(task)}
                    onClick={(e) => {
                      e.stopPropagation()
                      removeWorker(task)
                    }}
                  >
                    <WorkerToken />
                  </span>
                ))}
                {w === 0 ? <span className="taskslot__hint">クリック / ドラッグで配置</span> : null}
              </div>
              <button
                type="button"
                className={['taskslot__char', charName(task) ? 'taskslot__char--set' : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={(e) => {
                  e.stopPropagation()
                  if (charName(task)) onReleaseChar(task)
                  else onAssignChar(task)
                }}
              >
                人員: {charName(task) ?? (selectedChar ? 'この人物を配置' : '—')}
              </button>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        className={['ration-toggle', ration ? 'ration-toggle--on' : ''].filter(Boolean).join(' ')}
        onClick={() => setRation((r) => !r)}
      >
        <PixelArt kind="icon" id="ration" size="sm" />
        <span>配給を絞る: {ration ? '実施中' : ' OFF'}</span>
        <span className="taskslot__fx">{rationPreview}</span>
      </button>

      <div
        className={['pool', drag?.over === 'pool' ? 'pool--over' : ''].filter(Boolean).join(' ')}
        data-slot="pool"
      >
        <span className="pool__label">作業員プール</span>
        <div className="pool__tokens">
          {Array.from({ length: remaining }, (_, i) => (
            <span key={i} className="pool__token" onPointerDown={startDrag('pool')}>
              <WorkerToken />
            </span>
          ))}
          {remaining === 0 ? <span className="pool__empty">空きなし</span> : null}
        </div>
        <span className="pool__summary">
          利用 {state.workers} / 配置 {assignedTotal}
        </span>
      </div>

      <PixelButton primary className="board__commit" disabled={ended || busy} onClick={commit}>
        作戦を開始する
      </PixelButton>

      {drag ? (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          <WorkerToken />
        </div>
      ) : null}
    </div>
  )
}
