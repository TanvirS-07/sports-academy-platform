import { Link } from 'react-router'

import training from '../assets/training.jpg'
import { buttonClasses } from '../components/Button'
import { usePageTitle } from '../components/PageHeader'

const features = [
  {
    title: 'Book training sessions',
    text: 'See the sessions in your child’s programs and book or cancel a place in a couple of taps.',
  },
  {
    title: 'Follow their progress',
    text: 'Attendance for every session, kept in one place for each of your children.',
  },
  {
    title: 'Hear from their coach',
    text: 'Development notes on the skills they’re working on and what to practise next.',
  },
]

export function HomePage() {
  usePageTitle(undefined)

  return (
    <div className="-mt-8 sm:-mt-10">
      {/* Full width, so it reads as one block with the header above it. */}
      <section className="relative mx-[calc(50%-50vw)] overflow-hidden bg-brand text-white">
        <img src={training} alt="" className="absolute inset-0 size-full object-cover object-[70%_center] lg:left-auto lg:w-3/5" />
        {/* Navy over the photo, solid behind the text and fading out to the right on wide screens. */}
        <div aria-hidden="true" className="absolute inset-0 bg-brand/85 lg:bg-transparent lg:bg-linear-to-r lg:from-brand lg:from-45% lg:to-brand/35" />
        <div className="relative mx-auto max-w-6xl px-4 pt-14 pb-20 sm:px-6 sm:pt-20 sm:pb-24">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl sm:leading-[1.1]">
              Junior cricket coaching in Sydney
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-white/80">
              Parents of Precision Cricket Academy players book sessions, follow attendance and read their
              coach’s notes here.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className={buttonClasses('secondary', 'md', 'h-11 border-transparent px-5')}>
                Create a parent account
              </Link>
              <Link to="/login" className={buttonClasses('ghost', 'md', 'h-11 px-5 text-white ring-1 ring-white/30 hover:bg-white/10 hover:text-white')}>
                Log in
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="features-heading" className="py-14 sm:py-16">
        <h2 id="features-heading" className="text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">
          For parents
        </h2>
        <ul className="mt-6 grid gap-8 sm:grid-cols-3 sm:gap-10">
          {features.map((feature) => (
            <li key={feature.title} className="border-t-2 border-brand pt-4">
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 leading-7 text-ink-muted">{feature.text}</p>
            </li>
          ))}
        </ul>
        <p className="mt-12 text-sm text-ink-muted">
          Coaches: your account is set up by the academy. Use the email you gave us to log in.
        </p>
      </section>
    </div>
  )
}
