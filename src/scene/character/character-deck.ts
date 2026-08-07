import Phaser from 'phaser'
import type { Aptitude, GameState, Unit } from '../../game/types'
import { APTITUDE_LABEL } from '../../game/data/units'
import { expeditionUnits, unassignedUnits, type PlanState } from '../plan'
import type { DeviceClass } from '../layout'
import { drawArtSlot } from '../ui/art-slot'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'
import { COLORS, TEXT_SIZE, colorCss } from '../tokens'
import { unitVisualState } from '../unit-visual'

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
    unit: Unit,
    width: number,
    height: number,
    selected: boolean,
    away: boolean,
    deviceClass: DeviceClass,
    onPointerDown: CharacterDeckCallbacks['onCharacterPointerDown'],
  ) {
    super(scene)
    this.unitId = unit.id
    const visual = unitVisualState(unit)
    const border = selected
      ? COLORS.gold
      : unit.condition === 'injured'
        ? COLORS.red
        : unit.unique
          ? COLORS.amber
          : COLORS.frameLo
    const bg = scene.add.graphics()
    bg.fillStyle(COLORS.night900, away ? 0.72 : 0.94)
    bg.fillRect(0, 0, width, height)
    bg.lineStyle(selected ? 3 : 2, border, away ? 0.6 : 1)
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
    name.setPosition(width / 2, height - 28)
    this.add(name)

    const badgeLabel = `${APTITUDE_LABEL[visual.topAptitude].slice(0, 1)}${unit.apt[visual.topAptitude]}`
    const badge = pixelText(scene, away ? '探索' : badgeLabel, {
      fontSize: TEXT_SIZE.labelNarrow,
      color: COLORS.night900,
      backgroundColor: colorCss(away ? COLORS.cyan : APT_COLOR[visual.topAptitude]),
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

    this.setSize(width, height)
    this.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, width, height),
      Phaser.Geom.Rectangle.Contains,
    )
    if (away) {
      this.disableInteractive()
      this.setAlpha(0.7)
    } else {
      this.on(
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
  private lastUnits: Unit[] = []
  private lastSelectedUnitId: string | null = null

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
    this.lastUnits = [...unassignedUnits(state, plan), ...expeditionUnits(state)]
    this.lastSelectedUnitId = selectedUnitId
    this.clampPage()
    this.render()
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
    if (this.lastUnits.length <= withoutNav) return { capacity: withoutNav, hasNav: false }
    return { capacity: this.capacity(true), hasNav: true }
  }

  private maxPage(): number {
    const { capacity } = this.paging()
    return Math.max(0, Math.ceil(this.lastUnits.length / capacity) - 1)
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
    const units = this.lastUnits.slice(start, start + capacity)
    const cardW = CARD_WIDTH[this.deviceClass]
    const cardH = this.deckHeight - EDGE * 2
    const xStart = hasNav ? NAV_WIDTH : EDGE
    const available = this.deckWidth - xStart - (hasNav ? NAV_WIDTH : EDGE)
    const totalW = units.length * cardW + Math.max(0, units.length - 1) * GAP
    const offset = Math.max(0, (available - totalW) / 2)
    const awayIds = new Set(this.lastUnits.filter((unit) => unit.expedition).map((unit) => unit.id))

    units.forEach((unit, index) => {
      const card = new CharacterCard(
        this.scene,
        unit,
        cardW,
        cardH,
        this.lastSelectedUnitId === unit.id,
        awayIds.has(unit.id),
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
