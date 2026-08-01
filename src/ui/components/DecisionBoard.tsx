import { useState } from 'react'
import type { DayPlan, GameState, TaskId } from '../../game/types'
import { autoAssign, resolvePlacement, taskCost } from '../../game/actions'
import { PixelArt } from '../art/PixelArt'
import { PixelButton } from './PixelButton'
import { UnitCard } from './UnitCard'
import { UnitDetails } from './UnitDetails'
import { useTokenDnD, type DragSlot } from '../hooks/useTokenDnD'

const PHYSICAL_TASKS: TaskId[] = [
  'repair_power',
  'restore_road',
  'reinforce_medical',
  'soup_kitchen',
]

const TASK_ACCENT: Record<TaskId, string> = {
  repair_power: 'var(--cyan)',
  restore_road: 'var(--amber)',
  reinforce_medical: 'var(--green)',
  soup_kitchen: 'var(--gold)',
  ration: 'var(--amber)',
}

const TARGET_LABEL: Record<string, string> = {
  food: '食料',
  power: '電力',
  medical: '医療',
  morale: '士気',
  budget: '予算',
  stockpile: '備蓄',
}

type Placements = Partial<Record<TaskId, string[]>>

interface DecisionBoardProps {
  state: GameState
  busy?: boolean
  onCommit: (plan: DayPlan) => void
}

