import Phaser from 'phaser'
import type { Aptitude, GameState, Unit } from '../game/types'
import { BALANCE } from '../game/data/balance'
import { TRAITS } from '../game/traits'
import { APTITUDE_LABEL } from '../game/data/units'
import { resolvePlacement, taskCost } from '../game/actions'
import { isTaskDisabled } from '../game/modifiers'
import { COLORS, PANEL_CONTENT_INSET, SPACING, TEXT_SIZE } from './tokens'
import { FACILITIES, type FacilityViewId } from './town/facilities'
import type { FacilityId } from './town/layout'
import { formatDelta } from './labels'
import { type PlanState } from './plan'
import { PixelButton } from './ui/button'
import { PixelPanel } from './ui/panel'
import { ModalCard } from './ui/modal-card'
import { TextStack } from './ui/text-stack'
import { pixelText } from './ui/pixel-text'
import { drawArtSlot } from './ui/art-slot'
import type { Rect } from './regions'

const APTS: Aptitude[] = ['labor', 'tech', 'medical', 'charm']
const APT_COLOR: Record<Aptitude, number> = {
  labor: COLORS.amber,
  tech: COLORS.cyan,
  medical: COLORS.green,
  charm: COLORS.gold,
}

const VIEW_LABEL: Record<FacilityViewId, string> = {
  normal: '通常',
  low: '出力低下',
  working: '作業中',
  collapsed: '崩落',
  restored: '復旧済み',
  damaged: '損傷',
}

export interface DetailContext {
  state: GameState
  plan: PlanState
  view: Record<FacilityId, FacilityViewId>
  selectedFacility: FacilityId | null
  selectedUnitId: string | null
}

export interface DetailCallbacks {
  onClose: () => void
  onOpenUnit: (unitId: string) => void
}

export class DetailPanel extends Phaser.GameObjects.Container {
  private readonly panel: PixelPanel
  private readonly dynamic: Phaser.GameObjects.Container
  private readonly closeButton: PixelButton
  private readonly callbacks: DetailCallbacks

  constructor(scene: Phaser.Scene, callbacks: DetailCallbacks) {
    super(scene)
    this.callbacks = callbacks
    this.panel = new PixelPanel(scene, 100, 100)
    this.dynamic = scene.add.container()
    this.closeButton = new PixelButton(scene, {
      label: '×',
      width: 44,
      height: 44,
      onAction: () => this.callbacks.onClose(),
    })
    this.add([this.panel, this.dynamic, this.closeButton])
    scene.add.existing(this)
  }

  setBounds(rect: Rect): void {
    this.setPosition(rect.x, rect.y)
    this.panel.setPanelSize(rect.width, rect.height)
    this.closeButton.setPosition(rect.width - SPACING.lg, SPACING.lg)
  }

  update(ctx: DetailContext): void {
    const d = this.dynamic
    d.removeAll(true)
    const inset = PANEL_CONTENT_INSET
    const wrapW = Math.max(80, this.panel.panelWidth - inset * 2)
    let y = inset
    const put = (text: Phaser.GameObjects.Text, x: number, yy?: number): void => {
      text.setPosition(x, yy ?? y)
      d.add(text)
    }
    if (ctx.selectedUnitId) {
      const unit = ctx.state.units.find((u) => u.id === ctx.selectedUnitId)
      if (unit) {
        this.addPortrait(d, inset, y + 24, unit)
        put(
          pixelText(this.scene, `${unit.name}${unit.alias ? `（${unit.alias}）` : ''}`, {
            fontSize: TEXT_SIZE.heading,
            color: COLORS.gold,
            wordWrapWidth: wrapW - 64,
          }),
          inset + 64,
          y + 8,
        )
        put(
          pixelText(this.scene, unit.condition === 'injured' ? '負傷中（効果半減）' : '健康', {
            fontSize: TEXT_SIZE.bodyWide,
            color: unit.condition === 'injured' ? COLORS.red : COLORS.green,
          }),
          inset + 64,
          y + 34,
        )
        const apts = pixelText(
          this.scene,
          APTS.map((a) => `${APTITUDE_LABEL[a].slice(0, 1)}${unit.apt[a]}`).join(' '),
          { fontSize: TEXT_SIZE.bodyWide, color: COLORS.ink, wordWrapWidth: wrapW - 64 },
        )
        put(apts, inset + 64, y + 58)
        const details = new PixelButton(this.scene, {
          label: '詳細',
          width: 88,
          height: 36,
          onAction: () => this.callbacks.onOpenUnit(unit.id),
        })
        details.setPosition(inset + 64 + 60, y + 92)
        d.add(details)
        put(
          pixelText(this.scene, '配置先: 町の施設をタップして配置', {
            fontSize: TEXT_SIZE.labelWide,
            color: COLORS.inkDim,
          }),
          inset + 260,
          y + 34,
        )
        return
      }
    }
    if (ctx.selectedFacility) {
      const meta = FACILITIES[ctx.selectedFacility]
      const viewId = ctx.view[ctx.selectedFacility]
      put(
        pixelText(this.scene, `${meta.glyph} ${meta.label} — ${VIEW_LABEL[viewId]}`, {
          fontSize: TEXT_SIZE.heading,
          color: meta.color,
          wordWrapWidth: wrapW,
        }),
        inset,
      )
      y += 34
      if (meta.tasks.length === 0) {
        const note =
          ctx.selectedFacility === 'warehouse'
            ? `配給・調達は計画ストリップで切替 / 備蓄 ${ctx.state.stockpile}`
            : '指揮の拠点。人員の配置はできない。'
        put(
          pixelText(this.scene, note, {
            fontSize: TEXT_SIZE.bodyWide,
            color: COLORS.inkDim,
            wordWrapWidth: wrapW,
          }),
          inset,
          y,
        )
        return
      }
      for (const task of meta.tasks) {
        const cost = taskCost(task)
        const disabled = isTaskDisabled(ctx.state.modifiers, task)
        const unitIds = ctx.plan.placements[task] ?? []
        const fx = unitIds.length > 0 ? resolvePlacement(ctx.state, { task, unitIds }) : []
        const line = [
          `${unitIds.length}人配置`,
          cost.budget > 0 ? `予算${cost.budget}` : '',
          disabled ? '配置不可' : '',
          fx.map((e) => formatDelta(e.target, e.delta)).join('・'),
        ]
          .filter(Boolean)
          .join(' / ')
        put(
          pixelText(this.scene, line, {
            fontSize: TEXT_SIZE.bodyWide,
            color: disabled ? COLORS.red : COLORS.ink,
            wordWrapWidth: wrapW,
          }),
          inset,
          y,
        )
        y += 26
      }
      return
    }
    put(
      pixelText(this.scene, '施設または人員を選択すると詳細を表示する', {
        fontSize: TEXT_SIZE.bodyWide,
        color: COLORS.inkDim,
        wordWrapWidth: wrapW,
      }),
      inset,
    )
  }

