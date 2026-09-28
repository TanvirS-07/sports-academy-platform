import type { ReactNode } from 'react'

import training from '../assets/training.jpg'
import { usePageTitle } from './PageHeader'
import { Wordmark } from './Layout'

/** Login and register: the form beside a navy panel with the academy's name. */
export function AuthLayout({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  usePageTitle(title)
  return (
    <div className="mx-auto grid max-w-4xl overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-[5fr_6fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand p-10 text-white lg:flex">
        <img src={training} alt="" className="absolute inset-0 size-full object-cover object-[35%_center]" />
        <div aria-hidden="true" className="absolute inset-0 bg-brand/80" />
        <div className="relative">
          <Wordmark size="lg" />
        </div>
        <div className="relative">
          <p className="text-xl leading-8 font-semibold text-balance">
            Book sessions, follow attendance and read your coach’s notes.
          </p>
          <p className="mt-3 text-sm text-white/65">Junior cricket coaching in Sydney</p>
        </div>
      </div>
      <div className="px-5 py-10 sm:px-12 sm:py-14">
        <div className="mx-auto max-w-sm">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <div className="mt-1.5 text-[15px] text-ink-muted">{description}</div>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  )
}
