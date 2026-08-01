// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from '../src/ui/App'

describe('ui smoke', () => {
  it('プレビュー画面の3ゾーンが描画される', () => {
    render(<App />)
    expect(screen.getByText('町の状況')).toBeTruthy()
    expect(screen.getByText('本日の対応')).toBeTruthy()
    expect(screen.getByText('本部記録')).toBeTruthy()
    expect(screen.getByText('作戦を開始する')).toBeTruthy()
  })
})
