import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { ROLE_LABEL, type Role } from './types'
import { bestMatch, norm, pantrySet, plural, type Match } from './logic'
import Thumb from './Thumb'
import Tabs from './Tabs'
import { ROLES, pillStyle } from './ui'
import { IcCheck } from './icons'

const strav = (n: number) => `${n} ${plural(n, 'страва', 'страви', 'страв')}`

function Row({ m }: { m: Match }) {
  const { dish: d, variant: v, cov } = m
  const to = `/dish/${d.id}` + (v ? `?v=${encodeURIComponent(v.id)}` : '')
  return (
    <div className="drow" style={{ height: 'auto', minHeight: 100 }}>
      <Thumb dish={d} />
      <Link to={to} className="dinfo">
        <div className="dname">{d.name}</div>
        {v && d.variants.length > 1 && <div className="dsub">варіант: <b>{v.name}</b></div>}
        <div className="dreq">
          {cov.missing.length === 0 && cov.subs.length === 0 && <div style={{ color: '#2F6B3A', fontWeight: 600 }}>Усе є вдома</div>}
          {cov.subs.length > 0 && <div style={{ whiteSpace: 'normal', color: 'var(--cobalt)' }}>заміна: {cov.subs.map(s => `${s.name} → ${s.sub}`).join(', ')}</div>}
          {cov.missing.length > 0 && <div className="lack" style={{ whiteSpace: 'normal' }}>бракує: {cov.missing.join(', ')}</div>}
        </div>
      </Link>
    </div>
  )
}

