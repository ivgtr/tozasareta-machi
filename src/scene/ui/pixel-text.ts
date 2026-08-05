import Phaser from 'phaser'
import { COLORS, FONT_BODY, TEXT_SIZE, colorCss } from '../tokens'

export interface PixelTextOptions {
  fontFamily?: string
  fontSize?: number
  color?: number
  align?: 'left' | 'center' | 'right'
  wordWrapWidth?: number
  trackingEm?: number
}

export function pixelText(
  scene: Phaser.Scene,
  text: string,
  options: PixelTextOptions = {},
): Phaser.GameObjects.Text {
  const fontSize = options.fontSize ?? TEXT_SIZE.bodyWide
  return scene.add.text(0, 0, text, {
    fontFamily: options.fontFamily ?? FONT_BODY,
    fontSize: `${fontSize}px`,
    color: colorCss(options.color ?? COLORS.ink),
    align: options.align ?? 'left',
    letterSpacing: options.trackingEm ? Math.round(fontSize * options.trackingEm) : 0,
    ...(options.wordWrapWidth !== undefined ? { wordWrap: { width: options.wordWrapWidth } } : {}),
  })
}
