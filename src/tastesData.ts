import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { norm } from './logic'
import { TASTES } from './types'

/**
 * Смаки (ярлики страв на кшталт «пікантне», «ситне»). Список редагується у «Продуктах»
 * і зберігається в таблиці meta під ключем 'tastes'. Поки його не змінювали — типовий TASTES.
 */
export const DEFAULT_TASTES: string[] = [...TASTES]

export function useTastes(): string[] {
  const row = useLiveQuery(() => db.meta.get('tastes'), [])
  const v = row?.value
  return Array.isArray(v) ? v as string[] : DEFAULT_TASTES
}

export async function getTastes(): Promise<string[]> {
  const v = (await db.meta.get('tastes'))?.value
  return Array.isArray(v) ? v as string[] : DEFAULT_TASTES
}

export const setTastes = (list: string[]) => db.meta.put({ key: 'tastes', value: list })

const clean = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

/** Додати смак. false — порожньо або такий уже є. */
export async function addTaste(name: string): Promise<boolean> {
  const t = clean(name)
  const list = await getTastes()
  if (!t || list.some(x => norm(x) === norm(t))) return false
  await setTastes([...list, t])
  return true
}

/** Перейменувати смак у списку й у всіх стравах. */
export async function renameTaste(from: string, to: string): Promise<boolean> {
  const t = clean(to)
  const list = await getTastes()
  if (!t || (norm(t) !== norm(from) && list.some(x => norm(x) === norm(t)))) return false
  await db.transaction('rw', db.dishes, db.meta, async () => {
    await db.dishes.filter(d => d.tags.includes(from)).modify(d => { d.tags = [...new Set(d.tags.map(x => x === from ? t : x))] })
    await setTastes(list.map(x => x === from ? t : x))
  })
  return true
}

/** Видалити смак зі списку й зі страв. Повертає, звідки прибрали (щоб можна було повернути). */
export async function removeTaste(name: string): Promise<{ index: number; dishIds: number[] }> {
  const list = await getTastes()
  const dishIds: number[] = []
  await db.transaction('rw', db.dishes, db.meta, async () => {
    await db.dishes.filter(d => d.tags.includes(name)).modify(d => { dishIds.push(d.id!); d.tags = d.tags.filter(x => x !== name) })
    await setTastes(list.filter(x => x !== name))
  })
  return { index: list.indexOf(name), dishIds }
}

/** Повернути видалений смак на те саме місце й у ті самі страви. */
export async function restoreTaste(name: string, index: number, dishIds: number[]) {
  await db.transaction('rw', db.dishes, db.meta, async () => {
    const list = (await getTastes()).filter(x => x !== name)
    list.splice(Math.max(0, Math.min(index, list.length)), 0, name)
    await setTastes(list)
    await db.dishes.where('id').anyOf(dishIds).modify(d => { if (!d.tags.includes(name)) d.tags = [...d.tags, name] })
  })
}
