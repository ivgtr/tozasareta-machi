import Phaser from 'phaser'
import { BALANCE } from '../../game/data/balance'
import { APTITUDE_LABEL } from '../../game/data/units'
import { TRAITS } from '../../game/traits'
import type { Aptitude, Unit } from '../../game/types'
import type { DeviceClass } from '../layout'
import type { Rect } from '../regions'
import { COLORS, TEXT_SIZE, colorCss } from '../tokens'
import { drawArtSlot } from '../ui/art-slot'
import { PixelButton } from '../ui/button'
import { pixelText } from '../ui/pixel-text'

const APTITUDES: Aptitude[] = ['labor', 'tech', 'medical', 'charm']
const APTITUDE_COLOR: Record<Aptitude, number> = {
  labor: COLORS.amber,
  tech: COLORS.cyan,
  medical: COLORS.green,
  charm: COLORS.gold,
}

function wrapByCharacters(text: string, maxChars: number): string {
  const characters = Array.from(text)
  const lines: string[] = []
  for (let index = 0; index < characters.length; index += maxChars) {
    lines.push(characters.slice(index, index + maxChars).join(''))
  }
  return lines.join('\n')
}

export interface CharacterInspectorCallbacks {
  onClose: () => void
}

export class CharacterInspector extends Phaser.GameObjects.Container {
  private readonly blocker: Phaser.GameObjects.Rectangle
  private readonly frame: Phaser.GameObjects.Graphics
  private readonly content: Phaser.GameObjects.Container
  private readonly closeButton: PixelButton
  private deviceClass: DeviceClass = 'narrow'
  private panelWidth = 0
  private panelHeight = 0
  private openFlag = false

  constructor(scene: Phaser.Scene, callbacks: CharacterInspectorCallbacks) {
    super(scene)
    this.blocker = scene.add.rectangle(0, 0, 1, 1, COLORS.night900, 0.001).setOrigin(0)
    this.blocker.setInteractive()
    this.frame = scene.add.graphics()
    this.content = scene.add.container()
    this.closeButton = new PixelButton(scene, {
      label: '閉じる',
      width: 84,
      height: 44,
      fontSize: TEXT_SIZE.labelWide,
      onAction: callbacks.onClose,
    })
    this.add([this.blocker, this.frame, this.content, this.closeButton])
    this.setDepth(720)
    this.setVisible(false)
    scene.add.existing(this)
  }

  setBounds(town: Rect, deviceClass: DeviceClass): void {
    this.deviceClass = deviceClass
    if (deviceClass === 'wide') {
      this.panelWidth = Math.min(440, Math.max(360, town.width * 0.36))
      this.panelHeight = Math.min(430, Math.max(370, town.height - 32))
      this.setPosition(town.x + 16, town.y + Math.max(16, (town.height - this.panelHeight) / 2))
    } else {
      this.panelWidth = Math.max(320, town.width - 24)
      this.panelHeight = Math.min(390, Math.max(340, town.height * 0.6))
      this.setPosition(town.x + (town.width - this.panelWidth) / 2, town.y + 12)
    }
    this.blocker.setPosition(town.x - this.x, town.y - this.y).setSize(town.width, town.height)
    this.closeButton.setPosition(this.panelWidth - 54, 30)
    this.redrawFrame()
  }

  show(unit: Unit, assignmentLabel: string): void {
    this.openFlag = true
    this.setVisible(true)
    this.render(unit, assignmentLabel)
  }

  hide(): void {
    this.openFlag = false
    this.setVisible(false)
  }

  get isOpen(): boolean {
    return this.openFlag
  }

  private redrawFrame(): void {
    const g = this.frame
    const w = this.panelWidth
    const h = this.panelHeight
    g.clear()
    g.fillStyle(0x000000, 0.45)
    g.fillRect(6, 6, w, h)
    g.fillStyle(COLORS.night900, 0.97)
    g.fillRect(0, 0, w, h)
    g.lineStyle(2, COLORS.frameHi)
    g.strokeRect(1, 1, w - 2, h - 2)
    g.lineStyle(2, COLORS.frameLo)
    g.strokeRect(5, 5, w - 10, h - 10)
    g.fillStyle(COLORS.amber)
    g.fillRect(6, 6, 6, h - 12)
  }

  private render(unit: Unit, assignmentLabel: string): void {
    this.content.removeAll(true)
    if (this.deviceClass === 'wide') this.renderWide(unit, assignmentLabel)
    else this.renderNarrow(unit, assignmentLabel)
  }

  private renderWide(unit: Unit, assignmentLabel: string): void {
    const portraitWidth = 156
    const portraitHeight = 208
    drawArtSlot(
      this.scene,
      this.content,
      'portrait',
      unit.portrait,
      24 + portraitWidth / 2,
      58 + portraitHeight / 2,
      {
        width: portraitWidth,
        height: portraitHeight,
        glyphSize: 72,
        fallbackGlyph: '人',
      },
    )
    const infoX = 204
    this.addIdentity(unit, assignmentLabel, infoX, 58, this.panelWidth - infoX - 18)
    this.addAptitudes(unit, infoX, 154, this.panelWidth - infoX - 22, 18)
    this.addNarrative(unit, 24, 284, this.panelWidth - 48, this.panelHeight - 306)
  }

