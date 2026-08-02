import { forwardRef, type ButtonHTMLAttributes } from 'react'

interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  primary?: boolean
}

export const PixelButton = forwardRef<HTMLButtonElement, PixelButtonProps>(function PixelButton(
  { primary, className, ...rest },
  ref,
) {
  const classes = ['pixel-button', primary ? 'pixel-button--primary' : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return <button ref={ref} className={classes} {...rest} />
})