  private addPortrait(host: Phaser.GameObjects.Container, x: number, y: number, unit: Unit): void {
    drawArtSlot(this.scene, host, 'portrait', unit.portrait, x + 24, y, {
      width: 48,
      height: 64,
      glyphSize: 28,
      fallbackGlyph: '人',
    })
  }
}

export class UnitDetailsOverlay extends ModalCard {
  private readonly closeButton: PixelButton
  private visibleFlag = false

  constructor(scene: Phaser.Scene, onClose: () => void) {
    super(scene)
    this.closeButton = new PixelButton(scene, {
      label: '閉じる',
      width: 120,
      height: 40,
      onAction: onClose,
    })
  }

  show(unit: Unit): void {
    this.visibleFlag = true
    const { width, height } = this.scene.scale.gameSize
    const d = this.content
    const contentW = this.begin(width, height, 420, 420)
    const cardW = this.cardW
    const inset = this.contentInset
    const portraitY = inset + 40
    drawArtSlot(this.scene, d, 'portrait', unit.portrait, inset + 32, portraitY, {
      width: 64,
      height: 85,
      glyphSize: 40,
      fallbackGlyph: '人',
    })
    const textX = inset + 80
    const stack = new TextStack(textX, inset)
    stack.add(this.scene, d, unit.name, {
      fontSize: TEXT_SIZE.heading,
      color: COLORS.gold,
      wrapWidth: contentW - 80,
      gap: 4,
    })
    if (unit.alias) {
      stack.add(this.scene, d, `二つ名: ${unit.alias}`, {
        fontSize: TEXT_SIZE.bodyWide,
        color: COLORS.inkDim,
        wrapWidth: contentW - 80,
        gap: 4,
      })
    }
    stack.add(this.scene, d, unit.condition === 'injured' ? '負傷中（効果半減）' : '健康', {
      fontSize: TEXT_SIZE.bodyWide,
      color: unit.condition === 'injured' ? COLORS.red : COLORS.green,
    })
    stack.advance(18)
    let y = stack.bottom
    for (const a of APTS) {
      const label = pixelText(this.scene, APTITUDE_LABEL[a], {
        fontSize: TEXT_SIZE.bodyWide,
        color: APT_COLOR[a],
      })
      label.setPosition(inset, y)
      d.add(label)
      const bar = this.scene.add.graphics()
      bar.fillStyle(COLORS.night800)
      bar.fillRect(inset + 56, y, 200, 14)
      bar.fillStyle(APT_COLOR[a])
      bar.fillRect(inset + 56, y, Math.max(0, Math.min(10, unit.apt[a])) * 20, 14)
      d.add(bar)
      const num = pixelText(this.scene, String(unit.apt[a]), { fontSize: TEXT_SIZE.bodyWide })
      num.setPosition(inset + 264, y)
      d.add(num)
      y += 24
    }
    const body = new TextStack(inset, y + 8)
    if (unit.traits.length === 0) {
      body.add(this.scene, d, '特性なし', {
        fontSize: TEXT_SIZE.bodyWide,
        color: COLORS.inkDim,
      })
    } else {
      for (const t of unit.traits) {
        body.add(this.scene, d, `${TRAITS[t].name} — ${TRAITS[t].desc}`, {
          fontSize: TEXT_SIZE.labelWide,
          color: TRAITS[t].positive ? COLORS.ink : COLORS.red,
          wrapWidth: contentW,
        })
      }
    }
    if (unit.flavor) {
      body.add(this.scene, d, unit.flavor, {
        fontSize: TEXT_SIZE.labelWide,
        color: COLORS.inkDim,
        wrapWidth: contentW,
      })
    }
    body.add(this.scene, d, `成長 ${unit.xp}/${BALANCE.unit.growthThreshold}`, {
      fontSize: TEXT_SIZE.labelWide,
      color: COLORS.inkDim,
    })
    this.finish(height, body.bottom, 60)
    this.closeButton.setPosition(cardW / 2, this.cardH - 34)
    d.add(this.closeButton)
    this.showCard()
  }

  hide(): void {
    this.visibleFlag = false
    this.hideCard()
  }

  get isOpen(): boolean {
    return this.visibleFlag
  }
}
