import type { ButtonHTMLAttributes } from 'react'

interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  primary?: boolean
}

export function PixelButton({ primary, className, ...rest }: PixelButtonProps) {
  const classes = ['pixel-button', primary ? 'pixel-button--primary' : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return <button className={classes} {...rest} />
}
