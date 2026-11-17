import { db, markSeeded } from './db'
import { getTastes, setTastes } from './tastesData'
import type { Dish, Ingredient, PantryItem, Role, Variant } from './types'

/**
 * Резервна копія: один JSON-файл з усіма стравами (разом із фото) і продуктами.
 * Фото всередині файлу — як data-URL (base64).
 */
const APP = 'stravy'
const VERSION = 1

interface FileDish extends Omit<Dish, 'photos'> { photos?: string[] }
interface BackupFile { app: string; version: number; exportedAt: string; dishes: FileDish[]; pantry: PantryItem[]; tastes?: string[] }

export interface ParsedBackup { exportedAt: Date | null; dishes: Dish[]; pantry: PantryItem[]; tastes?: string[] }

const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader()
  r.onload = () => res(r.result as string)
  r.onerror = () => rej(r.error)
  r.readAsDataURL(b)
})

export async function exportFile(): Promise<{ file: File; dishes: number }> {
  const [dishes, pantry] = await Promise.all([db.dishes.toArray(), db.pantry.toArray()])
  const out: BackupFile = {
    app: APP, version: VERSION, exportedAt: new Date().toISOString(),
    dishes: await Promise.all(dishes.map(async d => ({ ...d, photos: d.photos?.length ? await Promise.all(d.photos.map(blobToDataUrl)) : undefined }))),
    pantry,
    tastes: await getTastes()
  }
  const day = new Date().toISOString().slice(0, 10)
  const file = new File([JSON.stringify(out)], `stravy-${day}.json`, { type: 'application/json' })
  return { file, dishes: dishes.length }
}

/** Завантажує файл на пристрій (на Android — у «Завантаження»). */
export function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export const canShareFiles = (f?: File) => {
  try { return !!navigator.canShare && navigator.canShare({ files: [f ?? new File([''], 'x.json', { type: 'application/json' })] }) } catch { return false }
}

// ── перевірка файлу ────────────────────────────────────────────────

class BadFile extends Error {}
const ROLES: Role[] = ['side', 'protein', 'full']
const isStr = (v: unknown): v is string => typeof v === 'string'
const strArr = (v: unknown): string[] => Array.isArray(v) ? v.filter(isStr) : []

function ingredient(v: unknown): Ingredient | null {
  if (!v || typeof v !== 'object') return null
  const g = v as Record<string, unknown>
  if (!isStr(g.name) || !g.name.trim()) return null
  const ing: Ingredient = { name: g.name, required: g.required !== false }
  if (isStr(g.group) && g.group) ing.group = g.group
  const rep = strArr(g.replacements)
  if (rep.length) ing.replacements = rep
  return ing
}
const ingredients = (v: unknown) => (Array.isArray(v) ? v : []).map(ingredient).filter((x): x is Ingredient => !!x)

async function dish(v: unknown, n: number): Promise<Dish> {
  if (!v || typeof v !== 'object') throw new BadFile(`Страва №${n} пошкоджена`)
  const d = v as Record<string, unknown>
  if (!isStr(d.name) || !d.name.trim()) throw new BadFile(`У страви №${n} немає назви`)
  if (!ROLES.includes(d.role as Role)) throw new BadFile(`У страви «${d.name}» невідома роль`)
  if (typeof d.id !== 'number') throw new BadFile(`У страви «${d.name}» немає номера`)
  const variants: Variant[] = (Array.isArray(d.variants) ? d.variants : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && isStr((x as Record<string, unknown>).name))
    .map((x, i) => {
      const add = ingredients(x.addIngredients)
      const vr: Variant = { id: isStr(x.id) ? x.id : `v${i}`, name: x.name as string }
      if (add.length) vr.addIngredients = add
      return vr
    })
  const out: Dish = {
    id: d.id, name: d.name, role: d.role as Role,
    timeMin: typeof d.timeMin === 'number' && d.timeMin > 0 ? d.timeMin : 0,
    oven: d.oven === true, tags: strArr(d.tags), ingredients: ingredients(d.ingredients), variants,
    pairs: Array.isArray(d.pairs) ? d.pairs.filter((p): p is number => typeof p === 'number') : [],
    order: typeof d.order === 'number' ? d.order : n
  }
  if (typeof d.hiddenAt === 'number') out.hiddenAt = d.hiddenAt
  const rate = (x: unknown) => typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= 5 ? x : undefined
  if (rate(d.effort)) out.effort = rate(d.effort)
  if (rate(d.love)) out.love = rate(d.love)
  // фото: список (photos) або одне фото зі старих копій (photo)
  const srcs = [...strArr(d.photos), ...(isStr(d.photo) ? [d.photo] : [])].filter(p => p.startsWith('data:image/'))
  const photos: Blob[] = []
  for (const p of srcs) { try { photos.push(await (await fetch(p)).blob()) } catch { /* битe фото пропускаємо */ } }
  if (photos.length) out.photos = photos
  return out
}

export async function parseBackup(text: string): Promise<ParsedBackup> {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { throw new BadFile('Це не файл резервної копії: його не вдалося прочитати') }
  const f = raw as Partial<BackupFile>
  if (!f || f.app !== APP || !Array.isArray(f.dishes)) throw new BadFile('Це не файл резервної копії «Страв»')
  if (typeof f.version !== 'number' || f.version > VERSION) throw new BadFile('Файл створено новішою версією застосунку. Оновіть застосунок і спробуйте ще раз')
  const dishes = await Promise.all(f.dishes.map((d, i) => dish(d, i + 1)))
  if (new Set(dishes.map(d => d.id)).size !== dishes.length) throw new BadFile('У файлі повторюються страви')
  const pantry = [...new Map(strArr((f.pantry ?? []).map(p => p?.name)).map(n => [n.trim().toLowerCase(), { name: n.trim() }])).values()].filter(p => p.name)
  const at = f.exportedAt ? new Date(f.exportedAt) : null
  const tastes = Array.isArray(f.tastes) ? [...new Set(strArr(f.tastes).map(t => t.trim()).filter(Boolean))] : undefined
  return { exportedAt: at && !isNaN(+at) ? at : null, dishes, pantry, tastes }
}

export const isBadFile = (e: unknown): e is Error => e instanceof BadFile

/** Повністю замінює дані в застосунку вмістом файлу. */
export async function replaceAll(b: ParsedBackup) {
  await db.transaction('rw', db.dishes, db.pantry, db.meta, async () => {
    await db.dishes.clear()
    await db.pantry.clear()
    await db.dishes.bulkAdd(b.dishes)
    await db.pantry.bulkAdd(b.pantry)
    if (b.tastes) await setTastes(b.tastes)
    await markSeeded()
  })
}
