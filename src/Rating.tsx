/** Оцінки: складність (зірочки) і «подобається» (сердечка), від 1 до 5. */

export type RateKind = 'effort' | 'love'

export const RATE: Record<RateKind, { label: string; words: string[] }> = {
  effort: { label: 'Складність', words: ['', 'дуже просто', 'просто', 'середньо', 'складно', 'дуже складно'] },
  love: { label: 'Подобається', words: ['', 'не дуже', 'так собі', 'добре', 'дуже', 'обожнюю'] }
}

function Icon({ kind, on, s }: { kind: RateKind; on: boolean; s: number }) {
  if (kind === 'effort') return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" fill={on ? '#3149B8' : 'none'} stroke={on ? '#3149B8' : '#B7C3EE'} strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z" />
    </svg>
  )
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" fill={on ? '#F5A97F' : 'none'} stroke={on ? '#9A4A1C' : '#B7C3EE'} strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />
    </svg>
  )
}

/** Лише показ (рядок із п'яти значків). */
export function RatingView({ kind, value, s = 16 }: { kind: RateKind; value?: number; s?: number }) {
  const v = value ?? 0
  return (
    <span role="img" aria-label={`${RATE[kind].label}: ${v ? `${v} з 5, ${RATE[kind].words[v]}` : 'не вказано'}`} style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => <Icon key={n} kind={kind} on={n <= v} s={s} />)}
    </span>
  )
}

/** Вибір оцінки у формі. Повторне натискання на ту саму — скидає. */
export function RatingInput({ kind, value, onChange }: { kind: RateKind; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="lbl" style={{ marginBottom: 2 }}>{RATE[kind].label}{value > 0 && <> · <b style={{ color: 'var(--ink)' }}>{RATE[kind].words[value]}</b></>}</div>
      <div role="radiogroup" aria-label={RATE[kind].label} style={{ display: 'flex' }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} role="radio" aria-checked={value === n} aria-label={`${n} з 5, ${RATE[kind].words[n]}`}
            onClick={() => onChange(value === n ? 0 : n)}
            style={{ width: 44, height: 44, border: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            <Icon kind={kind} on={n <= value} s={28} />
          </button>
        ))}
      </div>
    </div>
  )
}
