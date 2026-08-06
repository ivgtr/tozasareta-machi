import Phaser from 'phaser'
import { pixelText } from './pixel-text'

export interface StackTextOptions {
  fontSize?: number
  color?: number
  wrapWidth?: number
  gap?: number
}

export class TextStack {
  constructor(
    private readonly x: number,
    private y: number,
  ) {}

  get bottom(): number {
    return this.y
  }

  add(
    scene: Phaser.Scene,
    host: Phaser.GameObjects.Container,
    text: string,
    options: StackTextOptions = {},
  ): Phaser.GameObjects.Text {
    const t = pixelText(scene, text, {
      fontSize: options.fontSize,
      color: options.color,
      wordWrapWidth: options.wrapWidth,
    })
    t.setPosition(this.x, this.y)
    host.add(t)
    this.y += t.height + (options.gap ?? 6)
    return t
  }

  advance(n: number): void {
    this.y += n
  }
}