  private renderNarrow(unit: Unit, assignmentLabel: string): void {
    const portraitWidth = 118
    const portraitHeight = 158
    drawArtSlot(
      this.scene,
      this.content,
      'portrait',
      unit.portrait,
      20 + portraitWidth / 2,
      54 + portraitHeight / 2,
      {
        width: portraitWidth,
        height: portraitHeight,
        glyphSize: 56,
        fallbackGlyph: '人',
      },
    )
    const infoX = 156
    this.addIdentity(unit, assignmentLabel, infoX, 54, this.panelWidth - infoX - 16)
    this.addAptitudes(unit, infoX, 148, this.panelWidth - infoX - 22, 15)
    this.addNarrative(unit, 20, 248, this.panelWidth - 40, this.panelHeight - 268)
  }

  private addIdentity(
    unit: Unit,
    assignmentLabel: string,
    x: number,
    y: number,
    wrapWidth: number,
  ): void {
    const name = pixelText(this.scene, unit.name, {
      fontSize: this.deviceClass === 'wide' ? 24 : TEXT_SIZE.heading,
      color: COLORS.gold,
      wordWrapWidth: wrapWidth,
    }).setPosition(x, y)
    const alias = pixelText(this.scene, unit.alias || (unit.unique ? '町の中核メンバー' : '住民'), {
      fontSize: this.deviceClass === 'wide' ? TEXT_SIZE.bodyWide : TEXT_SIZE.bodyNarrow,
      color: COLORS.inkDim,
      wordWrapWidth: wrapWidth,
    }).setPosition(x, y + 32)
    const condition = pixelText(
      this.scene,
      unit.condition === 'injured' ? '● 負傷中・効果半減' : '● 健康',
      {
        fontSize: this.deviceClass === 'wide' ? TEXT_SIZE.labelWide : TEXT_SIZE.labelNarrow,
        color: unit.condition === 'injured' ? COLORS.red : COLORS.green,
      },
    ).setPosition(x, y + 56)
    const assignment = pixelText(this.scene, `配置: ${assignmentLabel}`, {
      fontSize: this.deviceClass === 'wide' ? TEXT_SIZE.labelWide : TEXT_SIZE.labelNarrow,
      color: COLORS.amber,
      wordWrapWidth: wrapWidth,
    }).setPosition(x, y + 78)
    this.content.add([name, alias, condition, assignment])
  }

  private addAptitudes(unit: Unit, x: number, y: number, width: number, barHeight: number): void {
    const barWidth = Math.max(54, width - 48)
    APTITUDES.forEach((aptitude, index) => {
      const rowY = y + index * (barHeight + 8)
      const label = pixelText(this.scene, APTITUDE_LABEL[aptitude].slice(0, 1), {
        fontSize: this.deviceClass === 'wide' ? TEXT_SIZE.labelWide : TEXT_SIZE.labelNarrow,
        color: APTITUDE_COLOR[aptitude],
      }).setPosition(x, rowY)
      const bar = this.scene.add.graphics()
      bar.fillStyle(COLORS.night700)
      bar.fillRect(x + 24, rowY + 2, barWidth, barHeight - 4)
      bar.fillStyle(APTITUDE_COLOR[aptitude])
      bar.fillRect(
        x + 24,
        rowY + 2,
        (barWidth * Math.min(10, Math.max(0, unit.apt[aptitude]))) / 10,
        barHeight - 4,
      )
      const value = pixelText(this.scene, String(unit.apt[aptitude]), {
        fontSize: this.deviceClass === 'wide' ? TEXT_SIZE.labelWide : TEXT_SIZE.labelNarrow,
        color: COLORS.ink,
      }).setPosition(x + 28 + barWidth, rowY)
      this.content.add([label, bar, value])
    })
  }

  private addNarrative(
    unit: Unit,
    x: number,
    y: number,
    wrapWidth: number,
    availableHeight: number,
  ): void {
    const maxChars = this.deviceClass === 'wide' ? 28 : 32
    const traitText =
      unit.traits.length > 0
        ? unit.traits
            .slice(0, 2)
            .map((trait) =>
              wrapByCharacters(`${TRAITS[trait].name}: ${TRAITS[trait].desc}`, maxChars),
            )
            .join('\n')
        : '特性なし'
    const traits = pixelText(this.scene, traitText, {
      fontSize: this.deviceClass === 'wide' ? TEXT_SIZE.labelWide : TEXT_SIZE.labelNarrow,
      color: unit.traits.some((trait) => !TRAITS[trait].positive) ? COLORS.red : COLORS.ink,
      wordWrapWidth: wrapWidth,
    }).setPosition(x, y)
    this.content.add(traits)

    if (unit.flavor && availableHeight >= 40) {
      const flavor = pixelText(this.scene, wrapByCharacters(`「${unit.flavor}」`, maxChars), {
        fontSize: this.deviceClass === 'wide' ? TEXT_SIZE.labelWide : TEXT_SIZE.labelNarrow,
        color: COLORS.inkDim,
        wordWrapWidth: wrapWidth,
      }).setPosition(x, y + Math.min(48, traits.height + 10))
      this.content.add(flavor)
    }

    const growth = pixelText(this.scene, `成長 ${unit.xp}/${BALANCE.unit.growthThreshold}`, {
      fontSize: TEXT_SIZE.labelNarrow,
      color: COLORS.inkDim,
      backgroundColor: colorCss(COLORS.night700),
    }).setPosition(x, Math.min(this.panelHeight - 34, y + Math.max(44, availableHeight - 20)))
    this.content.add(growth)
  }
}
