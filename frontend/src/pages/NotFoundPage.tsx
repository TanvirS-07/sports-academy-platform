import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-slate-600">The page you are looking for does not exist.</p>
      <Link to="/" className="font-medium text-emerald-800 underline underline-offset-4">
        Back to home
      </Link>
    </section>
  )
}