/** «Що приготувати»: страви за продуктами з «Моїх продуктів». */
export default function Search() {
  const dishes = useLiveQuery(() => db.dishes.toArray(), [])
  const pantryRows = useLiveQuery(() => db.pantry.toArray(), [])
  const pantry = useMemo(() => pantrySet(pantryRows), [pantryRows])
  const [roles, setRoles] = useState<Record<Role, boolean>>({ side: true, protein: true, full: true })
  const [want, setWant] = useState<string[]>([])
  const [showRest, setShowRest] = useState(false)

  // продукти вдома, які трапляються у стравах — для «Хочу використати»
  const usable = useMemo(() => {
    const count = new Map<string, number>()
    for (const d of dishes ?? []) {
      if (d.hiddenAt) continue
      const names = new Set([...d.ingredients, ...d.variants.flatMap(v => v.addIngredients ?? [])].map(i => norm(i.name)))
      for (const n of names) if (pantry.has(n)) count.set(n, (count.get(n) ?? 0) + 1)
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'uk')).map(([n]) => n)
  }, [dishes, pantry])

  if (!dishes || !pantryRows) return null

  const wantNow = want.filter(w => usable.includes(w))
  const matches = dishes
    .filter(d => !d.hiddenAt && roles[d.role])
    .map(d => bestMatch(d, pantry, wantNow))
    .filter((m): m is Match => !!m)
    .sort((a, b) => a.cov.missing.length - b.cov.missing.length || a.cov.subs.length - b.cov.subs.length || a.dish.order - b.dish.order)
  const ready = matches.filter(m => m.cov.missing.length === 0)
  const one = matches.filter(m => m.cov.missing.length === 1)
  const two = matches.filter(m => m.cov.missing.length === 2)
  const rest = matches.filter(m => m.cov.missing.length > 2)

  const toggleRole = (r: Role) => setRoles(cur => {
    const n = { ...cur, [r]: !cur[r] }
    return n.side || n.protein || n.full ? n : cur
  })
  const section = (title: string, list: Match[], hint?: string) => list.length > 0 && (
    <>
      <h2 className="u" style={{ margin: '22px 0 2px', fontSize: 17, color: 'var(--cobalt)' }}>{title} <span style={{ fontSize: 13, color: 'var(--mute)', fontFamily: 'Onest, sans-serif' }}>{list.length}</span></h2>
      {hint && <div className="hint">{hint}</div>}
      {list.map(m => <Row key={m.dish.id} m={m} />)}
    </>
  )

  return (
    <div className="app">
      <header className="top">
        <h1 className="u">Що приготувати</h1>
      </header>
      <div className="scallop" />

      <div className="scroll">
        <div style={{ padding: '12px 20px 0' }}>
          <div className="hint" style={{ margin: 0 }}>
            За вашими продуктами: <Link to="/pantry" style={{ color: 'var(--cobalt)', fontWeight: 600, textDecoration: 'underline' }}>{pantryRows.length} {plural(pantryRows.length, 'продукт', 'продукти', 'продуктів')} вдома</Link>. Заміни теж враховуються.
          </div>
        </div>

        <div className="chips">
          {ROLES.map(r => {
            const on = roles[r.k]
            return (
              <button key={r.k} className="chip" aria-pressed={on} onClick={() => toggleRole(r.k)}
                style={{ borderRadius: r.r, border: `1.5px ${on ? 'solid' : 'dashed'} ${r.dot}`, background: on ? r.dot : r.bg, color: on ? '#1F2A5C' : '#4A5690' }}>
                {on ? <IcCheck /> : <span style={{ width: 10, height: 10, borderRadius: r.k === 'side' ? 3 : r.k === 'full' ? '5px 5px 1px 1px' : '50%', background: r.dot }} />}
                <span>{ROLE_LABEL[r.k]}</span>
              </button>
            )
          })}
        </div>

        {usable.length > 0 && (<>
          <div className="lbl" style={{ margin: '10px 20px 0' }}>Хочу використати{wantNow.length > 0 && <> · <button className="textbtn" style={{ height: 'auto', padding: 0, fontSize: 13 }} onClick={() => setWant([])}>скинути</button></>}</div>
          <div className="chips" style={{ paddingTop: 8 }}>
            {usable.map((n, i) => {
              const on = wantNow.includes(n)
              return <button key={n} className="pill" style={{ ...pillStyle(on, i), flex: 'none' }} aria-pressed={on}
                onClick={() => setWant(w => w.includes(n) ? w.filter(x => x !== n) : [...w, n])}>{n}</button>
            })}
          </div>
        </>)}

        <div className="list">
          {pantryRows.length === 0 ? (
            <div className="empty">
              <div className="u" style={{ fontSize: 16, color: 'var(--cobalt)' }}>Список продуктів порожній</div>
              <div style={{ fontSize: 13.5, color: 'var(--mute)', marginTop: 6, lineHeight: 1.4 }}>Позначте, що є вдома, у вкладці «Продукти», і тут з'являться страви.</div>
              <Link to="/pantry" className="primary" style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>До продуктів</Link>
            </div>
          ) : matches.length === 0 ? (
            <div className="empty">
              <div className="u" style={{ fontSize: 16, color: 'var(--cobalt)' }}>Нічого не знайшли</div>
              <div style={{ fontSize: 13.5, color: 'var(--mute)', marginTop: 6, lineHeight: 1.4 }}>Немає страв{wantNow.length ? ' з усіма вибраними продуктами' : ''} серед вибраних ролей.</div>
            </div>
          ) : (<>
            {ready.length === 0 && (
              <div className="empty" style={{ marginTop: 16 }}>
                <div style={{ fontSize: 14, color: 'var(--mute)', lineHeight: 1.4 }}>Поки немає страви, для якої є все. Нижче ті, де бракує найменше.</div>
              </div>
            )}
            {section('Можна приготувати зараз', ready)}
            {section('Бракує одного', one)}
            {section('Бракує двох', two)}
            {rest.length > 0 && (<>
              <button className="dashed" style={{ marginTop: 18, borderColor: '#B7C3EE', fontSize: 14.5 }} aria-expanded={showRest} onClick={() => setShowRest(!showRest)}>
                {showRest ? 'Сховати решту' : `Решта: ${strav(rest.length)}, бракує трьох і більше`}
              </button>
              {showRest && rest.map(m => <Row key={m.dish.id} m={m} />)}
            </>)}
          </>)}
          <div style={{ height: 40 }} />
        </div>
      </div>
      <Tabs />
    </div>
  )
}
