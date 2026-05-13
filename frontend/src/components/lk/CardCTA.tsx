import Link from 'next/link'

interface Props {
  title: string
  subtitle?: string
  metric?: string
  cta: string
  href: string
  variant?: 'primary' | 'secondary'
}

export default function CardCTA({ title, subtitle, metric, cta, href, variant = 'primary' }: Props) {
  const btn =
    variant === 'primary'
      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
  return (
    <div className="max-w-md w-full mx-auto bg-zinc-900/60 border border-zinc-800 rounded-2xl p-7 shadow-xl space-y-5">
      <div className="space-y-1.5 text-center">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {metric && (
        <div className="px-4 py-3 bg-zinc-950/60 border border-zinc-800 rounded-lg text-center">
          <span className="text-sm text-emerald-400 font-medium">{metric}</span>
        </div>
      )}
      <Link href={href} className={`block w-full py-3 rounded-xl text-sm font-medium text-center transition-colors ${btn}`}>
        {cta}
      </Link>
    </div>
  )
}
