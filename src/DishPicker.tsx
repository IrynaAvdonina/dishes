import { useState } from 'react'
import type { Dish } from './types'
import { norm } from './logic'
import { MiniThumb } from './Thumb'
import { IcCheck, IcSearch } from './icons'

/**
 * Аркуш вибору страви зі списку.
 * selected — позначені (для кількох пар); onPick викликається на кожне натискання.
 */
export default function DishPicker({ title, hint, dishes, selected, onPick, onClose, done = 'Готово' }: {
  title: string; hint?: string; dishes: Dish[]; selected?: Set<number>
  onPick: (d: Dish) => void; onClose: () => void; done?: string
}) {
  const [q, setQ] = useState('')
  const needle = norm(q)
  const list = dishes
    .filter(d => !needle || norm(d.name).includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name, 'uk'))
  return (
    <div className="overlay">
      <button className="bg" aria-label="Закрити" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={title} style={{ display: 'flex', flexDirection: 'column', height: '85%' }}>
        <div className="grab" />
        <div className="shead"><h2 className="u">{title}</h2><button className="textbtn" onClick={onClose}>{done}</button></div>
        {hint && <div className="hint">{hint}</div>}
        {dishes.length > 6 && (
          <div className="search" style={{ flex: 'none', marginTop: 8 }}>
            <IcSearch />
            <input aria-label="Знайти страву" placeholder="Назва страви" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', marginTop: 8 }}>
          {list.map(d => {
            const on = selected?.has(d.id!) ?? false
            return (
              <button key={d.id} aria-pressed={selected ? on : undefined} onClick={() => onPick(d)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 72, padding: '6px 4px', border: 0, borderBottom: '1px solid var(--line)', background: '#fff', textAlign: 'left' }}>
                <MiniThumb dish={d} size={52} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 15.5, fontWeight: 600 }}>{d.name}</span>
                {selected && (
                  <span style={{ flex: 'none', width: 28, height: 28, borderRadius: '10px 10px 3px 10px', border: on ? 0 : '1.5px solid #B7C3EE', background: on ? 'var(--cobalt)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {on && <IcCheck c="#fff" />}
                  </span>
                )}
              </button>
            )
          })}
          {list.length === 0 && <div className="hint" style={{ marginTop: 14 }}>{dishes.length ? 'Нічого не знайшли' : 'Немає страв, які підходять.'}</div>}
        </div>
      </div>
    </div>
  )
}
