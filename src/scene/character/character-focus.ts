import Phaser from 'phaser'
import type { Aptitude, Unit } from '../../game/types'
import { BALANCE } from '../../game/data/balance'
import { APTITUDE_LABEL } from '../../game/data/units'
import { TRAITS } from '../../game/traits'
import type { DeviceClass } from '../layout'
import type { Rect } from '../regions'
import { COLORS, TEXT_SIZE, colorCss } from '../tokens'
import { PixelButton } from '../ui/button'
import { drawArtSlot } from '../ui/art-slot'
import { pixelText } from '../ui/pixel-text'

const APTS: Aptitude[] = ['labor', 'tech', 'medical', 'charm']
const APT_COLOR: Record<Aptitude, number> = {
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

export interface CharacterFocusCallbacks {
  onClose: () => void
}

export class CharacterFocus extends Phaser.GameObjects.Container {
  private readonly frame: Phaser.GameObjects.Graphics
  private readonly content: Phaser.GameObjects.Container
  private readonly closeButton: PixelButton
  private deviceClass: DeviceClass = 'narrow'
  private panelWidth = 0
  private panelHeight = 0
  private openFlag = false

  constructor(scene: Phaser.Scene, callbacks: CharacterFocusCallbacks) {
    super(scene)
    this.frame = scene.add.graphics()
    this.content = scene.add.container()
    this.closeButton = new PixelButton(scene, {
      label: '閉じる',
      width: 84,
      height: 34,
      fontSize: TEXT_SIZE.labelWide,
      onAction: callbacks.onClose,
    })
    this.add([this.frame, this.content, this.closeButton])
    this.setDepth(700)
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
    this.closeButton.setPosition(this.panelWidth - 54, 26)
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
    g.fillStyle(COLORS.night900, 0.96)
    g.fillRect(0, 0, w, h)
    g.lineStyle(2, COLORS.frameHi)
    g.strokeRect(1, 1, w - 2, h - 2)
    g.lineStyle(2, COLORS.frameLo)
    g.strokeRect(5, 5, w - 10, h - 10)
    g.fillStyle(COLORS.amber)
    g.fillRect(6, 6, 6, h - 12)
  }

  private render(unit: Unit, assignmentLabel: string): void {
    const d = this.content
    d.removeAll(true)
    if (this.deviceClass === 'wide') this.renderWide(d, unit, assignmentLabel)
    else this.renderNarrow(d, unit, assignmentLabel)
  }

  private renderWide(d: Phaser.GameObjects.Container, unit: Unit, assignmentLabel: string): void {
    const portraitW = 156
    const portraitH = 208
    const portraitX = 24 + portraitW / 2
    const portraitY = 58 + portraitH / 2
    drawArtSlot(this.scene, d, 'portrait', unit.portrait, portraitX, portraitY, {
      width: portraitW,
      height: portraitH,
      glyphSize: 72,
      fallbackGlyph: '人',
    })

    const infoX = 204
    this.addIdentity(d, unit, assignmentLabel, infoX, 58, this.panelWidth - infoX - 18)
    this.addAptitudes(d, unit, infoX, 154, this.panelWidth - infoX - 22, 18)
    this.addNarrative(d, unit, 24, 284, this.panelWidth - 48, this.panelHeight - 326)

    const guide = pixelText(this.scene, '町の施設を選択して配置　／　人物をドラッグして配置', {
      fontSize: TEXT_SIZE.labelWide,
      color: COLORS.inkDim,
      wordWrapWidth: this.panelWidth - 48,
    })
    guide.setPosition(24, this.panelHeight - 34)
    d.add(guide)
  }

  private renderNarrow(d: Phaser.GameObjects.Container, unit: Unit, assignmentLabel: string): void {
    const portraitW = 118
    const portraitH = 158
    const portraitX = 20 + portraitW / 2
    const portraitY = 54 + portraitH / 2
    drawArtSlot(this.scene, d, 'portrait', unit.portrait, portraitX, portraitY, {
      width: portraitW,
      height: portraitH,
      glyphSize: 56,
      fallbackGlyph: '人',
    })

    const infoX = 156
    this.addIdentity(d, unit, assignmentLabel, infoX, 54, this.panelWidth - infoX - 16)
    this.addAptitudes(d, unit, infoX, 148, this.panelWidth - infoX - 22, 15)
    this.addNarrative(d, unit, 20, 248, this.panelWidth - 40, this.panelHeight - 292)

    const guide = pixelText(this.scene, '施設を選択して配置　／　ドラッグでも配置', {
      fontSize: TEXT_SIZE.labelNarrow,
      color: COLORS.inkDim,
      wordWrapWidth: this.panelWidth - 40,
    })
    guide.setPosition(20, this.panelHeight - 30)
    d.add(guide)
  }

  private addIdentity(
    host: Phaser.GameObjects.Container,
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
    })
    name.setPosition(x, y)
    host.add(name)

    const alias = pixelText(
      this.scene,
      unit.alias ? unit.alias : unit.unique ? '町の中核メンバー' : '住民',
      {
        fontSize: this.deviceClass === 'wide' ? TEXT_SIZE.bodyWide : TEXT_SIZE.bodyNarrow,
        color: COLORS.inkDim,
        wordWrapWidth: wrapWidth,
      },
    )
    alias.setPosition(x, y + 32)
    host.add(alias)

    const condition = pixelText(
      this.scene,
      unit.condition === 'injured' ? '● 負傷中・効果半減' : '● 健康',
      {
        fontSize: this.deviceClass === 'wide' ? TEXT_SIZE.labelWide : TEXT_SIZE.labelNarrow,
        color: unit.condition === 'injured' ? COLORS.red : COLORS.green,
      },
    )
    condition.setPosition(x, y + 56)
    host.add(condition)

    const assignment = pixelText(this.scene, `配置: ${assignmentLabel}`, {
      fontSize: this.deviceClass === 'wide' ? TEXT_SIZE.labelWide : TEXT_SIZE.labelNarrow,
      color: COLORS.amber,
      wordWrapWidth: wrapWidth,
    })
    assignment.setPosition(x, y + 78)
    host.add(assignment)
  }

  private addAptitudes(
    host: Phaser.GameObjects.Container,
    unit: Unit,
    x: number,
    y: number,
    width: number,
    barHeight: number,
  ): void {
    const barW = Math.max(54, width - 48)
    APTS.forEach((aptitude, index) => {
      const rowY = y + index * (barHeight + 8)
      const label = pixelText(this.scene, APTITUDE_LABEL[aptitude].slice(0, 1), {
        fontSize: this.deviceClass === 'wide' ? TEXT_SIZE.labelWide : TEXT_SIZE.labelNarrow,
        color: APT_COLOR[aptitude],
      })
      label.setPosition(x, rowY)
      host.add(label)

      const bar = this.scene.add.graphics()
      bar.fillStyle(COLORS.night700)
      bar.fillRect(x + 24, rowY + 2, barW, barHeight - 4)
      bar.fillStyle(APT_COLOR[aptitude])
      bar.fillRect(
        x + 24,
        rowY + 2,
        (barW * Math.min(10, Math.max(0, unit.apt[aptitude]))) / 10,
        barHeight - 4,
      )
      host.add(bar)

      const value = pixelText(this.scene, String(unit.apt[aptitude]), {
        fontSize: this.deviceClass === 'wide' ? TEXT_SIZE.labelWide : TEXT_SIZE.labelNarrow,
        color: COLORS.ink,
      })
      value.setPosition(x + 28 + barW, rowY)
      host.add(value)
    })
  }

  private addNarrative(
    host: Phaser.GameObjects.Container,
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
    })
    traits.setPosition(x, y)
    host.add(traits)

    if (unit.flavor && availableHeight >= 40) {
      const flavorText = wrapByCharacters(`「${unit.flavor}」`, maxChars)
      const flavor = pixelText(this.scene, flavorText, {
        fontSize: this.deviceClass === 'wide' ? TEXT_SIZE.labelWide : TEXT_SIZE.labelNarrow,
        color: COLORS.inkDim,
        wordWrapWidth: wrapWidth,
      })
      flavor.setPosition(x, y + Math.min(48, traits.height + 10))
      host.add(flavor)
    }

    const growth = pixelText(this.scene, `成長 ${unit.xp}/${BALANCE.unit.growthThreshold}`, {
      fontSize: TEXT_SIZE.labelNarrow,
      color: COLORS.inkDim,
      backgroundColor: colorCss(COLORS.night700),
    })
    growth.setPosition(x, Math.min(this.panelHeight - 58, y + Math.max(44, availableHeight - 20)))
    host.add(growth)
  }
}
