import type { ReactNode } from 'react'

import { PageHeader } from '../components/PageHeader'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
      {children}
    </section>
  )
}

/** The privacy policy. Google asks for one before parents can sign in with Google. */
export function PrivacyPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Privacy policy" description="Last updated 29 October 2026" />
      <div className="mt-8 space-y-8 text-[15px] leading-7 text-ink-muted [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink">
        <p>
          This site is a demo of a booking and coaching app for Precision Cricket Academy. The people, players and
          sessions in it are made up. Please don’t enter real details about your children.
        </p>

        <Section title="What we keep">
          <ul className="space-y-1.5">
            <li>
              <strong>Your account:</strong> your name, email address and role (parent or coach). If you use a
              password, only a one-way hash of it is stored, never the password itself.
            </li>
            <li>
              <strong>Players you add:</strong> each child’s name and date of birth.
            </li>
            <li>
              <strong>Academy records:</strong> bookings, attendance and the development notes coaches write.
            </li>
          </ul>
        </Section>

        <Section title="Signing in with Google">
          <p>
            If you choose “Continue with Google”, Google tells us your name, email address, whether Google has
            verified that email, and an id for your Google account. We use these only to log you in and to make or
            find your parent account. We don’t get your Google password, contacts, files or anything else from your
            Google account, and we don’t post anything to it.
          </p>
        </Section>

        <Section title="Who can see it">
          <ul className="space-y-1.5">
            <li>A child’s date of birth is only shown to their parents and to the coaches of programs they’re in.</li>
            <li>Coaches only see attendance and notes from their own programs. Parents see everything about their own children.</li>
            <li>We don’t sell your information, show ads, or use analytics or tracking tools.</li>
          </ul>
        </Section>

        <Section title="Cookies">
          <p>
            We use two cookies, and only to keep you logged in: one that keeps you signed in for up to 7 days, and a
            short-lived one (10 minutes) while you’re signing in with Google. Neither is used for tracking.
          </p>
        </Section>

        <Section title="Where it’s stored">
          <p>
            The site is hosted on Vercel, the server runs on Render and the database is on Neon. They store the data
            on our behalf and don’t use it for anything else.
          </p>
        </Section>

        <Section title="Deleting your information">
          <p>
            Because this is a demo, its data is reset from time to time, which deletes every account that isn’t part
            of the demo. You can also ask the academy to delete your account and your children’s details at any time.
          </p>
        </Section>
      </div>
    </div>
  )
}