export function DecisionBoard({ state, busy = false, onCommit }: DecisionBoardProps) {
  const [placements, setPlacements] = useState<Placements>({})
  const [ration, setRation] = useState(false)
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null)
  const [detailsUnitId, setDetailsUnitId] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const ended = state.phase === 'ended'

  const assignedIds = new Set(PHYSICAL_TASKS.flatMap((t) => placements[t] ?? []))
  const unassigned = state.units.filter((u) => !assignedIds.has(u.id))
  const remaining = unassigned.length

  const spent = PHYSICAL_TASKS.reduce(
    (acc, t) => {
      if ((placements[t] ?? []).length > 0) {
        const c = taskCost(t)
        acc.budget += c.budget
        acc.stockpile += c.stockpile
      }
      return acc
    },
    { budget: 0, stockpile: 0 },
  )

  const affordable = (task: TaskId): boolean => {
    if ((placements[task] ?? []).length > 0) return true
    const c = taskCost(task)
    return (
      state.budget - spent.budget >= c.budget && state.stockpile - spent.stockpile >= c.stockpile
    )
  }

  const trySetPlacements = (next: Placements): boolean => {
    let b = 0
    let s = 0
    for (const t of PHYSICAL_TASKS) {
      if ((next[t] ?? []).length > 0) {
        const c = taskCost(t)
        b += c.budget
        s += c.stockpile
      }
    }
    if (b > state.budget || s > state.stockpile) return false
    setPlacements(next)
    return true
  }

  const moveUnitTo = (id: string, task: TaskId): boolean => {
    const next: Placements = {}
    for (const t of PHYSICAL_TASKS) next[t] = (placements[t] ?? []).filter((u) => u !== id)
    next[task] = [...(next[task] ?? []), id]
    return trySetPlacements(next)
  }

  const removeUnit = (id: string) => {
    const next: Placements = {}
    for (const t of PHYSICAL_TASKS) next[t] = (placements[t] ?? []).filter((u) => u !== id)
    setPlacements(next)
  }

  const placeSelected = (task: TaskId) => {
    if (!selectedUnit) return
    const ok = moveUnitTo(selectedUnit, task)
    if (ok) setSelectedUnit(null)
  }

  const selectUnit = (id: string) => setSelectedUnit((cur) => (cur === id ? null : id))

  const autoFill = () => {
    const plan = autoAssign(state)
    const next: Placements = {}
    for (const p of plan.placements) next[p.task] = p.unitIds
    setPlacements(next)
    setRation(false)
    setSelectedUnit(null)
  }

  const reset = () => {
    setPlacements({})
    setRation(false)
    setSelectedUnit(null)
  }

  const buildPlan = (): DayPlan => ({
    placements: PHYSICAL_TASKS.filter((t) => (placements[t] ?? []).length > 0).map((t) => ({
      task: t,
      unitIds: placements[t] ?? [],
    })),
    ration,
  })

  const commit = () => {
    if (remaining > 0) {
      setConfirmOpen(true)
      return
    }
    onCommit(buildPlan())
  }

  const handleMove = (from: DragSlot, to: DragSlot) => {
    if (ended || busy) return
    if (!from.startsWith('unit:')) return
    const id = from.slice('unit:'.length)
    if (to === 'roster') removeUnit(id)
    else moveUnitTo(id, to as TaskId)
  }

  const { drag, startDrag } = useTokenDnD({ onMove: handleMove })

  const detailsUnit = detailsUnitId
    ? (state.units.find((u) => u.id === detailsUnitId) ?? null)
    : null

  const planSummary = () => {
    const plan = buildPlan()
    if (plan.placements.length === 0 && !plan.ration) return '（割り当てなし）'
    const parts = plan.placements.map(
      (p) => `${PHYSICAL_TASKS.includes(p.task) ? taskLabel(p.task) : p.task} ×${p.unitIds.length}`,
    )
    if (plan.ration) parts.push('配給を絞る')
    return parts.join(' ／ ')
  }

  return (
    <div className={['board', busy ? 'board--busy' : ''].filter(Boolean).join(' ')}>
      <ul className="board__tasks">
        {PHYSICAL_TASKS.map((task) => {
          const unitIds = placements[task] ?? []
          const units = unitIds
            .map((id) => state.units.find((u) => u.id === id))
            .filter((u): u is NonNullable<typeof u> => u !== undefined)
          const fx = unitIds.length > 0 ? resolvePlacement(state, { task, unitIds }) : []
          const fxText = fx
            .map(
              (e) => `${TARGET_LABEL[e.target] ?? e.target} ${e.delta >= 0 ? '+' : ''}${e.delta}`,
            )
            .join(' · ')
          const slotClasses = [
            'taskslot',
            drag?.over === task ? 'taskslot--over' : '',
            selectedUnit ? 'taskslot--placeable' : '',
            !affordable(task) ? 'taskslot--unaffordable' : '',
          ]
            .filter(Boolean)
            .join(' ')
          const cost = taskCost(task)
          const isAffordable = affordable(task)
          const costText =
            cost.budget > 0
              ? `予算 ${cost.budget}`
              : cost.stockpile > 0
                ? `備蓄 ${cost.stockpile}`
                : 'コストなし'
          return (
            <li
              key={task}
              className={slotClasses}
              style={{ borderLeftColor: TASK_ACCENT[task] }}
              data-slot={task}
              tabIndex={0}
              role="group"
              aria-label={taskLabel(task)}
              onClick={() => placeSelected(task)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  placeSelected(task)
                }
              }}
            >
              <div className="taskslot__head">
                <PixelArt kind="icon" id={task} size="sm" />
                <div className="taskslot__meta">
                  <div className="taskslot__name">{taskLabel(task)}</div>
                  <div
                    className={
                      isAffordable ? 'taskslot__cost' : 'taskslot__cost taskslot__cost--lack'
                    }
                  >
                    {costText}
                    {isAffordable ? '' : '（不足）'}
                  </div>
                </div>
                <div className="taskslot__fx">{unitIds.length > 0 ? fxText : '人員を配置 →'}</div>
              </div>
              <div className="taskslot__units">
                {units.map((u) => (
                  <UnitCard
                    key={u.id}
                    unit={u}
                    compact
                    onDetails={() => setDetailsUnitId(u.id)}
                    onClick={() => removeUnit(u.id)}
                    onPointerDown={startDrag(`unit:${u.id}`)}
                  />
                ))}
                {units.length === 0 ? (
                  <span className="taskslot__empty">選択中の人員をクリックで配置</span>
                ) : null}
              </div>
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
        <span>配給を絞る（食料温存・士気減）: {ration ? '実施中' : 'OFF'}</span>
      </button>

      <div className="board__roster" data-slot="roster">
        <span className="board__roster-label">待機中の人員（{unassigned.length}）</span>
        <div className="board__roster-units">
          {unassigned.map((u) => (
            <UnitCard
              key={u.id}
              unit={u}
              compact
              selected={selectedUnit === u.id}
              onClick={() => selectUnit(u.id)}
              onDetails={() => setDetailsUnitId(u.id)}
              onPointerDown={startDrag(`unit:${u.id}`)}
            />
          ))}
          {unassigned.length === 0 ? (
            <span className="board__roster-empty">全員配置済み</span>
          ) : null}
        </div>
      </div>

      <div className="board__actions">
        <PixelButton onClick={autoFill} disabled={ended || busy}>
          おまかせ配置
        </PixelButton>
        <PixelButton onClick={reset} disabled={ended || busy}>
          リセット
        </PixelButton>
        <PixelButton primary onClick={commit} disabled={ended || busy}>
          作戦を開始する
        </PixelButton>
        {remaining > 0 ? <span className="board__idle">{remaining}人 未配置</span> : null}
      </div>

      {drag ? (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          人
        </div>
      ) : null}

      <UnitDetails unit={detailsUnit} onClose={() => setDetailsUnitId(null)} />

      {confirmOpen ? (
        <div className="confirm-overlay" role="dialog" aria-modal="true">
          <div className="confirm-overlay__card">
            <h3 className="confirm-overlay__title">{remaining}人の人員が未配置です</h3>
            <p className="confirm-overlay__note">未配置の人員はこの日、何も生み出しません。</p>
            <p className="confirm-overlay__plan">{planSummary()}</p>
            <div className="confirm-overlay__actions">
              <PixelButton
                primary
                onClick={() => {
                  setConfirmOpen(false)
                  onCommit(buildPlan())
                }}
              >
                このまま開始
              </PixelButton>
              <PixelButton onClick={() => setConfirmOpen(false)}>戻って調整</PixelButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function taskLabel(task: TaskId): string {
  const labels: Record<TaskId, string> = {
    repair_power: '発電所の修理',
    restore_road: '道路復旧',
    reinforce_medical: '医療班増員',
    soup_kitchen: '炊き出し',
    ration: '配給を絞る',
  }
  return labels[task]
}
