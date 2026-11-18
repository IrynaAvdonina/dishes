import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { isStaple, norm } from './logic'
import type { ShopItem } from './types'

/**
 * Список покупок. Позначка «куплено» одразу додає продукт у «Мої продукти»
 * (для «кріп або петрушка» — ні: незрозуміло, що саме купили).
 */
const clean = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

/** Спершу те, що треба купити (у порядку додавання), далі куплене. */
export function useShopping(): ShopItem[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.shopping.orderBy('order').toArray()
    return [...all.filter(i => !i.done), ...all.filter(i => i.done)]
  }, [])
}

export const useToBuyCount = () => useLiveQuery(() => db.shopping.filter(i => !i.done).count(), []) ?? 0

/** Додати в список. Повертає, скільки справді додано (дублікати й базове пропускаємо). */
export async function addToShopping(names: string[]): Promise<number> {
  let added = 0
  await db.transaction('rw', db.shopping, async () => {
    const all = await db.shopping.toArray()
    let order = all.reduce((m, i) => Math.max(m, i.order), 0)
    for (const raw of names) {
      const name = clean(raw)
      if (!name || isStaple(name)) continue
      const same = all.find(i => norm(i.name) === norm(name))
      if (same && !same.done) continue
      if (same) { await db.shopping.update(same.id!, { done: false, order: ++order }); same.done = false }
      else { const id = await db.shopping.add({ name, done: false, order: ++order }); all.push({ id, name, done: false, order }) }
      added++
    }
  })
  return added
}

/** Позначити куплене (і додати в «Мої продукти») або зняти позначку. */
export async function toggleBought(item: ShopItem) {
  const done = !item.done
  await db.transaction('rw', db.shopping, db.pantry, async () => {
    await db.shopping.update(item.id!, { done })
    if (item.name.includes(' або ')) return
    if (done) { if (!(await db.pantry.toArray()).some(p => norm(p.name) === norm(item.name))) await db.pantry.put({ name: item.name }) }
    else {
      const rows = (await db.pantry.toArray()).filter(p => norm(p.name) === norm(item.name))
      await db.pantry.bulkDelete(rows.map(p => p.name))
    }
  })
}

export const removeFromShopping = (id: number) => db.shopping.delete(id)
export const restoreShopItem = (item: ShopItem) => db.shopping.put(item)
export const clearBought = async () => { const done = await db.shopping.filter(i => i.done).toArray(); await db.shopping.bulkDelete(done.map(i => i.id!)); return done }
