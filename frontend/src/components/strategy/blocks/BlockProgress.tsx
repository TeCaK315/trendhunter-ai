interface BlockProgressProps {
  current: number
  total: number
}

export default function BlockProgress({ current, total }: BlockProgressProps) {
  const dots = Array.from({ length: total }, (_, i) => {
    const n = i + 1
    if (n < current) return 'done'
    if (n === current) return 'current'
    return 'next'
  })
  return (
    <div className="progress">
      {dots.map((state, i) => (
        <div key={i} className={`pdot ${state}`} />
      ))}
      <span className="progress-text">{current} / {total}</span>
    </div>
  )
}
