import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { db } from './db'
import { ROLE_LABEL } from './types'
import { useTastes } from './tastesData'
import { knownNames, similarNames } from './logic'
import { draftSignature, emptyDraft, emptyItem, fromDraft, newKey, toDraft, validate, type Draft, type Errors, type ItemDraft } from './draft'
import { compressPhoto } from './photo'
import { RatingInput } from './Rating'
import { shapeOf, tintOf, usePhotoUrls } from './Thumb'
import { ROLES, canGoBack, pillStyle } from './ui'
import { IcBack, IcCamera, IcCheck, IcClose, IcPlate, IcPlus, IcTrash, RoleGlyph } from './icons'

/** Аркуш підтвердження знизу екрана. */
function Confirm({ title, text, yes, no, danger, onYes, onNo }: {
  title: string; text: string; yes: string; no: string; danger?: boolean; onYes: () => void; onNo: () => void
}) {
  return (
    <div className="overlay">
      <button className="bg" aria-label={no} onClick={onNo} />
      <div className="sheet" role="alertdialog" aria-label={title}>
        <div className="grab" />
        <h2 className="u">{title}</h2>
        <div style={{ fontSize: 14.5, color: 'var(--mute)', lineHeight: 1.4, margin: '10px 0 18px' }}>{text}</div>
        <button className="primary" onClick={onYes} style={danger ? { background: 'var(--warn)' } : undefined}>{yes}</button>
        <button className="dashed" style={{ marginTop: 10 }} onClick={onNo}>{no}</button>
      </div>
    </div>
  )
}

/** Один інгредієнт (або група «або»). */
function ItemEditor({ it, n, where = '', known, onChange, onRemove }: { it: ItemDraft; n: number; where?: string; known: string[]; onChange: (it: ItemDraft) => void; onRemove: () => void }) {
  const setName = (j: number, v: string) => onChange({ ...it, names: it.names.map((x, k) => k === j ? v : x) })
  const [focused, setFocused] = useState<number | null>(null)
  const label = it.names[0] || `Інгредієнт ${n}`
  return (
    <div className="icard">
      {it.names.map((name, j) => {
        // підказка, якщо такий продукт уже записаний трохи інакше (щоб не було «яйце» і «яйця»)
        const alike = focused === j ? [] : similarNames(name, known)
        return (<div key={j}>
        <div className="irow">
          {j > 0 && <span className="or">або</span>}
          <input className="inp" value={name} onChange={e => setName(j, e.target.value)} autoCapitalize="none" list="ing-names"
            onFocus={() => setFocused(j)} onBlur={() => setFocused(null)}
            placeholder={j ? 'інший інгредієнт' : 'Інгредієнт'} aria-label={j ? `Альтернатива ${j} до «${it.names[0]}»` : `Назва інгредієнта ${n}${where}`} />
          {j === 0
            ? <button className="iconbtn" aria-label={`Прибрати інгредієнт: ${label}`} onClick={onRemove}><IcClose /></button>
            : <button className="iconbtn" aria-label={`Прибрати альтернативу: ${name || j}`} onClick={() => onChange({ ...it, names: it.names.filter((_, k) => k !== j) })}><IcClose /></button>}
        </div>
        {alike.length > 0 && (
          <div className="irow" style={{ flexWrap: 'wrap', gap: 4, margin: '2px 0 0 4px', fontSize: 13, color: 'var(--mute)' }}>
            <span>Вже є схожий:</span>
            {alike.map(a => <button key={a} className="textbtn" style={{ textDecoration: 'underline' }} onClick={() => setName(j, a)} aria-label={`Замінити «${name}» на «${a}»`}>{a}</button>)}
          </div>
        )}
        </div>)
      })}
      <div className="pills" style={{ alignItems: 'center' }}>
        {([[true, 'Обов’язковий'], [false, 'За бажанням']] as const).map(([v, l], i) =>
          <button key={l} className="small" aria-pressed={it.required === v} style={pillStyle(it.required === v, i)} onClick={() => onChange({ ...it, required: v })}>{l}</button>)}
        <button className="textbtn" style={{ marginLeft: 'auto' }} onClick={() => onChange({ ...it, names: [...it.names, ''] })} aria-label={`Додати альтернативу «або» до: ${label}`}>+ або</button>
      </div>
      <div className="irow">
        <span className="or" style={{ width: 'auto', paddingLeft: 4 }}>заміни:</span>
        <input className="inp" value={it.replacements} onChange={e => onChange({ ...it, replacements: e.target.value })}
          placeholder="якщо немає, через кому" aria-label={`Заміни для: ${label}`} />
      </div>
    </div>
  )
}

