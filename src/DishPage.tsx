import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { ROLE_LABEL, type Dish, type Ingredient } from './types'
import { isStaple, missing, norm, pantrySet } from './logic'
import { MiniThumb, tintOf, usePhotoUrl } from './Thumb'
import DishPicker from './DishPicker'
import { addPair, partnerRole, removePair } from './pairsData'
import { compressPhoto } from './photo'
import { RATE, RatingView } from './Rating'
import { canGoBack } from './ui'
import { IcBack, IcCamera, IcCheck, IcClose, IcEyeOff, IcOven, IcPlate, IcPlus, IcSwap, RoleGlyph } from './icons'

const ROLE_BG = { side: '#F6D96B', protein: '#F5A97F', full: '#9FB1EE' }
const TAGC: [string, string][] = [['#E3F1E4', '#2F6B3A'], ['#F6E4F0', '#8A3C74'], ['#E8F3F6', '#2D6577'], ['#FDF4CF', '#8A6B00'], ['#FDE6D8', '#9A4A1C']]

export default function DishPage() {
  const id = Number(useParams().id)
  const nav = useNavigate()
  // undefined — ще завантажується, null — такої страви немає
  const dish = useLiveQuery(async () => (await db.dishes.get(id)) ?? null, [id])
  const pantryRows = useLiveQuery(() => db.pantry.toArray(), [])
  const pantry = useMemo(() => pantrySet(pantryRows), [pantryRows])
  // ?v=… — варіант, з яким страву відкрили (напр. з пошуку)
  const [params] = useSearchParams()
  const [variantId, setVariantId] = useState<string | null>(params.get('v'))
  const [open, setOpen] = useState<string | null>(null)
  const [chosen, setChosen] = useState<Record<string, string | null>>({})
  const [picking, setPicking] = useState(false)
  const all = useLiveQuery(() => db.dishes.toArray(), [])
  const url = usePhotoUrl(dish?.photo)
  // якщо сторінку відкрито напряму (без історії), «назад» веде в каталог, а не з застосунку
  const goBack = () => canGoBack() ? nav(-1) : nav('/', { replace: true })

  if (dish === undefined) return null
  if (dish === null) return (
    <div className="app">
      <div className="empty" style={{ margin: '40px 20px' }}>
        <div className="u" style={{ fontSize: 16, color: 'var(--cobalt)' }}>Страву не знайдено</div>
        <div style={{ fontSize: 13.5, color: 'var(--mute)', marginTop: 6, lineHeight: 1.4 }}>Можливо, її видалили</div>
        <Link to="/" replace className="primary" style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>До каталогу</Link>
      </div>
    </div>
  )

  const variant = dish.variants.find(v => v.id === variantId) ?? dish.variants[0]
  const ings: Ingredient[] = [...dish.ingredients, ...(variant?.addIngredients ?? [])]
  const lackNames = missing(ings, pantry)
  const key = (g: Ingredient) => g.group ?? g.name
  const isLack = (g: Ingredient) => g.required && (g.group ? lackNames.includes(ings.filter(x => x.group === g.group).map(x => x.name).join('/')) : lackNames.includes(g.name))
  const shownGroups = new Set<string>()
  const rows = ings.filter(g => { if (!g.group) return true; if (shownGroups.has(g.group)) return false; shownGroups.add(g.group); return true })
  const lackLeft = rows.filter(g => isLack(g) && !chosen[key(g)])
  const [bg, ink] = tintOf(dish.id!)
  // пари: лише гарнір ↔ білок
  const pRole = partnerRole(dish.role)
  const partners = (all ?? []).filter(d => dish.pairs.includes(d.id!) && pRole === d.role)
  const candidates = (all ?? []).filter(d => d.role === pRole && (!d.hiddenAt || dish.pairs.includes(d.id!)))
  const togglePair = (d: Dish) => dish.pairs.includes(d.id!) ? removePair(dish.id!, d.id!) : addPair(dish.id!, d.id!)

  /** Додати продукт у «Мої продукти» або прибрати звідти (без урахування регістру). */
  const toggleProduct = async (name: string) => {
    const n = norm(name)
    const rowsHere = (pantryRows ?? []).filter(p => norm(p.name) === n)
    if (rowsHere.length) await db.pantry.bulkDelete(rowsHere.map(p => p.name))
    else await db.pantry.put({ name: name.replace(/s+/g, ' ').trim().toLowerCase() })
  }

  const addPhoto = async (f?: File | null) => { if (f) await db.dishes.update(dish.id!, { photo: await compressPhoto(f) }) }

  return (
    <div className="app">
      <div className="scroll">
        <div className="hero" style={{ background: bg, borderRadius: `0 0 48px 12px` }}>
          {url ? <img src={url} alt="" /> : <div style={{ transform: 'scale(2.3)' }}><IcPlate c={ink} /></div>}
          <button className="back" aria-label="Назад до каталогу" onClick={goBack}><IcBack /></button>
          <label className="photo"><IcCamera />Фото<input type="file" accept="image/*" hidden onChange={e => { addPhoto(e.target.files?.[0]); e.target.value = '' }} /></label>
        </div>

        <div style={{ padding: '18px 20px 0' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 32, padding: '0 14px', borderRadius: '16px 4px 16px 16px', background: ROLE_BG[dish.role], fontSize: 13, fontWeight: 600 }}>
              <RoleGlyph role={dish.role} s={14} />{ROLE_LABEL[dish.role]}
            </span>
            {/* духовку показуємо лише коли потрібна, маленькою пілюлею як роль */}
            {dish.oven && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', borderRadius: '4px 16px 16px 16px', background: '#FBE3A0', color: '#5B4A00', fontSize: 13, fontWeight: 600 }}>
                <IcOven />Духовка
              </span>
            )}
          </div>
          <h1 className="u" style={{ margin: '12px 0 0', fontSize: 24, lineHeight: 1.2, color: 'var(--cobalt)' }}>{dish.name}</h1>

          <div className="stats">
            <div className="stat" style={{ background: '#EEF1FB', borderRadius: '18px 18px 4px 18px' }}><div className="k" style={{ color: 'var(--mute)' }}>Час</div><div className="v">{dish.timeMin} хв</div></div>
            <div className="stat" style={{ background: '#E5EBFC', borderRadius: '18px 4px 18px 18px' }}><div className="k" style={{ color: 'var(--mute)' }}>Інгредієнтів</div><div className="v">{rows.length}</div></div>
          </div>
          {(dish.effort || dish.love) && (
            <div className="stats" style={{ marginTop: 8 }}>
              {(['effort', 'love'] as const).filter(k => dish[k]).map((k, i) => (
                <div key={k} className="stat" style={{ background: k === 'love' ? '#FDE6D8' : '#EEF1FB', borderRadius: i ? '18px 4px 18px 18px' : '18px 18px 18px 4px' }}>
                  <div className="k" style={{ color: k === 'love' ? '#5C2A0B' : 'var(--mute)' }}>{RATE[k].label}: {RATE[k].words[dish[k]!]}</div>
                  <div className="v"><RatingView kind={k} value={dish[k]} s={18} /></div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {dish.tags.map((t, i) => <span key={t} className="tag" style={{ background: TAGC[i % 5][0], color: TAGC[i % 5][1] }}>{t}</span>)}
          </div>

          {lackLeft.length > 0 && (
            <div className="warnbox"><b>Не вистачає:</b> {lackLeft.map(g => g.group ? ings.filter(x => x.group === g.group).map(x => x.name).join(' або ') : g.name).join(', ')}.</div>
          )}

          {dish.variants.length > 0 && (<>
            <h2 className="u" style={{ margin: '26px 0 12px', fontSize: 17, color: 'var(--cobalt)' }}>Варіанти</h2>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
              {dish.variants.map((v, i) => {
                const on = v.id === variant?.id
                return <button key={v.id} aria-pressed={on} onClick={() => setVariantId(v.id)} style={{ flex: 'none', height: 44, padding: '0 18px', fontSize: 14.5, fontWeight: 600,
                  borderRadius: ['22px 22px 4px 22px', '22px 4px 22px 22px', '4px 22px 22px 22px'][i % 3], border: on ? 0 : '1.5px dashed #B7C3EE', background: on ? '#3149B8' : '#fff', color: on ? '#fff' : '#3149B8' }}>{v.name}</button>
              })}
            </div></>)}

          <h2 className="u" style={{ margin: '26px 0 0', fontSize: 17, color: 'var(--cobalt)' }}>Інгредієнти</h2>
          <div className="scallop" style={{ marginTop: 8 }} />
          {rows.map(g => {
            const k = key(g)
            const lack = isLack(g)
            const pick = chosen[k]
            const label = g.group ? ings.filter(x => x.group === g.group).map(x => x.name).join(' або ') : g.name
            const subs = g.replacements ?? []
            // наявність можна змінити тут же: це додає/прибирає продукт у «Моїх продуктах»
            const members = g.group ? ings.filter(x => x.group === g.group) : [g]
            const home = members.some(m => pantry.has(norm(m.name)))
            const always = members.every(m => isStaple(m.name))
            const state = always ? 'є завжди' : pick ? 'Заміна' : home ? 'Є' : 'Немає'
            const col = always ? '#2F6B3A' : pick ? '#3149B8' : home ? '#2F6B3A' : g.required ? '#B4491F' : 'var(--mute)'
            const haveKey = 'have:' + k
            const onState = () => {
              if (always) return
              if (members.length > 1) { setOpen(open === haveKey ? null : haveKey); return }
              setChosen({ ...chosen, [k]: null })
              toggleProduct(g.name)
            }
            return (
              <div key={k} className="ing">
                <div className="r">
                  <span className="mark" style={{ borderRadius: lack && !pick ? 3 : '50%',
                    background: pick ? '#9FB1EE' : lack || (!home && !always) ? '#fff' : '#3F8F55',
                    border: pick ? '2px solid #3149B8' : lack ? '2px solid #C4572A' : !home && !always ? '2px solid #B7C3EE' : 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 600 }}>{label}</div>
                    {(pick || !g.required) && <div style={{ fontSize: 12.5, color: 'var(--mute)', marginTop: 2 }}>{pick ? `замість цього: ${pick}` : 'за бажанням'}</div>}
                  </div>
                  <button onClick={onState} disabled={always} aria-expanded={members.length > 1 ? open === haveKey : undefined}
                    aria-label={always ? `${label}: є завжди` : members.length > 1 ? `${label}: ${home ? 'є' : 'немає'}. Позначити, що саме є вдома` : home ? `${label}: є вдома. Натисніть, щоб прибрати з продуктів` : `${label}: немає. Натисніть, щоб позначити, що є`}
                    style={{ flex: 'none', height: 44, padding: 0, border: 0, background: 'transparent', cursor: always ? 'default' : 'pointer', display: 'flex', alignItems: 'center' }}>
                    <span style={{ minWidth: 76, height: 32, padding: '0 12px', fontSize: 13, fontWeight: 600, color: col, borderRadius: '14px 14px 4px 14px',
                      background: home || always ? '#E3F1E4' : '#fff', border: home || always ? 0 : `1.5px dashed ${g.required && !pick ? '#E3A68A' : '#B7C3EE'}`,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      {(home || always) && <IcCheck c="#2F6B3A" s={13} />}{state}
                    </span>
                  </button>
                </div>
                {lack && subs.length > 0 && (
                  <button aria-expanded={open === k} onClick={() => setOpen(open === k ? null : k)} style={{ margin: '2px 0 0 26px', height: 44, border: 0, background: 'transparent', color: 'var(--cobalt)', fontSize: 14, fontWeight: 600, padding: '0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IcSwap />{pick ? 'Інша заміна…' : 'Замінити на…'}
                  </button>
                )}
                {open === haveKey && (
                  <div style={{ margin: '2px 0 6px 26px' }}>
                    <div className="hint" style={{ margin: '0 0 6px' }}>Що з цього є вдома?</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {members.map(m => {
                        const on = pantry.has(norm(m.name))
                        return <button key={m.name} aria-pressed={on} onClick={() => { setChosen({ ...chosen, [k]: null }); toggleProduct(m.name) }}
                          style={{ height: 44, padding: '0 16px', fontSize: 14, fontWeight: 600, borderRadius: '22px 22px 4px 22px', border: on ? 0 : '1.5px dashed #B7C3EE', background: on ? '#E3F1E4' : '#fff', color: on ? '#2F6B3A' : '#3149B8', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {on && <IcCheck c="#2F6B3A" s={13} />}{m.name}</button>
                      })}
                    </div>
                  </div>
                )}
                {open === k && (
                  <div style={{ margin: '2px 0 6px 26px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[...subs].sort((a, b) => Number(pantry.has(norm(b))) - Number(pantry.has(norm(a)))).map(s => {
                      const on = pick === s
                      const home = pantry.has(norm(s))
                      return <button key={s} aria-pressed={on} aria-label={`${s}${home ? ', є вдома' : ''}`} onClick={() => { setChosen({ ...chosen, [k]: on ? null : s }); setOpen(null) }}
                        style={{ height: 44, padding: '0 16px', fontSize: 14, fontWeight: 600, borderRadius: '22px 22px 4px 22px', border: on ? 0 : '1.5px dashed #B7C3EE', background: on ? '#3149B8' : '#fff', color: on ? '#fff' : '#3149B8', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {s}{home && <span style={{ fontSize: 12, fontWeight: 600, color: on ? '#fff' : '#2F6B3A' }}>· є</span>}</button>
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {pRole && (<>
            <h2 className="u" style={{ margin: '26px 0 0', fontSize: 17, color: 'var(--cobalt)' }}>Пасує до</h2>
            <div className="scallop" style={{ marginTop: 8 }} />
            {partners.length === 0 && <div className="hint" style={{ marginTop: 10 }}>{pRole === 'protein' ? 'Додайте білок' : 'Додайте гарнір'}, з яким ця страва добре поєднується.</div>}
            {partners.map(p => (
              <div key={p.id} className="irow" style={{ minHeight: 68, borderBottom: '1px solid var(--line)', gap: 12 }}>
                <MiniThumb dish={p} size={52} />
                <Link to={`/dish/${p.id}`} style={{ flex: 1, minWidth: 0, fontSize: 15.5, fontWeight: 600, padding: '12px 0' }}>{p.name}{p.hiddenAt && <span style={{ fontSize: 12.5, color: 'var(--mute)', fontWeight: 500 }}> · прихована</span>}</Link>
                <button className="iconbtn" aria-label={`Прибрати пару: ${p.name}`} onClick={() => removePair(dish.id!, p.id!)}><IcClose /></button>
              </div>
            ))}
            <button className="dashed" style={{ marginTop: 12, height: 48, fontSize: 14.5 }} onClick={() => setPicking(true)}>
              <IcPlus c="#3149B8" s={18} />{pRole === 'protein' ? 'Додати білок до пари' : 'Додати гарнір до пари'}
            </button>
          </>)}
          <div style={{ height: 120 }} />
        </div>
      </div>

      {picking && pRole && (
        <DishPicker title={pRole === 'protein' ? 'Білок до пари' : 'Гарнір до пари'} hint={`Позначте, що пасує до «${dish.name}».`}
          dishes={candidates} selected={new Set(dish.pairs)} onPick={togglePair} onClose={() => setPicking(false)} />
      )}

      <div className="bottombar">
        <button aria-label="Приховати страву" onClick={async () => { await db.dishes.update(dish.id!, { hiddenAt: Date.now() }); goBack() }}
          style={{ flex: 'none', width: 56, height: 56, border: '1.5px solid #B7C3EE', borderRadius: '18px 4px 18px 18px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IcEyeOff /></button>
        <Link to={`/dish/${dish.id}/edit`} style={{ flex: 1, height: 56, borderRadius: '18px 18px 4px 18px', background: 'var(--cobalt)', color: '#fff', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Редагувати</Link>
      </div>
    </div>
  )
}
