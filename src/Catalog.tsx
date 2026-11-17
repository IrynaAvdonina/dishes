import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { DndContext, PointerSensor, TouchSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db } from './db'
import { ROLE_LABEL, TASTES, type Dish, type Role } from './types'
import { activeFilterCount, ingredientCount, matchesSearch, mergeFilters, missing, norm, pantrySet, passes, plural, requiredNames, sortDishes, type Dir, type Filters, type SortKey } from './logic'
import Thumb from './Thumb'
import Tabs from './Tabs'
import { ROLES, pillStyle } from './ui'
import { IcCheck, IcEyeOff, IcFilter, IcGrip, IcPlus, IcSearch, IcSort } from './icons'

const SORTS: { k: SortKey; label: string; short: string; hint: string; a: string; b: string }[] = [
  { k: 'manual', label: 'Мій порядок', short: 'Мій', hint: 'Так, як ви розставили вручну', a: 'За вашим порядком', b: 'У зворотному' },
  { k: 'time', label: 'За часом', short: 'Час', hint: 'Від швидких до довгих', a: 'Спершу швидкі', b: 'Спершу довгі' },
  { k: 'ing', label: 'За кількістю інгредієнтів', short: 'Інгр.', hint: 'Від простих до складних', a: 'Спершу прості', b: 'Спершу складні' },
  { k: 'name', label: 'За назвою', short: 'А–Я', hint: 'За алфавітом', a: 'А → Я', b: 'Я → А' }
]

function load<T>(k: string, d: T): T {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : d } catch { return d }
}

function RowBody({ d, pantry, sortKey }: { d: Dish; pantry: Set<string>; sortKey: SortKey }) {
  const lack = missing(d.ingredients, pantry)
  return (
    <>
      <Thumb dish={d} />
      <Link to={`/dish/${d.id}`} className="dinfo">
        <div className="dname">{d.name}</div>
        <div className="dsub">
          {sortKey === 'time' && <b>{d.timeMin} хв</b>}
          {sortKey === 'ing' && <b>{ingredientCount(d.ingredients)} інгр.</b>}
        </div>
        <div className="dreq">
          <div>Потрібно: {requiredNames(d.ingredients)}</div>
          {lack.length > 0 && <div className="lack">немає: {lack.join(', ')}</div>}
        </div>
      </Link>
    </>
  )
}

function SortableRow({ d, pantry }: { d: Dish; pantry: Set<string> }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: d.id! })
  return (
    <div ref={setNodeRef} className="drow" style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, position: 'relative', zIndex: isDragging ? 5 : 'auto' }}>
      <button className="iconbtn" aria-label={`Перетягнути: ${d.name}`} style={{ background: 'transparent', touchAction: 'none', margin: '0 -8px' }} {...attributes} {...listeners}><IcGrip /></button>
      <Thumb dish={d} />
      <div className="dinfo">
        <div className="dname">{d.name}</div>
        <div className="dreq"><div>Потрібно: {requiredNames(d.ingredients)}</div></div>
      </div>
    </div>
  )
}

