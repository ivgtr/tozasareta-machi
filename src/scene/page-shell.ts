export type PageMode = 'title' | 'game'

export function setPageMode(mode: PageMode): void {
  if (document.body.dataset.pageMode === mode) return
  document.body.dataset.pageMode = mode
  if (mode === 'game') window.scrollTo({ top: 0, behavior: 'instant' })
}