function ItemsList({ items, onChange, addLabel, where, known }: { items: ItemDraft[]; onChange: (items: ItemDraft[]) => void; addLabel: string; where?: string; known: string[] }) {
  return (
    <>
      {items.map((it, i) => (
        <ItemEditor key={it.key} it={it} n={i + 1} where={where} known={known}
          onChange={v => onChange(items.map(x => x.key === it.key ? v : x))}
          onRemove={() => onChange(items.filter(x => x.key !== it.key))} />
      ))}
      <button className="dashed" style={{ marginTop: 10, height: 48, fontSize: 14.5 }} onClick={() => onChange([...items, emptyItem()])}><IcPlus c="#3149B8" s={18} />{addLabel}</button>
    </>
  )
}


export default function DishForm() {
  const params = useParams()
  const id = params.id ? Number(params.id) : null
  const nav = useNavigate()
  const tastes = useTastes()
  // відомі назви продуктів: для підказок при введенні інгредієнтів
  const allDishes = useLiveQuery(() => db.dishes.toArray(), [])
  const pantryRows = useLiveQuery(() => db.pantry.toArray(), [])
  const known = useMemo(() => knownNames(allDishes ?? [], pantryRows ?? []), [allDishes, pantryRows])

  const [status, setStatus] = useState<'loading' | 'missing' | 'ready'>(id ? 'loading' : 'ready')
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const initial = useRef({ sig: draftSignature(emptyDraft()), photos: [] as Blob[] })
  const [errors, setErrors] = useState<Errors>({})
  const [tried, setTried] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const allowLeave = useRef(false)

  useEffect(() => {
    if (!id) return
    let alive = true
    db.dishes.get(id).then(d => {
      if (!alive) return
      if (!d) { setStatus('missing'); return }
      const dr = toDraft(d)
      if (!dr.items.length) dr.items = [emptyItem()]
      initial.current = { sig: draftSignature(dr), photos: dr.photos }
      setDraft(dr)
      setStatus('ready')
    })
    return () => { alive = false }
  }, [id])

  const dirty = status === 'ready' && (draftSignature(draft) !== initial.current.sig
    || draft.photos.length !== initial.current.photos.length || draft.photos.some((p, i) => p !== initial.current.photos[i]))

  // захист від втрати змін: кнопка «назад» на телефоні, жест, закриття вкладки
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirty && !allowLeave.current && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft(d => {
      const next = { ...d, [k]: v }
      if (tried) setErrors(validate(next))
      return next
    })
  }
  const toggleTag = (t: string) => setDraft(d => ({ ...d, tags: d.tags.includes(t) ? d.tags.filter(x => x !== t) : [...d.tags, t] }))
  const urls = usePhotoUrls(draft.photos)
  const [bg, ink] = tintOf(id ?? 0)

  const leave = (after: () => void) => { allowLeave.current = true; after() }
  const goBack = () => canGoBack() ? nav(-1) : nav(id ? `/dish/${id}` : '/', { replace: true })

  const save = async () => {
    const e = validate(draft)
    setErrors(e); setTried(true)
    const first = Object.keys(e)[0]
    if (first) { document.getElementById(`f-${first}`)?.focus(); document.getElementById(`f-${first}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return }
    const fields = fromDraft(draft)
    if (id) {
      await db.dishes.update(id, fields)
      leave(goBack)
    } else {
      const last = await db.dishes.orderBy('order').last()
      const newId = await db.dishes.add({ ...fields, pairs: [], order: (last?.order ?? -1) + 1 })
      leave(() => nav(`/dish/${newId}`, { replace: true }))
    }
  }

  const remove = async () => {
    if (!id) return
    await db.transaction('rw', db.dishes, async () => {
      await db.dishes.delete(id)
      await db.dishes.filter(d => d.pairs.includes(id)).modify(d => { d.pairs = d.pairs.filter(p => p !== id) })
    })
    // з форми повертаємось одразу в каталог (через сторінку видаленої страви не йдемо)
    leave(() => canGoBack(2) ? nav(-2) : nav('/', { replace: true }))
  }

  // нові фото додаються в кінець; перше — обкладинка
  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    const added = await Promise.all([...files].map(f => compressPhoto(f)))
    setDraft(d => ({ ...d, photos: [...d.photos, ...added] }))
  }
  const removePhoto = (i: number) => setDraft(d => ({ ...d, photos: d.photos.filter((_, k) => k !== i) }))
  const coverPhoto = (i: number) => setDraft(d => ({ ...d, photos: [d.photos[i], ...d.photos.filter((_, k) => k !== i)] }))

  if (status === 'loading') return null
  if (status === 'missing') return (
    <div className="app">
      <div className="empty" style={{ margin: '40px 20px' }}>
        <div className="u" style={{ fontSize: 16, color: 'var(--cobalt)' }}>Страву не знайдено</div>
        <button className="primary" style={{ marginTop: 16 }} onClick={() => nav('/', { replace: true })}>До каталогу</button>
      </div>
    </div>
  )

  return (
    <div className="app">
      <header className="fhead">
        <button className="backbtn" aria-label="Назад" onClick={goBack}><IcBack /></button>
        <h1 className="u">{id ? 'Редагування' : 'Нова страва'}</h1>
      </header>
      <div className="scallop" />

      {/* підказки назв у полях інгредієнтів */}
      <datalist id="ing-names">{known.map(n => <option key={n} value={n} />)}</datalist>
      <div className="scroll">
        <div className="form">
          {/* Фото */}
          <div className="photos-row" style={{ marginTop: 16 }}>
            {urls.length === 0 && <div className="ptile" style={{ background: bg, borderRadius: shapeOf(id ?? 0) }}><IcPlate c={ink} /></div>}
            {urls.map((u, i) => (
              <div key={u} className="pslot">
                <div className="ptile" style={{ background: bg, borderRadius: shapeOf((id ?? 0) + i) }}>
                  <img src={u} alt={`Фото ${i + 1}${i === 0 ? ', обкладинка' : ''}`} />
                </div>
                <button className="pdel" aria-label={`Прибрати фото ${i + 1}`} onClick={() => removePhoto(i)}><IcClose c="#fff" /></button>
                {i === 0
                  ? <span className="pcap">обкладинка</span>
                  : <button className="textbtn pcap" style={{ height: 32 }} onClick={() => coverPhoto(i)} aria-label={`Зробити фото ${i + 1} обкладинкою`}>на обкладинку</button>}
              </div>
            ))}
            <label className="pbtn" style={{ alignSelf: 'center', flex: 'none' }}><IcCamera />{urls.length ? 'Ще фото' : 'Додати фото'}
              <input type="file" accept="image/*" multiple hidden onChange={e => { addPhotos(e.target.files); e.target.value = '' }} /></label>
          </div>

          {/* Назва */}
          <h2 className="u">Назва</h2>
          <input id="f-name" className="inp" value={draft.name} onChange={e => set('name', e.target.value)} placeholder="Наприклад, гречка з грибами"
            aria-label="Назва страви" aria-invalid={!!errors.name} />
          {errors.name && <div className="err">{errors.name}</div>}

          {/* Роль */}
          <h2 className="u">Роль</h2>
          <div className="hint">Гарнір і білок можна складати в пари, повна страва — сама по собі.</div>
          <div id="f-role" tabIndex={-1} className="pills" role="radiogroup" aria-label="Роль страви" style={{ outline: 'none' }}>
            {ROLES.map(r => {
              const on = draft.role === r.k
              return (
                <button key={r.k} className="chip" role="radio" aria-checked={on} onClick={() => set('role', r.k)}
                  style={{ flex: '1 1 0', minWidth: 0, padding: '0 10px', borderRadius: r.r, border: `1.5px ${on ? 'solid' : 'dashed'} ${r.dot}`, background: on ? r.dot : r.bg, color: on ? '#1F2A5C' : '#4A5690' }}>
                  {on ? <IcCheck /> : <RoleGlyph role={r.k} s={14} />}<span>{ROLE_LABEL[r.k]}</span>
                </button>
              )
            })}
          </div>
          {errors.role && <div className="err">{errors.role}</div>}

          {/* Час і духовка */}
          <h2 className="u">Час і духовка</h2>
          <div className="irow" style={{ marginTop: 8 }}>
            <input id="f-timeMin" className="inp" style={{ width: 110, flex: 'none' }} inputMode="numeric" value={draft.timeMin}
              onChange={e => set('timeMin', e.target.value.replace(/[^\d]/g, ''))} placeholder="30" aria-label="Час приготування, хвилин" aria-invalid={!!errors.timeMin} />
            <span style={{ fontSize: 15, color: 'var(--mute)' }}>хв</span>
          </div>
          {errors.timeMin && <div className="err">{errors.timeMin}</div>}
          <div className="lbl">Духовка</div>
          <div className="pills">
            {([[true, 'Потрібна'], [false, 'Не потрібна']] as const).map(([v, l], i) =>
              <button key={l} className="pill" aria-pressed={draft.oven === v} style={pillStyle(draft.oven === v, i)} onClick={() => set('oven', v)}>{l}</button>)}
          </div>

          {/* Оцінки */}
          <h2 className="u">Оцінка</h2>
          <div className="hint">Необов'язково. Натисніть ще раз, щоб прибрати.</div>
          <RatingInput kind="effort" value={draft.effort} onChange={v => set('effort', v)} />
          <div style={{ height: 6 }} />
          <RatingInput kind="love" value={draft.love} onChange={v => set('love', v)} />

          {/* Смак */}
          <h2 className="u">Смак</h2>
          <div className="hint">Список смаків змінюється у вкладці «Продукти».</div>
          <div className="pills" style={{ marginTop: 8 }}>
            {[...tastes, ...draft.tags.filter(t => !tastes.includes(t))].map((t, i) => {
              const on = draft.tags.includes(t)
              return <button key={t} className="pill" aria-pressed={on} style={pillStyle(on, i)}
                onClick={() => toggleTag(t)}>{t}</button>
            })}
          </div>

          {/* Інгредієнти */}
          <h2 className="u">Інгредієнти</h2>
          <div className="hint">«+ або» — коли підходить будь-який із кількох (кріп або петрушка). Заміни показуються, якщо продукту немає.</div>
          <ItemsList known={known} items={draft.items} onChange={v => set('items', v)} addLabel="Додати інгредієнт" />

          {/* Варіанти */}
          <h2 className="u">Варіанти</h2>
          <div className="hint">Необов'язково. Наприклад: «Класичні», «З картоплею». Перший варіант відкривається одразу; у кожному можна додати свої інгредієнти.</div>
          {draft.variants.map((v, vi) => (
            <div key={v.key} className="vcard">
              <div className="irow">
                <input className="inp" style={{ background: '#fff' }} value={v.name} placeholder={`Варіант ${vi + 1}`} aria-label={`Назва варіанта ${vi + 1}`}
                  onChange={e => set('variants', draft.variants.map(x => x.key === v.key ? { ...x, name: e.target.value } : x))} />
                <button className="iconbtn" style={{ background: '#fff' }} aria-label={`Прибрати варіант: ${v.name || vi + 1}`}
                  onClick={() => set('variants', draft.variants.filter(x => x.key !== v.key))}><IcClose /></button>
              </div>
              {v.items.length > 0 && <div className="lbl" style={{ margin: '10px 0 0' }}>Додатково для цього варіанта</div>}
              <ItemsList known={known} items={v.items} addLabel="Інгредієнт для варіанта" where={` (варіант ${vi + 1})`}
                onChange={items => set('variants', draft.variants.map(x => x.key === v.key ? { ...x, items } : x))} />
            </div>
          ))}
          <button className="dashed" style={{ marginTop: 12, height: 48, fontSize: 14.5 }}
            onClick={() => set('variants', [...draft.variants, { key: newKey(), id: newKey(), name: '', items: [] }])}><IcPlus c="#3149B8" s={18} />Додати варіант</button>

          <div style={{ height: 40 }} />
        </div>
      </div>

      <div className="bottombar">
        {id && <button aria-label="Видалити страву" onClick={() => setConfirmDelete(true)}
          style={{ flex: 'none', width: 56, height: 56, border: '1.5px solid #F2B79A', borderRadius: '18px 4px 18px 18px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IcTrash /></button>}
        <button className="primary" style={{ flex: 1, width: 'auto', height: 56 }} onClick={save}>
          {Object.keys(errors).length ? 'Перевірте поля' : id ? 'Зберегти' : 'Додати страву'}
        </button>
      </div>

      {confirmDelete && <Confirm title="Видалити страву?" text={`«${draft.name || 'Без назви'}» зникне з каталогу разом із фото. Цю дію не можна скасувати. Якщо хочете лише сховати страву на час — скористайтеся приховуванням.`}
        yes="Видалити" no="Залишити" danger onYes={remove} onNo={() => setConfirmDelete(false)} />}
      {blocker.state === 'blocked' && <Confirm title="Вийти без збереження?" text="Зміни в цій страві не збережуться."
        yes="Вийти без збереження" no="Продовжити редагування" danger onYes={() => blocker.proceed()} onNo={() => blocker.reset()} />}
    </div>
  )
}

