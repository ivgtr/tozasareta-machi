import Phaser from 'phaser'
import type { Aptitude, GameState } from '../../game/types'
import { APTITUDE_LABEL } from '../../game/data/units'
import type { PlanState } from '../plan'
import type { DeviceClass } from '../layout'
import { TASK_LABEL } from '../task-presentation'
import { drawArtSlot } from '../ui/art-slot'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'
import { COLORS, TEXT_SIZE, colorCss } from '../tokens'
import { unitVisualState } from '../unit-visual'
import { deriveCharacterRoster, type RosterEntry, type RosterStatus } from './roster'

export interface CharacterDeckCallbacks {
  onCharacterPointerDown: (unitId: string, worldX: number, worldY: number) => void
}

const GAP = 8
const EDGE = 8
const NAV_WIDTH = 44
const CARD_WIDTH = { wide: 104, narrow: 96 } as const
const CARD_PORTRAIT = {
  wide: { width: 56, height: 72 },
  narrow: { width: 52, height: 68 },
} as const

const APT_COLOR: Record<Aptitude, number> = {
  labor: COLORS.amber,
  tech: COLORS.cyan,
  medical: COLORS.green,
  charm: COLORS.gold,
}

class CharacterCard extends Phaser.GameObjects.Container {
  readonly unitId: string

  constructor(
    scene: Phaser.Scene,
    entry: RosterEntry,
    width: number,
    height: number,
    selected: boolean,
    focused: boolean,
    deviceClass: DeviceClass,
    onPointerDown: CharacterDeckCallbacks['onCharacterPointerDown'],
  ) {
    super(scene)
    const { unit, status } = entry
    this.unitId = unit.id
    const away = status.kind === 'expedition'
    const visual = unitVisualState(unit)
    const border = selected
      ? COLORS.gold
      : focused
        ? COLORS.cyan
        : unit.condition === 'injured'
          ? COLORS.red
          : unit.unique
            ? COLORS.amber
            : COLORS.frameLo
    const bg = scene.add.graphics()
    bg.fillStyle(COLORS.night900, away ? 0.72 : 0.94)
    bg.fillRect(0, 0, width, height)
    bg.lineStyle(selected || focused ? 3 : 2, border, away ? 0.6 : 1)
    bg.strokeRect(1, 1, width - 2, height - 2)
    if (unit.unique) {
      bg.fillStyle(COLORS.amber, away ? 0.5 : 1)
      bg.fillRect(4, 4, 18, 3)
    }
    this.add(bg)

    const portrait = CARD_PORTRAIT[deviceClass]
    drawArtSlot(scene, this, 'portrait', unit.portrait, width / 2, 8 + portrait.height / 2, {
      width: portrait.width,
      height: portrait.height,
      glyphSize: 30,
      fallbackGlyph: '人',
    })

    const name = pixelText(scene, unit.name, {
      fontSize: deviceClass === 'wide' ? TEXT_SIZE.labelWide : TEXT_SIZE.labelNarrow,
      color: away ? COLORS.inkDim : COLORS.ink,
      wordWrapWidth: width - 10,
      align: 'center',
    })
    name.setOrigin(0.5, 0)
    name.setPosition(width / 2, height - 32)
    this.add(name)

    const badgeLabel = `${APTITUDE_LABEL[visual.topAptitude].slice(0, 1)}${unit.apt[visual.topAptitude]}`
    const badge = pixelText(scene, badgeLabel, {
      fontSize: TEXT_SIZE.labelNarrow,
      color: COLORS.night900,
      backgroundColor: colorCss(APT_COLOR[visual.topAptitude]),
    })
    badge.setOrigin(1, 0)
    badge.setPosition(width - 4, 4)
    this.add(badge)

    if (unit.condition === 'injured') {
      const injured = pixelText(scene, '負傷', {
        fontSize: TEXT_SIZE.labelNarrow,
        color: COLORS.night900,
        backgroundColor: colorCss(COLORS.red),
      })
      injured.setPosition(4, 4)
      this.add(injured)
    }

    const statusBadge = pixelText(scene, statusLabel(status), {
      fontSize: TEXT_SIZE.labelNarrow,
      color: COLORS.night900,
      backgroundColor: colorCss(
        status.kind === 'assigned'
          ? COLORS.green
          : status.kind === 'expedition'
            ? COLORS.cyan
            : COLORS.inkDim,
      ),
    })
    statusBadge.setOrigin(0.5, 0)
    statusBadge.setPosition(width / 2, height - 15)
    this.add(statusBadge)

    this.setSize(width, height)
    const hitTarget = scene.add.zone(width / 2, height / 2, width, height)
    this.add(hitTarget)
    if (away) {
      this.setAlpha(0.7)
    } else {
      hitTarget.setInteractive()
      hitTarget.on(
        'pointerdown',
        (
          pointer: Phaser.Input.Pointer,
          _localX: number,
          _localY: number,
          event: Phaser.Types.Input.EventData,
        ) => {
          event.stopPropagation()
          onPointerDown(unit.id, pointer.worldX, pointer.worldY)
        },
      )
    }
    scene.add.existing(this)
  }
}

