import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { Dish } from './types'
import { bestMatch, norm, pantrySet, plural, type Match } from './logic'
import { addPair, listPairs, removePair } from './pairsData'
import { MiniThumb } from './Thumb'
import DishPicker from './DishPicker'
import Tabs from './Tabs'
import { IcClose, IcPlus } from './icons'

interface PairInfo { key: string; side: Dish; protein: Dish; ms: Match; mp: Match; missing: string[]; subs: string[] }

const dishLink = (m: Match) => `/dish/${m.dish.id}` + (m.variant && m.dish.variants.length > 1 ? `?v=${encodeURIComponent(m.variant.id)}` : '')

function PairRow({ p, onRemove, big }: { p: PairInfo; onRemove?: () => void; big?: boolean }) {
  return (
    <div className="irow" style={{ alignItems: 'flex-start', gap: 10, padding: '12px 0', borderBottom: big ? 0 : '1px solid var(--line)' }}>
      <div style={{ display: 'flex', flex: 'none' }}>
        <MiniThumb dish={p.side} size={big ? 60 : 48} />
        <div style={{ marginLeft: 4 }}><MiniThumb dish={p.protein} size={big ? 60 : 48} /></div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link to={dishLink(p.ms)} style={{ display: 'block', fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>{p.side.name}</Link>
        <Link to={dishLink(p.mp)} style={{ display: 'block', fontSize: 15, fontWeight: 600, lineHeight: 1.3, marginTop: 2 }}><span style={{ color: 'var(--mute)' }}>+ </span>{p.protein.name}</Link>
        <div style={{ fontSize: 12.5, lineHeight: 1.35, marginTop: 4 }}>
          {p.missing.length === 0 && p.subs.length === 0 && <span style={{ color: '#2F6B3A', fontWeight: 600 }}>Усе є вдома</span>}
          {p.subs.length > 0 && <div style={{ color: 'var(--cobalt)' }}>заміна: {p.subs.join(', ')}</div>}
          {p.missing.length > 0 && <div style={{ color: 'var(--warn)', fontWeight: 600 }}>бракує: {p.missing.join(', ')}</div>}
        </div>
      </div>
      {onRemove && <button className="iconbtn" aria-label={`Розірвати пару: ${p.side.name} і ${p.protein.name}`} onClick={onRemove}><IcClose /></button>}
    </div>
  )
}

/** Пари «гарнір + білок» і що з них можна приготувати з продуктів вдома. */
export default function Pairs() {
  const dishes = useLiveQuery(() => db.dishes.toArray(), [])
  const pantryRows = useLiveQuery(() => db.pantry.toArray(), [])
  const pantry = useMemo(() => pantrySet(pantryRows), [pantryRows])
  const [step, setStep] = useState<null | 'side' | { side: Dish }>(null)
  const [lucky, setLucky] = useState<string | null>(null)
  const [undo, setUndo] = useState<[number, number, string] | null>(null)
  const timer = useRef<number>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const pairs = useMemo<PairInfo[]>(() => {
    if (!dishes) return []
    return listPairs(dishes.filter(d => !d.hiddenAt)).map(([side, protein]) => {
      const ms = bestMatch(side, pantry)!, mp = bestMatch(protein, pantry)!
      const missing = [...new Map([...ms.cov.missing, ...mp.cov.missing].map(n => [norm(n), n])).values()]
      const subs = [...ms.cov.subs, ...mp.cov.subs].map(s => `${s.name} → ${s.sub}`)
      return { key: `${side.id}-${protein.id}`, side, protein, ms, mp, missing, subs }
    }).sort((a, b) => a.missing.length - b.missing.length || a.subs.length - b.subs.length || a.side.order - b.side.order || a.protein.order - b.protein.order)
  }, [dishes, pantry])

  if (!dishes || !pantryRows) return null

  const ready = pairs.filter(p => p.missing.length === 0)
  const other = pairs.filter(p => p.missing.length > 0)
  const luckyPair = pairs.find(p => p.key === lucky)
  const sides = dishes.filter(d => d.role === 'side' && !d.hiddenAt)
  const proteins = dishes.filter(d => d.role === 'protein' && !d.hiddenAt)

  const roll = () => {
    // з готових (або з усіх, якщо готових немає); по змозі — не ту саму пару ще раз
    const base = ready.length ? ready : pairs
    const pool = base.length > 1 ? base.filter(p => p.key !== lucky) : base
    setLucky(pool[Math.floor(Math.random() * pool.length)]?.key ?? null)
  }
  const remove = async (p: PairInfo) => {
    await removePair(p.side.id!, p.protein.id!)
    if (lucky === p.key) setLucky(null)
    setUndo([p.side.id!, p.protein.id!, `${p.side.name} + ${p.protein.name}`])
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setUndo(null), 5000)
  }
  const restore = async () => { if (undo) await addPair(undo[0], undo[1]); setUndo(null) }

  const title = (t: string, n: number) => (
    <h2 className="u" style={{ margin: '22px 0 0', fontSize: 17, color: 'var(--cobalt)' }}>{t} <span style={{ fontSize: 13, color: 'var(--mute)', fontFamily: 'Onest, sans-serif' }}>{n}</span></h2>
  )

  return (
    <div className="app">
      <header className="top">
        <h1 className="u">Пари</h1>
        <span style={{ fontSize: 13, color: 'var(--mute)' }}>{pairs.length} {plural(pairs.length, 'пара', 'пари', 'пар')}</span>
      </header>
      <div className="scallop" />

      <div className="scroll" style={{ padding: '0 20px' }}>
        <div className="hint" style={{ marginTop: 12 }}>Гарнір + білок, які добре поєднуються. Стан рахується за вашими продуктами вдома.</div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="dashed" style={{ flex: 1, height: 48, fontSize: 14.5 }} onClick={() => setStep('side')}><IcPlus c="#3149B8" s={18} />Нова пара</button>
          {pairs.length > 1 && <button className="primary" style={{ flex: 1, width: 'auto', height: 48, fontSize: 14.5 }} onClick={roll}>{luckyPair ? 'Ще раз' : 'Навмання'}</button>}
        </div>

        {luckyPair && (
          <div className="vcard" style={{ marginTop: 14, background: 'var(--soft)' }} role="status">
            <div className="lbl" style={{ margin: 0 }}>{ready.length ? 'Можна приготувати сьогодні' : 'Найближче до готового'}</div>
            <PairRow p={luckyPair} big />
          </div>
        )}

        {pairs.length === 0 ? (
          <div className="empty">
            <div className="u" style={{ fontSize: 16, color: 'var(--cobalt)' }}>Пар ще немає</div>
            <div style={{ fontSize: 13.5, color: 'var(--mute)', marginTop: 6, lineHeight: 1.4 }}>Натисніть «Нова пара» або відкрийте гарнір чи білок і додайте пару внизу сторінки.</div>
          </div>
        ) : (<>
          {ready.length > 0 && title('Можна приготувати зараз', ready.length)}
          {ready.map(p => <PairRow key={p.key} p={p} onRemove={() => remove(p)} />)}
          {other.length > 0 && title(ready.length ? 'Чогось бракує' : 'Усі пари', other.length)}
          {other.map(p => <PairRow key={p.key} p={p} onRemove={() => remove(p)} />)}
        </>)}
        <div style={{ height: 90 }} />
      </div>

      {step === 'side' && (
        <DishPicker title="Оберіть гарнір" hint="Крок 1 з 2" dishes={sides} done="Скасувати"
          onPick={d => setStep({ side: d })} onClose={() => setStep(null)} />
      )}
      {step && typeof step === 'object' && (
        <DishPicker title="Оберіть білок" hint={`Крок 2 з 2: до «${step.side.name}»`} done="Скасувати"
          dishes={proteins.filter(p => !step.side.pairs.includes(p.id!))}
          onPick={async d => { await addPair(step.side.id!, d.id!); setStep(null) }} onClose={() => setStep(null)} />
      )}

      {undo && (
        <div role="status" className="toast">
          <span style={{ flex: 1, minWidth: 0 }}>Пару розірвано: <b>{undo[2]}</b></span>
          <button className="textbtn" style={{ color: '#fff', textDecoration: 'underline' }} onClick={restore}>Повернути</button>
        </div>
      )}
      <Tabs />
    </div>
  )
}
