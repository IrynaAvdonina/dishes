import { db } from './db'
import type { Dish, Role } from './types'

/**
 * Пари страв: гарнір + білок. Зберігаються в обох стравах (поле pairs), тобто двобічно.
 * Повна страва пар не має.
 */
export const canPair = (a: Role, b: Role) => (a === 'side' && b === 'protein') || (a === 'protein' && b === 'side')
export const partnerRole = (r: Role): Role | null => r === 'side' ? 'protein' : r === 'protein' ? 'side' : null

export async function addPair(a: number, b: number) {
  await db.transaction('rw', db.dishes, async () => {
    const [x, y] = await db.dishes.bulkGet([a, b])
    if (!x || !y || !canPair(x.role, y.role)) return
    if (!x.pairs.includes(b)) await db.dishes.update(a, { pairs: [...x.pairs, b] })
    if (!y.pairs.includes(a)) await db.dishes.update(b, { pairs: [...y.pairs, a] })
  })
}

export async function removePair(a: number, b: number) {
  await db.transaction('rw', db.dishes, async () => {
    const [x, y] = await db.dishes.bulkGet([a, b])
    if (x) await db.dishes.update(a, { pairs: x.pairs.filter(p => p !== b) })
    if (y) await db.dishes.update(b, { pairs: y.pairs.filter(p => p !== a) })
  })
}

/** Після зміни ролі: прибрати пари, які вже не «гарнір + білок». */
export async function prunePairs(id: number) {
  await db.transaction('rw', db.dishes, async () => {
    const d = await db.dishes.get(id)
    if (!d) return
    const partners = await db.dishes.bulkGet(d.pairs)
    const bad = d.pairs.filter((_, i) => !partners[i] || !canPair(d.role, partners[i]!.role))
    if (!bad.length) return
    await db.dishes.update(id, { pairs: d.pairs.filter(p => !bad.includes(p)) })
    for (const p of partners) if (p && bad.includes(p.id!)) await db.dishes.update(p.id!, { pairs: p.pairs.filter(x => x !== id) })
  })
}

/** Усі пари без повторів: [гарнір, білок]. Враховує й «однобічні» записи. */
export function listPairs(dishes: Dish[]): [Dish, Dish][] {
  const byId = new Map(dishes.map(d => [d.id!, d]))
  const seen = new Set<string>()
  const out: [Dish, Dish][] = []
  for (const d of dishes) for (const p of d.pairs) {
    const o = byId.get(p)
    if (!o || !canPair(d.role, o.role)) continue
    const [side, protein] = d.role === 'side' ? [d, o] : [o, d]
    const key = `${side.id}-${protein.id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push([side, protein])
  }
  return out
}
