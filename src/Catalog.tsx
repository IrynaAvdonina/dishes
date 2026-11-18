import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { DndContext, PointerSensor, TouchSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db } from './db'
import { ROLE_LABEL, type Dish, type MainRole } from './types'
import { useTastes } from './tastesData'
import { activeFilterCount, coverage, matchesSearch, mergeFilters, norm, pantrySet, passes, plural, requiredNames, sortDishes, type Dir, type Filters, type SortKey } from './logic'
import Thumb from './Thumb'
import { useKeepScroll, useScreenState } from './keepScroll'
import { RatingView } from './Rating'
import Tabs from './Tabs'
import { ROLES, pillStyle } from './ui'
import { IcBackup, IcChevron, IcCheck, RoleGlyph, IcEyeOff, IcFilter, IcGrip, IcPlus, IcSearch, IcSort } from './icons'
import BackupSheet from './Backup'

const SORTS: { k: SortKey; label: string; short: string; hint: string; a: string; b: string }[] = [
  { k: 'manual', label: 'Мій порядок', short: 'Мій', hint: 'Так, як ви розставили вручну', a: 'За вашим порядком', b: 'У зворотному' },
  { k: 'time', label: 'За часом', short: 'Час', hint: 'Від швидких до довгих', a: 'Спершу швидкі', b: 'Спершу довгі' },
  { k: 'have', label: 'За наявністю', short: 'Є', hint: 'Від страв, для яких усе є вдома, до тих, де нічого немає', a: 'Спершу все є', b: 'Спершу нічого немає' },
  { k: 'name', label: 'За назвою', short: 'А–Я', hint: 'За алфавітом', a: 'А → Я', b: 'Я → А' },
  { k: 'love', label: 'Найулюбленіші', short: '♥', hint: 'За сердечками; без оцінки — у кінці', a: 'Спершу улюблені', b: 'Спершу найменш улюблені' },
  { k: 'effort', label: 'Найпростіші', short: '★', hint: 'За зірочками складності; без оцінки — у кінці', a: 'Спершу прості', b: 'Спершу складні' }
]

function load<T>(k: string, d: T): T {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : d } catch { return d }
}

