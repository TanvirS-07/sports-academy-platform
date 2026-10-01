import type { ComponentProps, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'md' | 'sm'

/** Smooth colour, border, shadow and movement changes on hover. */
export const fade = 'transition duration-150 ease-out'

/**
 * Lifts the button up 1px with a soft shadow on hover, and presses it back down
 * when clicked. People who turn on "reduce motion" only get the colour fade.
 */
export const lift = `${fade} hover:-translate-y-px hover:shadow-md active:translate-y-0 active:shadow-sm motion-reduce:hover:translate-y-0`

const base =
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap disabled:pointer-events-none disabled:opacity-50'

const variants: Record<Variant, string> = {
  primary: `bg-brand text-white hover:bg-brand-hover ${lift}`,
  secondary: `border border-line-strong bg-surface text-ink hover:bg-subtle ${lift}`,
  danger: `bg-danger text-white hover:bg-danger-hover ${lift}`,
  ghost: `text-ink-muted hover:bg-subtle hover:text-ink ${fade}`,
}

const sizes: Record<Size, string> = {
  md: 'h-10 px-4 text-sm',
  sm: 'h-8 px-3 text-[13px]',
}

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`
}

type ButtonProps = ComponentProps<'button'> & { variant?: Variant; size?: Size }

export function Button({ variant, size, className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />
}

type ButtonLinkProps = LinkProps & { variant?: Variant; size?: Size; children: ReactNode }

export function ButtonLink({ variant, size, className = '', ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />
}

/** A text-style action inside a row or sentence, like "Edit" or "Cancel booking". */
export function TextButton({
  tone = 'brand',
  className = '',
  type = 'button',
  ...props
}: ComponentProps<'button'> & { tone?: 'brand' | 'danger' }) {
  const colour = tone === 'danger' ? 'text-danger hover:text-danger-hover' : 'text-brand hover:text-brand-hover'
  return (
    <button
      type={type}
      className={`-my-2 py-2 text-sm transition-colors duration-150 font-semibold underline-offset-4 hover:underline disabled:opacity-50 ${colour} ${className}`}
      {...props}
    />
  )
}