function statusLabel(status: RosterStatus): string {
  if (status.kind === 'expedition') return '探索中'
  if (status.kind === 'assigned') return `配置 ${TASK_LABEL[status.task]}`
  return '待機'
}

export class CharacterDeck extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics
  private readonly content: Phaser.GameObjects.Container
  private readonly prevButton: PixelButton
  private readonly nextButton: PixelButton
  private readonly callbacks: CharacterDeckCallbacks
  private deckWidth = 0
  private deckHeight = 0
  private deviceClass: DeviceClass = 'narrow'
  private page = 0
  private lastEntries: RosterEntry[] = []
  private lastSelectedUnitId: string | null = null
  private keyboardFocusedUnitId: string | null = null

  constructor(scene: Phaser.Scene, callbacks: CharacterDeckCallbacks) {
    super(scene)
    this.callbacks = callbacks
    this.bg = scene.add.graphics()
    this.content = scene.add.container()
    this.prevButton = new PixelButton(scene, {
      label: '‹',
      width: 36,
      height: 44,
      onAction: () => this.movePage(-1),
    })
    this.nextButton = new PixelButton(scene, {
      label: '›',
      width: 36,
      height: 44,
      onAction: () => this.movePage(1),
    })
    this.add([this.bg, this.content, this.prevButton, this.nextButton])
    scene.add.existing(this)
  }

  setBounds(x: number, y: number, width: number, height: number, deviceClass: DeviceClass): void {
    this.setPosition(x, y)
    this.deckWidth = width
    this.deckHeight = height
    this.deviceClass = deviceClass
    this.redraw()
    this.render()
  }

  containsWorld(worldX: number, worldY: number): boolean {
    const point = this.getLocalPoint(worldX, worldY)
    return point.x >= 0 && point.x <= this.deckWidth && point.y >= 0 && point.y <= this.deckHeight
  }

  update(state: GameState, plan: PlanState, selectedUnitId: string | null): void {
    this.lastEntries = deriveCharacterRoster(state, plan)
    this.lastSelectedUnitId = selectedUnitId
    if (!this.lastEntries.some((entry) => entry.unit.id === this.keyboardFocusedUnitId)) {
      this.keyboardFocusedUnitId = null
    }
    this.clampPage()
    this.render()
  }

  moveKeyboardFocus(delta: -1 | 1): string | null {
    const eligible = this.lastEntries.filter((entry) => entry.status.kind !== 'expedition')
    if (eligible.length === 0) return null
    const current = eligible.findIndex((entry) => entry.unit.id === this.keyboardFocusedUnitId)
    const next = current < 0 ? (delta > 0 ? 0 : eligible.length - 1) : current + delta
    const entry = eligible[Phaser.Math.Wrap(next, 0, eligible.length)]
    if (!entry) return null
    this.keyboardFocusedUnitId = entry.unit.id
    const rosterIndex = this.lastEntries.findIndex(
      (candidate) => candidate.unit.id === entry.unit.id,
    )
    const { capacity } = this.paging()
    this.page = Math.floor(rosterIndex / capacity)
    this.render()
    return entry.unit.id
  }

  activateKeyboardFocus(): string | null {
    return this.keyboardFocusedUnitId
  }

  clearKeyboardFocus(): void {
    if (!this.keyboardFocusedUnitId) return
    this.keyboardFocusedUnitId = null
    this.render()
  }

  get keyboardFocus(): string | null {
    return this.keyboardFocusedUnitId
  }

  private redraw(): void {
    const g = this.bg
    g.clear()
    g.fillStyle(COLORS.night800, 0.94)
    g.fillRect(0, 0, this.deckWidth, this.deckHeight)
    g.lineStyle(2, COLORS.frameLo)
    g.strokeRect(1, 1, this.deckWidth - 2, this.deckHeight - 2)
    g.fillStyle(COLORS.amber, 0.85)
    g.fillRect(2, 2, Math.min(112, this.deckWidth - 4), 3)
  }

  private capacity(reserveNav: boolean): number {
    const cardW = CARD_WIDTH[this.deviceClass]
    const available = Math.max(cardW, this.deckWidth - EDGE * 2 - (reserveNav ? NAV_WIDTH * 2 : 0))
    return Math.max(1, Math.floor((available + GAP) / (cardW + GAP)))
  }

  private paging(): { capacity: number; hasNav: boolean } {
    const withoutNav = this.capacity(false)
    if (this.lastEntries.length <= withoutNav) return { capacity: withoutNav, hasNav: false }
    return { capacity: this.capacity(true), hasNav: true }
  }

  private maxPage(): number {
    const { capacity } = this.paging()
    return Math.max(0, Math.ceil(this.lastEntries.length / capacity) - 1)
  }

  private clampPage(): void {
    this.page = Math.min(this.page, this.maxPage())
  }

  private movePage(delta: number): void {
    const next = Phaser.Math.Clamp(this.page + delta, 0, this.maxPage())
    if (next === this.page) return
    this.page = next
    this.render()
  }

  private render(): void {
    if (this.deckWidth <= 0 || this.deckHeight <= 0) return
    this.content.removeAll(true)
    const { capacity, hasNav } = this.paging()
    const maxPage = this.maxPage()
    this.page = Math.min(this.page, maxPage)
    const start = this.page * capacity
    const entries = this.lastEntries.slice(start, start + capacity)
    const cardW = CARD_WIDTH[this.deviceClass]
    const cardH = this.deckHeight - EDGE * 2
    const xStart = hasNav ? NAV_WIDTH : EDGE
    const available = this.deckWidth - xStart - (hasNav ? NAV_WIDTH : EDGE)
    const totalW = entries.length * cardW + Math.max(0, entries.length - 1) * GAP
    const offset = Math.max(0, (available - totalW) / 2)

    entries.forEach((entry, index) => {
      const card = new CharacterCard(
        this.scene,
        entry,
        cardW,
        cardH,
        this.lastSelectedUnitId === entry.unit.id,
        this.keyboardFocusedUnitId === entry.unit.id,
        this.deviceClass,
        this.callbacks.onCharacterPointerDown,
      )
      card.setPosition(xStart + offset + index * (cardW + GAP), EDGE)
      this.content.add(card)
    })

    this.prevButton.setVisible(hasNav)
    this.nextButton.setVisible(hasNav)
    if (hasNav) {
      this.prevButton.setPosition(NAV_WIDTH / 2, this.deckHeight / 2)
      this.nextButton.setPosition(this.deckWidth - NAV_WIDTH / 2, this.deckHeight / 2)
      this.prevButton.setEnabled(this.page !== 0)
      this.nextButton.setEnabled(this.page !== maxPage)
    }
  }
}