function RowBody({ d, pantry, sortKey }: { d: Dish; pantry: Set<string>; sortKey: SortKey }) {
  // «є» — що з обов'язкового вже вдома (разом із замінами), «немає» — чого не закрити навіть заміною
  const cov = coverage(d.ingredients, pantry)
  const have = [...cov.have, ...cov.subs.map(s => `${s.name} → ${s.sub}`)]
  return (
    <>
      <Thumb dish={d} />
      <Link to={`/dish/${d.id}`} className="dinfo">
        <div className="dname">{d.name}</div>
        <div className="dsub">
          {sortKey === 'time' && <b>{d.timeMin} хв</b>}
          {sortKey === 'have' && <b style={{ color: cov.missing.length ? 'var(--mute)' : '#2F6B3A' }}>є {have.length} з {have.length + cov.missing.length}</b>}
          {sortKey === 'love' && (d.love ? <RatingView kind="love" value={d.love} s={14} /> : <span>без оцінки</span>)}
          {sortKey === 'effort' && (d.effort ? <RatingView kind="effort" value={d.effort} s={14} /> : <span>без оцінки</span>)}
        </div>
        <div className="dreq">
          {have.length > 0 && <div className="have">є: {have.join(', ')}</div>}
          {cov.missing.length > 0 && <div className="lack">немає: {cov.missing.join(', ')}</div>}
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

  // пошук і «Приховані» пам'ятаються, коли відкриваєш страву й повертаєшся
  const [q, setQ] = useScreenState('catalog.q', '')
  const [filters, setFiltersS] = useState<Filters>(() => mergeFilters(load<Partial<Filters> | null>('filters', null)))
  const tastes = useTastes()
  // старе збережене сортування «за кількістю інгредієнтів» замінене на «за наявністю»
  const [sortKey, setSortKeyS] = useState<SortKey>(() => { const k = load<string>('sortKey', 'manual'); return (k === 'ing' ? 'have' : k) as SortKey })
  const [dir, setDirS] = useState<Dir>(() => load('dir', 'asc'))
  const [sheet, setSheet] = useState<'sort' | 'filters' | 'backup' | null>(null)
  const [reorder, setReorder] = useState(false)
  const [showHidden, setShowHidden] = useScreenState('catalog.hidden', false)
  // перемикач угорі: обіди й вечері або сніданки (запам'ятовується)
  const [meal, setMealS] = useState<'main' | 'breakfast'>(() => load('meal', 'main'))
  const setMeal = (m: 'main' | 'breakfast') => { setMealS(m); save('meal', m) }
  // пошук, пілюлі й рядок «N страв · сортування» можна сховати кнопкою в заголовку (стан запам'ятовується)
  const [shut, setShutS] = useState<boolean>(() => load('panelShut', false))
  const setShut = (v: boolean) => { setShutS(v); save('panelShut', v) }
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

  const keep = useKeepScroll('catalog', !!all)
  if (!all) return null
  const inMeal = (d: Dish) => meal === 'breakfast' ? d.role === 'breakfast' : d.role !== 'breakfast'
  const mealCount = (m: 'main' | 'breakfast') => all.filter(d => !d.hiddenAt && (m === 'breakfast') === (d.role === 'breakfast')).length
  const hidden = all.filter(d => d.hiddenAt && inMeal(d))
  const needle = norm(q)
  // смаки, яких уже немає в списку (видалені у «Продуктах»), у фільтрі не враховуємо
  const live = { ...filters, tags: filters.tags.filter(t => tastes.includes(t)) }
  const withPending = pendingOrder ? all.map(d => pendingOrder.has(d.id!) ? { ...d, order: pendingOrder.get(d.id!)! } : d) : all
  const visible = sortDishes(
    withPending.filter(d => !d.hiddenAt && inMeal(d) && passes(d, live) && matchesSearch(d, needle)),
    sortKey, dir, pantry)
  const cur = SORTS.find(s => s.k === sortKey)!
  const fcount = activeFilterCount(live)
  // чи щось вибрано в схованій панелі (щоб показати крапку на кнопці)
  const panelBusy = !!needle || fcount > 0 || (meal === 'main' && !(filters.roles.side && filters.roles.protein && filters.roles.full))

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

  const toggleRole = (r: MainRole) => {
    const n = { ...filters.roles, [r]: !filters.roles[r] }
    if (n.side || n.protein || n.full) setFilters({ ...filters, roles: n })
  }
  const countOf = (r: MainRole) => all.filter(d => d.role === r && !d.hiddenAt).length

  return (
    <div className="app">
      <header className="top">
        <h1 className="u">Страви</h1>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--mute)' }}>
          {mealCount(meal)} стр.
          <button className="iconbtn" aria-label="Резервна копія: зберегти або відновити дані" onClick={() => setSheet('backup')}><IcBackup /></button>
          {!reorder && (
            <button className="iconbtn" style={{ position: 'relative', borderRadius: '14px 4px 14px 14px' }} aria-expanded={!shut}
              aria-label={shut ? `Показати пошук і фільтри${panelBusy ? ' (є вибрані)' : ''}` : 'Сховати пошук і фільтри'} onClick={() => setShut(!shut)}>
              <IcChevron up={!shut} />
              {shut && panelBusy && <span aria-hidden="true" style={{ position: 'absolute', right: 6, top: 6, width: 9, height: 9, borderRadius: '50%', background: '#F5A97F', border: '2px solid #EEF1FB' }} />}
            </button>
          )}
        </span>
      </header>
      <div className="scallop" />

      {/* обіди й вечері / сніданки */}
      {!reorder && (
        <div className="meal-switch" role="radiogroup" aria-label="Які страви показати">
          {([['main', 'Обід і вечеря'], ['breakfast', 'Сніданки']] as const).map(([k, l], i) => {
            const on = meal === k
            return (
              <button key={k} role="radio" aria-checked={on} onClick={() => setMeal(k)}
                style={{ borderRadius: i ? '4px 18px 18px 18px' : '18px 18px 4px 18px', background: on ? 'var(--cobalt)' : 'var(--soft)', color: on ? '#fff' : 'var(--mute)' }}>
                {k === 'breakfast' && <RoleGlyph role="breakfast" s={16} />}{l}<span style={{ opacity: .7, fontWeight: 500 }}>{mealCount(k)}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className={'collapse' + (shut && !reorder ? ' shut' : '')}><div inert={shut && !reorder}>
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

      {!reorder ? (meal === 'breakfast' ? <div style={{ height: 6 }} /> : (
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
      )) : (
        <div className="banner">
          <span>Тримайте ручку і перетягніть рядок на нове місце</span>
          <button onClick={() => setReorder(false)} style={{ height: 36, border: 0, borderRadius: '18px 18px 4px 18px', background: 'var(--cobalt)', color: '#fff', padding: '0 16px', fontSize: 14, fontWeight: 600 }}>Готово</button>
        </div>
      )}

      <div className="meta">{visible.length} {plural(visible.length, 'страва', 'страви', 'страв')} · {cur.label}</div>
      </div></div>

      <div className="scroll list" ref={keep.ref} onScroll={keep.onScroll}>
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

        {visible.length === 0 && meal === 'breakfast' && !all.some(inMeal) ? (
          <div className="empty"><div className="u" style={{ fontSize: 16, color: 'var(--cobalt)' }}>Сніданків поки немає</div>
            <div style={{ fontSize: 13.5, color: 'var(--mute)', marginTop: 6, lineHeight: 1.4 }}>Додайте сніданок кнопкою «+»</div></div>
        ) : visible.length === 0 && (all.length === 0 ? (
          <div className="empty"><div className="u" style={{ fontSize: 16, color: 'var(--cobalt)' }}>Каталог порожній</div>
            <div style={{ fontSize: 13.5, color: 'var(--mute)', marginTop: 6, lineHeight: 1.4 }}>Додайте страву кнопкою «+» або відновіть дані з резервної копії (кнопка вгорі праворуч)</div></div>
        ) : (
          <div className="empty"><div className="u" style={{ fontSize: 16, color: 'var(--cobalt)' }}>Нічого не знайшли</div>
            <div style={{ fontSize: 13.5, color: 'var(--mute)', marginTop: 6, lineHeight: 1.4 }}>Послабте фільтри або поверніть приховані страви</div></div>
        ))}

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

      {!reorder && <Link to={meal === 'breakfast' ? '/new?meal=breakfast' : '/new'} className="fab" aria-label={meal === 'breakfast' ? 'Новий сніданок' : 'Нова страва'}><IcPlus /></Link>}
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
              {tastes.map((t, i) => {
                const on = filters.tags.includes(t)
                return <button key={t} className="pill" aria-pressed={on} style={pillStyle(on, i)}
                  onClick={() => setFilters({ ...filters, tags: on ? filters.tags.filter(x => x !== t) : [...filters.tags, t] })}>{t}</button>
              })}
            </div>
            <button className="primary" style={{ marginTop: 20 }} onClick={() => setSheet(null)}>Показати {visible.length}</button>
          </div>
        </div>
      )}

      {sheet === 'backup' && <BackupSheet onClose={() => setSheet(null)} />}
    </div>
  )
}