export default function Catalog() {
  const all = useLiveQuery(() => db.dishes.toArray(), [])
  const pantryRows = useLiveQuery(() => db.pantry.toArray(), [])
  const pantry = useMemo(() => pantrySet(pantryRows), [pantryRows])

  const [q, setQ] = useState('')
  const [filters, setFiltersS] = useState<Filters>(() => mergeFilters(load<Partial<Filters> | null>('filters', null)))
  const [sortKey, setSortKeyS] = useState<SortKey>(() => load('sortKey', 'manual'))
  const [dir, setDirS] = useState<Dir>(() => load('dir', 'asc'))
  const [sheet, setSheet] = useState<'sort' | 'filters' | null>(null)
  const [reorder, setReorder] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  // новий порядок після перетягування, поки база ще зберігає (щоб рядок не «стрибав» назад)
  const [pendingOrder, setPendingOrder] = useState<Map<number, number> | null>(null)
  useEffect(() => setPendingOrder(null), [all])

  const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* без збереження */ } }
  const setFilters = (f: Filters) => { setFiltersS(f); save('filters', f) }
  const setSortKey = (k: SortKey) => { setSortKeyS(k); save('sortKey', k) }
  const setDir = (d: Dir) => { setDirS(d); save('dir', d) }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  if (!all) return null
  const hidden = all.filter(d => d.hiddenAt)
  const needle = norm(q)
  const withPending = pendingOrder ? all.map(d => pendingOrder.has(d.id!) ? { ...d, order: pendingOrder.get(d.id!)! } : d) : all
  const visible = sortDishes(
    withPending.filter(d => !d.hiddenAt && passes(d, filters) && matchesSearch(d, needle)),
    sortKey, dir)
  const cur = SORTS.find(s => s.k === sortKey)!
  const fcount = activeFilterCount(filters)

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const ids = visible.map(d => d.id!)
    const from = ids.indexOf(e.active.id as number), to = ids.indexOf(e.over.id as number)
    const next = arrayMove(ids, from, to)
    const slots = visible.map(d => d.order).sort((a, b) => a - b)
    setPendingOrder(new Map(next.map((id, n) => [id, slots[n]])))
    await db.transaction('rw', db.dishes, async () => {
      for (let n = 0; n < next.length; n++) await db.dishes.update(next[n], { order: slots[n] })
    })
  }

  const toggleRole = (r: Role) => {
    const n = { ...filters.roles, [r]: !filters.roles[r] }
    if (n.side || n.protein || n.full) setFilters({ ...filters, roles: n })
  }
  const countOf = (r: Role) => all.filter(d => d.role === r && !d.hiddenAt).length

  return (
    <div className="app">
      <header className="top">
        <h1 className="u">Страви</h1>
        <span style={{ fontSize: 13, color: 'var(--mute)' }}>{all.length} у каталозі</span>
      </header>
      <div className="scallop" />

      <div className="row1">
        <div className="search">
          <IcSearch />
          <input aria-label="Пошук страви" placeholder="Назва або продукт" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <button className="btn-sort" aria-label={`Сортування: ${cur.label}`} onClick={() => setSheet('sort')}><IcSort />{cur.short}</button>
        <button className="btn-filt" aria-label={`Фільтри${fcount ? ` (${fcount} активні)` : ''}`} onClick={() => setSheet('filters')}>
          <IcFilter />{fcount > 0 && <span className="badge">{fcount}</span>}
        </button>
      </div>

      {!reorder ? (
        <div className="chips">
          {ROLES.map(r => {
            const on = filters.roles[r.k]
            return (
              <button key={r.k} className="chip" aria-pressed={on} onClick={() => toggleRole(r.k)}
                style={{ borderRadius: r.r, border: `1.5px ${on ? 'solid' : 'dashed'} ${r.dot}`, background: on ? r.dot : r.bg, color: on ? '#1F2A5C' : '#4A5690' }}>
                {on ? <IcCheck /> : <span style={{ width: 10, height: 10, borderRadius: r.k === 'side' ? 3 : r.k === 'full' ? '5px 5px 1px 1px' : '50%', background: r.dot }} />}
                <span>{ROLE_LABEL[r.k]}</span>
                <span style={{ fontSize: 12.5, fontWeight: 500, opacity: .75 }}>{countOf(r.k)}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="banner">
          <span>Тримайте ручку і перетягніть рядок на нове місце</span>
          <button onClick={() => setReorder(false)} style={{ height: 36, border: 0, borderRadius: '18px 18px 4px 18px', background: 'var(--cobalt)', color: '#fff', padding: '0 16px', fontSize: 14, fontWeight: 600 }}>Готово</button>
        </div>
      )}

      <div className="meta">{visible.length} {plural(visible.length, 'страва', 'страви', 'страв')} · {cur.label}</div>

      <div className="scroll list">
        {reorder ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={visible.map(d => d.id!)} strategy={verticalListSortingStrategy}>
              {visible.map(d => <SortableRow key={d.id} d={d} pantry={pantry} />)}
            </SortableContext>
          </DndContext>
        ) : visible.map(d => (
          <div key={d.id} className="drow">
            <RowBody d={d} pantry={pantry} sortKey={sortKey} />
            <button className="iconbtn" aria-label={`Приховати: ${d.name}`} onClick={() => db.dishes.update(d.id!, { hiddenAt: Date.now() })}><IcEyeOff /></button>
          </div>
        ))}

        {visible.length === 0 && (
          <div className="empty"><div className="u" style={{ fontSize: 16, color: 'var(--cobalt)' }}>Нічого не знайшли</div>
            <div style={{ fontSize: 13.5, color: 'var(--mute)', marginTop: 6, lineHeight: 1.4 }}>Послабте фільтри або поверніть приховані страви</div></div>
        )}

        {hidden.length > 0 && (
          <>
            <button className="dashed" style={{ marginTop: 14, borderColor: '#B7C3EE', fontSize: 14.5 }} aria-expanded={showHidden} onClick={() => setShowHidden(!showHidden)}>
              <IcEyeOff />Приховані ({hidden.length})
            </button>
            {showHidden && hidden.map(d => (
              <div key={d.id} className="drow" style={{ height: 68 }}>
                <div style={{ opacity: .7, transform: 'scale(.6)', transformOrigin: 'left center', width: 50 }}><Thumb dish={d} /></div>
                <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: 'var(--mute)' }}>{d.name}</div>
                <button onClick={() => db.dishes.update(d.id!, { hiddenAt: undefined })} style={{ flex: 'none', height: 44, border: 0, borderRadius: '16px 16px 4px 16px', background: 'var(--cobalt)', color: '#fff', fontSize: 13.5, fontWeight: 600, padding: '0 14px' }}>Повернути</button>
              </div>
            ))}
          </>
        )}
        <div style={{ height: 90 }} />
      </div>

      {!reorder && <Link to="/new" className="fab" aria-label="Нова страва"><IcPlus /></Link>}
      <Tabs />

      {sheet === 'sort' && (
        <div className="overlay">
          <button className="bg" aria-label="Закрити" onClick={() => setSheet(null)} />
          <div className="sheet" role="dialog" aria-label="Сортування">
            <div className="grab" />
            <div className="shead"><h2 className="u">Сортування</h2><button className="textbtn" onClick={() => setSheet(null)}>Готово</button></div>
            <div style={{ marginTop: 8 }}>
              {SORTS.map(s => {
                const on = s.k === sortKey
                return (
                  <button key={s.k} className="opt" aria-pressed={on} onClick={() => setSortKey(s.k)}
                    style={{ background: on ? '#3149B8' : '#EEF1FB', color: on ? '#fff' : '#1F2A5C' }}>
                    <span style={{ flex: 1 }}><b style={{ fontSize: 15.5 }}>{s.label}</b><small>{s.hint}</small></span>
                    {on && <IcCheck c="#fff" s={22} />}
                  </button>
                )
              })}
            </div>
            <div className="pills" style={{ marginTop: 12 }}>
              {(['asc', 'desc'] as Dir[]).map(dd => {
                const on = dir === dd
                return <button key={dd} aria-pressed={on} onClick={() => setDir(dd)} style={{ flex: 1, height: 48, borderRadius: 16, border: on ? 0 : '1.5px solid #B7C3EE', background: on ? '#1F2A5C' : '#fff', color: on ? '#fff' : '#1F2A5C', fontSize: 14, fontWeight: 600 }}>{dd === 'asc' ? cur.a : cur.b}</button>
              })}
            </div>
            <button className="dashed" style={{ marginTop: 12 }} onClick={() => { setSortKey('manual'); setDir('asc'); setSheet(null); setReorder(true) }}>
              <IcGrip />Розставити вручну
            </button>
          </div>
        </div>
      )}

      {sheet === 'filters' && (
        <div className="overlay">
          <button className="bg" aria-label="Закрити" onClick={() => setSheet(null)} />
          <div className="sheet" role="dialog" aria-label="Фільтри">
            <div className="grab" />
            <div className="shead"><h2 className="u">Фільтри</h2>
              <button className="textbtn" style={{ color: 'var(--mute)' }} onClick={() => setFilters({ ...filters, oven: 'any', maxTime: 0, tags: [] })}>Скинути</button></div>
            <div className="lbl">Духовка</div>
            <div className="pills">
              {([['any', 'Не важливо'], ['yes', 'Потрібна'], ['no', 'Без неї']] as const).map(([k, l], i) =>
                <button key={k} className="pill" aria-pressed={filters.oven === k} style={pillStyle(filters.oven === k, i)} onClick={() => setFilters({ ...filters, oven: k })}>{l}</button>)}
            </div>
            <div className="lbl">Час приготування</div>
            <div className="pills">
              {([[0, 'Будь-який'], [30, 'до 30 хв'], [60, 'до 60 хв']] as const).map(([k, l], i) =>
                <button key={k} className="pill" aria-pressed={filters.maxTime === k} style={pillStyle(filters.maxTime === k, i)} onClick={() => setFilters({ ...filters, maxTime: k })}>{l}</button>)}
            </div>
            <div className="lbl">Смак</div>
            <div className="pills">
              {TASTES.map((t, i) => {
                const on = filters.tags.includes(t)
                return <button key={t} className="pill" aria-pressed={on} style={pillStyle(on, i)}
                  onClick={() => setFilters({ ...filters, tags: on ? filters.tags.filter(x => x !== t) : [...filters.tags, t] })}>{t}</button>
              })}
            </div>
            <button className="primary" style={{ marginTop: 20 }} onClick={() => setSheet(null)}>Показати {visible.length}</button>
          </div>
        </div>
      )}
    </div>
  )
}
