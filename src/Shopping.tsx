import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { isStaple, knownNames, norm } from './logic'
import { addToShopping, clearBought, removeFromShopping, restoreShopItem, toggleBought, useShopping } from './shoppingData'
import type { ShopItem } from './types'
import Tabs from './Tabs'
import { useKeepScroll } from './keepScroll'
import { IcCheck, IcClose, IcPlus } from './icons'

type Undo = { text: string; restore: () => Promise<unknown> }

function Row({ it, onRemove }: { it: ShopItem; onRemove: () => void }) {
  return (
    <div className="irow" style={{ minHeight: 56, borderBottom: '1px solid var(--line)', gap: 6 }}>
      <button onClick={() => toggleBought(it)} aria-pressed={it.done}
        aria-label={it.done ? `${it.name}: куплено. Натисніть, щоб повернути в список` : `Позначити купленим: ${it.name}`}
        style={{ flex: 1, minWidth: 0, minHeight: 52, border: 0, background: 'transparent', display: 'flex', alignItems: 'center', gap: 12, padding: 0, textAlign: 'left' }}>
        <span style={{ flex: 'none', width: 26, height: 26, borderRadius: '9px 9px 3px 9px', border: it.done ? 0 : '2px solid #B7C3EE', background: it.done ? '#3F8F55' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {it.done && <IcCheck c="#fff" s={15} />}
        </span>
        <span style={{ fontSize: 16, fontWeight: 600, color: it.done ? 'var(--mute)' : 'var(--ink)', textDecoration: it.done ? 'line-through' : 'none', overflowWrap: 'anywhere' }}>{it.name}</span>
      </button>
      <button className="iconbtn" style={{ background: 'transparent' }} aria-label={`Прибрати зі списку: ${it.name}`} onClick={onRemove}><IcClose c="#8C99CE" /></button>
    </div>
  )
}

/** Список покупок. Купили — продукт сам потрапляє в «Мої продукти». */
export default function Shopping() {
  const items = useShopping()
  const dishes = useLiveQuery(() => db.dishes.toArray(), [])
  const pantryRows = useLiveQuery(() => db.pantry.toArray(), [])
  const known = useMemo(() => knownNames(dishes ?? [], pantryRows ?? []), [dishes, pantryRows])
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')
  const [undo, setUndo] = useState<Undo | null>(null)
  const timer = useRef<number>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const keep = useKeepScroll('shopping', !!items)
  if (!items) return null

  const toBuy = items.filter(i => !i.done)
  const bought = items.filter(i => i.done)
  const showUndo = (u: Undo) => { setUndo(u); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setUndo(null), 5000) }

  const add = async () => {
    const name = q.replace(/\s+/g, ' ').trim()
    if (!name) return
    if (isStaple(name)) { setMsg(`«${name}» вважається, що є завжди`); return }
    const n = await addToShopping([name])
    setMsg(n ? '' : `«${name}» уже є в списку`)
    if (n) setQ('')
  }
  const remove = async (it: ShopItem) => { await removeFromShopping(it.id!); showUndo({ text: `Прибрано: ${it.name}`, restore: () => restoreShopItem(it) }) }
  const clear = async () => { const done = await clearBought(); showUndo({ text: `Прибрано куплене: ${done.length}`, restore: () => db.shopping.bulkPut(done) }) }

  return (
    <div className="app">
      <header className="top">
        <h1 className="u">Покупки</h1>
        <span style={{ fontSize: 13, color: 'var(--mute)' }}>{toBuy.length ? `${toBuy.length} купити` : 'усе куплено'}</span>
      </header>
      <div className="scallop" />

      <form className="row1" onSubmit={e => { e.preventDefault(); add() }}>
        <div className="search" style={{ paddingRight: 6 }}>
          <input aria-label="Що купити" placeholder="Що купити?" value={q} list="shop-names" autoCapitalize="none" enterKeyHint="done"
            onChange={e => { setQ(e.target.value); setMsg('') }} />
          <datalist id="shop-names">{known.filter(n => !items.some(i => !i.done && norm(i.name) === norm(n))).map(n => <option key={n} value={n} />)}</datalist>
        </div>
        <button type="submit" className="btn-sort" style={{ width: 50, padding: 0, justifyContent: 'center' }} aria-label="Додати в список"><IcPlus s={22} /></button>
      </form>
      {msg && <div className="err" style={{ margin: '6px 20px 0' }}>{msg}</div>}

      <div className="scroll" style={{ padding: '0 20px' }} ref={keep.ref} onScroll={keep.onScroll}>
        {items.length === 0 ? (
          <div className="empty">
            <div className="u" style={{ fontSize: 16, color: 'var(--cobalt)' }}>Список порожній</div>
            <div style={{ fontSize: 13.5, color: 'var(--mute)', marginTop: 6, lineHeight: 1.4 }}>Додайте продукт вище або відкрийте страву й натисніть «Додати відсутнє в покупки».</div>
          </div>
        ) : (<>
          <div className="hint" style={{ marginTop: 12 }}>Натисніть на продукт, коли купите: він з'явиться в «Моїх продуктах».</div>
          {toBuy.map(it => <Row key={it.id} it={it} onRemove={() => remove(it)} />)}
          {bought.length > 0 && (<>
            <div className="irow" style={{ justifyContent: 'space-between', marginTop: 20 }}>
              <h2 className="u" style={{ margin: 0, fontSize: 17, color: 'var(--cobalt)' }}>Куплено <span style={{ fontSize: 13, color: 'var(--mute)', fontFamily: 'Onest, sans-serif' }}>{bought.length}</span></h2>
              <button className="textbtn" onClick={clear}>Прибрати куплене</button>
            </div>
            {bought.map(it => <Row key={it.id} it={it} onRemove={() => remove(it)} />)}
          </>)}
        </>)}
        <div style={{ height: 90 }} />
      </div>

      {undo && (
        <div role="status" className="toast">
          <span style={{ flex: 1, minWidth: 0 }}>{undo.text}</span>
          <button className="textbtn" style={{ color: '#fff', textDecoration: 'underline' }} onClick={async () => { await undo.restore(); setUndo(null) }}>Повернути</button>
        </div>
      )}
      <Tabs />
    </div>
  )
}
