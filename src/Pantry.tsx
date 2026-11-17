import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { isStaple, norm, pantrySet, plural, suggestProducts } from './logic'
import { pillStyle } from './ui'
import Tabs from './Tabs'
import { IcClose, IcPlus, IcSearch } from './icons'
import { addTaste, removeTaste, renameTaste, restoreTaste, useTastes } from './tastesData'
import type { Dish } from './types'

const CHIP_R = ['22px 22px 4px 22px', '22px 4px 22px 22px', '4px 22px 22px 22px', '22px 22px 22px 4px']

type Undo = { text: string; restore: () => Promise<void> }

/** Смаки страв: додати, перейменувати, видалити (з можливістю повернути). */
function TastesSection({ dishes, onUndo }: { dishes: Dish[]; onUndo: (u: Undo) => void }) {
  const tastes = useTastes()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState('')
  const used = (t: string) => dishes.filter(d => d.tags.includes(t)).length

  const add = async () => { if (await addTaste(name)) { setName(''); setErr('') } else if (name.trim()) setErr('Такий смак уже є') }
  const save = async () => {
    if (!editing) return
    if (await renameTaste(editing, draft)) { setEditing(null); setErr('') } else setErr(draft.trim() ? 'Такий смак уже є' : 'Назва порожня')
  }
  const del = async (t: string) => {
    const { index, dishIds } = await removeTaste(t)
    setEditing(null)
    onUndo({ text: `Смак «${t}» видалено${dishIds.length ? ` з ${dishIds.length} ${plural(dishIds.length, 'страви', 'страв', 'страв')}` : ''}`, restore: () => restoreTaste(t, index, dishIds) })
  }

  return (<>
    <h2 className="u" style={{ margin: '28px 0 4px', fontSize: 17, color: 'var(--cobalt)' }}>Смаки</h2>
    <div className="hint">Ярлики для страв і фільтра «Смак» у каталозі. Натисніть на смак, щоб перейменувати або видалити.</div>
    <div className="pills" style={{ marginTop: 8 }}>
      {tastes.map((t, i) => {
        const n = used(t)
        return (
          <button key={t} aria-expanded={editing === t} aria-label={`Смак «${t}», у ${n} ${plural(n, 'страві', 'стравах', 'стравах')}. Змінити`}
            onClick={() => { setEditing(editing === t ? null : t); setDraft(t); setErr('') }}
            style={{ ...pillStyle(editing === t, i), height: 44, padding: '0 16px', fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {t}<span style={{ fontSize: 12, opacity: .7 }}>{n}</span>
          </button>
        )
      })}
    </div>
    {editing && (
      <div className="vcard" style={{ marginTop: 10 }}>
        <form className="irow" onSubmit={e => { e.preventDefault(); save() }}>
          <input className="inp" style={{ background: '#fff' }} value={draft} onChange={e => setDraft(e.target.value)} aria-label={`Нова назва смаку «${editing}»`} autoCapitalize="none" />
          <button type="submit" className="primary" style={{ width: 'auto', height: 50, padding: '0 16px', fontSize: 14.5 }}>Зберегти</button>
        </form>
        <div className="irow" style={{ marginTop: 6, justifyContent: 'space-between' }}>
          <button className="textbtn" style={{ color: 'var(--warn)' }} onClick={() => del(editing)}>Видалити{used(editing) ? ` (у ${used(editing)} ${plural(used(editing), 'страві', 'стравах', 'стравах')})` : ''}</button>
          <button className="textbtn" style={{ color: 'var(--mute)' }} onClick={() => setEditing(null)}>Скасувати</button>
        </div>
      </div>
    )}
    <form className="irow" style={{ marginTop: 10 }} onSubmit={e => { e.preventDefault(); add() }}>
      <input className="inp" value={name} onChange={e => { setName(e.target.value); setErr('') }} placeholder="Новий смак, напр. «гостре»" aria-label="Новий смак" autoCapitalize="none" enterKeyHint="done" />
      <button type="submit" className="iconbtn" style={{ width: 50, height: 50, background: 'var(--cobalt)' }} aria-label="Додати смак"><IcPlus s={22} /></button>
    </form>
    {err && <div className="err">{err}</div>}
  </>)
}

/** «Мої продукти»: що є вдома. Каталог за цим списком показує, чого бракує. */
export default function Pantry() {
  const rows = useLiveQuery(() => db.pantry.toArray(), [])
  const dishes = useLiveQuery(() => db.dishes.toArray(), [])
  const [q, setQ] = useState('')
  const [undo, setUndo] = useState<Undo | null>(null)
  const timer = useRef<number>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const have = useMemo(() => pantrySet(rows), [rows])
  const suggestions = useMemo(() => suggestProducts(dishes ?? [], have), [dishes, have])
  if (!rows || !dishes) return null

  const needle = norm(q)
  const mine = rows
    .filter(p => !needle || norm(p.name).includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name, 'uk'))
  const sugg = (needle ? suggestions.filter(s => norm(s.name).includes(needle)) : suggestions).slice(0, needle ? 8 : 16)
  const typedNew = needle && !have.has(needle) && !sugg.some(s => norm(s.name) === needle)
  const typedStaple = needle && isStaple(needle)
  const typedHave = needle && have.has(needle) && !typedStaple

  const add = async (name: string) => {
    const clean = name.replace(/\s+/g, ' ').trim().toLowerCase()
    if (!clean || have.has(norm(clean))) return
    await db.pantry.put({ name: clean })
    setQ('')
  }
  const showUndo = (u: Undo) => {
    setUndo(u)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setUndo(null), 5000)
  }
  const remove = async (name: string) => {
    await db.pantry.delete(name)
    showUndo({ text: `Прибрано: ${name}`, restore: async () => { await db.pantry.put({ name }) } })
  }
  const restore = async () => {
    if (undo) await undo.restore()
    setUndo(null)
  }

  return (
    <div className="app">
      <header className="top">
        <h1 className="u">Продукти</h1>
        <span style={{ fontSize: 13, color: 'var(--mute)' }}>{rows.length} {plural(rows.length, 'продукт', 'продукти', 'продуктів')} вдома</span>
      </header>
      <div className="scallop" />

      <form className="row1" onSubmit={e => { e.preventDefault(); if (typedNew) add(q) }}>
        <div className="search">
          <IcSearch />
          <input aria-label="Знайти або додати продукт" placeholder="Знайти або додати продукт" value={q} onChange={e => setQ(e.target.value)}
            enterKeyHint="done" autoCapitalize="none" />
          {q && <button type="button" className="iconbtn" style={{ width: 36, height: 36, marginRight: -8, background: 'transparent' }} aria-label="Очистити поле" onClick={() => setQ('')}><IcClose /></button>}
        </div>
      </form>

      <div className="scroll" style={{ padding: '0 20px' }}>
        {!needle && <div className="hint" style={{ marginTop: 12 }}>Позначте, що є вдома: каталог покаже, чого бракує для кожної страви.</div>}

        {typedNew && (
          <button className="primary" style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => add(q)}>
            <IcPlus s={20} />Додати «{q.replace(/\s+/g, ' ').trim()}»
          </button>
        )}

        {sugg.length > 0 && (<>
          <h2 className="u" style={{ margin: '22px 0 4px', fontSize: 17, color: 'var(--cobalt)' }}>{needle ? 'Зі страв' : 'Часто потрібні'}</h2>
          {!needle && <div className="hint">Продукти з ваших страв, яких ще немає в списку. Натисніть, щоб додати.</div>}
          <div className="pills" style={{ marginTop: 8 }}>
            {sugg.map((s, i) => (
              <button key={s.name} className="pill" style={{ ...pillStyle(false, i), display: 'inline-flex', alignItems: 'center', gap: 6 }}
                aria-label={`Додати: ${s.name}${s.count ? `, у ${s.count} ${plural(s.count, 'страві', 'стравах', 'стравах')}` : ''}`} onClick={() => add(s.name)}>
                <IcPlus c="#3149B8" s={16} />{s.name}{s.count > 1 && <span style={{ fontSize: 12, opacity: .7 }}>{s.count}</span>}
              </button>
            ))}
          </div>
        </>)}

        <h2 className="u" style={{ margin: '24px 0 4px', fontSize: 17, color: 'var(--cobalt)' }}>Є вдома</h2>
        {typedHave && <div className="hint">«{q.trim()}» уже є в списку.</div>}
        {typedStaple && <div className="hint">«{q.trim()}» вважається, що є завжди: додавати не потрібно.</div>}
        {mine.length === 0 ? (
          <div className="empty" style={{ marginTop: 10 }}>
            <div style={{ fontSize: 14, color: 'var(--mute)', lineHeight: 1.4 }}>{needle ? 'Серед ваших продуктів такого немає' : 'Поки порожньо. Додайте продукти вище.'}</div>
          </div>
        ) : (
          <div className="pills" style={{ marginTop: 8 }}>
            {mine.map((p, i) => (
              <button key={p.name} aria-label={`Прибрати зі списку: ${p.name}`} onClick={() => remove(p.name)}
                style={{ height: 44, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px 0 16px', border: 0, borderRadius: CHIP_R[i % 4], background: 'var(--soft)', color: 'var(--ink)', fontSize: 14, fontWeight: 600 }}>
                {p.name}<IcClose c="#8C99CE" />
              </button>
            ))}
          </div>
        )}
        {!needle && <TastesSection dishes={dishes} onUndo={showUndo} />}
        <div style={{ height: 90 }} />
      </div>

      {undo && (
        <div role="status" className="toast">
          <span style={{ flex: 1, minWidth: 0 }}>{undo.text}</span>
          <button className="textbtn" style={{ color: '#fff', textDecoration: 'underline' }} onClick={restore}>Повернути</button>
        </div>
      )}
      <Tabs />
    </div>
  )
}
