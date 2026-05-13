'use client'

interface AILeverageCardProps {
  card: {
    task_id: string
    task_name: string
    traditional: { action: string; cost: string; time: string }
    primary_tool: {
      tool_id: string; name: string; url: string
      cost_monthly: number | null; has_free_tier: boolean; niche_setup: string
    }
    free_alternative: { name: string; url: string; limitation: string } | null
    svg?: string
  }
}

export default function AILeverageCard({ card }: AILeverageCardProps) {
  const costLabel = card.primary_tool.has_free_tier
    ? 'Бесплатно'
    : `$${card.primary_tool.cost_monthly}/мес`

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">{card.task_name}</h4>
        <span className={`text-xs px-2 py-0.5 rounded-full ${card.primary_tool.has_free_tier ? 'bg-green-500/10 text-green-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
          {costLabel}
        </span>
      </div>

      <div className="text-xs text-zinc-500 flex items-center gap-2">
        <span className="line-through">{card.traditional.cost} · {card.traditional.time}</span>
        <span className="text-zinc-600">→</span>
        <span className="text-green-400">{card.primary_tool.name}</span>
      </div>

      <p className="text-xs text-zinc-400">{card.primary_tool.niche_setup}</p>

      {card.svg && (
        <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: card.svg }} />
      )}

      {card.free_alternative && (
        <div className="text-xs text-zinc-500 border-t border-zinc-800 pt-2">
          Бесплатная альтернатива: <span className="text-zinc-400">{card.free_alternative.name}</span>
          <span className="text-zinc-600"> · {card.free_alternative.limitation}</span>
        </div>
      )}
    </div>
  )
}
