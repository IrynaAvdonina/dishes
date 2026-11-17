import type { Dish, Ingredient } from './types'

/** Збережені налаштування можуть бути старішої форми: доповнюємо типовими. */
export function mergeFilters(saved: Partial<Filters> | null | undefined): Filters {
  const f = { ...defaultFilters, ...saved, roles: { ...defaultFilters.roles, ...saved?.roles } }
  if (!f.roles.side && !f.roles.protein && !f.roles.full) f.roles = { ...defaultFilters.roles }
  return f
}

export type SortKey = 'manual' | 'time' | 'ing' | 'name'
export type Dir = 'asc' | 'desc'

export interface Filters {
  roles: Record<'side' | 'protein' | 'full', boolean>
  oven: 'any' | 'yes' | 'no'
  maxTime: number // 0 = будь-який
  tags: string[]
}

export const defaultFilters: Filters = {
  roles: { side: true, protein: true, full: true }, oven: 'any', maxTime: 0, tags: []
}

export function activeFilterCount(f: Filters) {
  return (f.oven !== 'any' ? 1 : 0) + (f.maxTime ? 1 : 0) + f.tags.length
}

export function passes(d: Dish, f: Filters) {
  return f.roles[d.role]
    && (f.oven === 'any' || (f.oven === 'yes') === d.oven)
    && (!f.maxTime || d.timeMin <= f.maxTime)
    && f.tags.every(t => d.tags.includes(t))
}

/** Кількість інгредієнтів: група «кріп або петрушка» рахується як один. */
export function ingredientCount(ings: Ingredient[]) {
  return new Set(ings.map(g => g.group ?? g.name)).size
}

export function sortDishes(list: Dish[], key: SortKey, dir: Dir) {
  const s = dir === 'desc' ? -1 : 1
  const main = (x: Dish, y: Dish) =>
    key === 'time' ? x.timeMin - y.timeMin
    : key === 'ing' ? ingredientCount(x.ingredients) - ingredientCount(y.ingredients)
    : key === 'name' ? x.name.localeCompare(y.name, 'uk')
    : x.order - y.order
  // напрям змінює лише головний ключ; рівні страви лишаються у вашому порядку
  return [...list].sort((x, y) => s * main(x, y) || x.order - y.order)
}

/** 1 страва, 2 страви, 5 страв */
export function plural(n: number, one: string, few: string, many: string) {
  const a = n % 10, b = n % 100
  if (a === 1 && b !== 11) return one
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few
  return many
}

/** Для пошуку: нижній регістр і один вид апострофа (м'ясо = мʼясо = м’ясо). */
export const norm = (s: string) => s.toLowerCase().replace(/[’ʼ`]/g, "'").replace(/\s+/g, ' ').trim()

/** Набір «що є вдома» для порівняння без урахування регістру й пробілів. */
export const pantrySet = (rows: { name: string }[] | undefined) => new Set((rows ?? []).map(p => norm(p.name)))

/**
 * Продукти зі страв, яких немає вдома: найчастіші спершу (для підказок у «Моїх продуктах»).
 * Заміни теж враховуються, але важать менше.
 */
export function suggestProducts(dishes: Dish[], pantry: Set<string>): { name: string; count: number }[] {
  const score = new Map<string, { name: string; count: number; w: number }>()
  const add = (name: string, w: number, seen: Set<string>) => {
    const k = norm(name)
    if (!k || pantry.has(k) || seen.has(k)) return
    seen.add(k)
    const e = score.get(k) ?? { name: name.trim(), count: 0, w: 0 }
    e.w += w
    if (w === 1) e.count++
    score.set(k, e)
  }
  for (const d of dishes) {
    const seen = new Set<string>()
    const ings = [...d.ingredients, ...d.variants.flatMap(v => v.addIngredients ?? [])]
    for (const g of ings) add(g.name, 1, seen)
    for (const g of ings) for (const r of g.replacements ?? []) add(r, 0.3, seen)
  }
  return [...score.values()]
    .sort((a, b) => b.w - a.w || a.name.localeCompare(b.name, 'uk'))
    .map(({ name, count }) => ({ name, count }))
}

export function matchesSearch(d: Dish, needle: string) {
  if (!needle) return true
  const ings = [...d.ingredients, ...d.variants.flatMap(v => v.addIngredients ?? [])]
  return norm(d.name).includes(needle) || ings.some(i => norm(i.name).includes(needle))
}

/** Чого не вистачає серед обов'язкових. Група: достатньо одного інгредієнта з групи. pantry — з pantrySet(). */
export function missing(ings: Ingredient[], pantry: Set<string>): string[] {
  const out: string[] = []
  const groups = new Map<string, Ingredient[]>()
  for (const g of ings) {
    if (!g.required) continue
    if (g.group) { groups.set(g.group, [...(groups.get(g.group) ?? []), g]); continue }
    if (!pantry.has(norm(g.name))) out.push(g.name)
  }
  for (const [, members] of groups)
    if (!members.some(m => pantry.has(norm(m.name)))) out.push(members.map(m => m.name).join('/'))
  return out
}

export function requiredNames(ings: Ingredient[]): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const g of ings) {
    if (!g.required) continue
    const key = g.group ?? g.name
    if (seen.has(key)) continue
    seen.add(key)
    out.push(g.group ? ings.filter(x => x.group === g.group).map(x => x.name).join('/') : g.name)
  }
  return out.join(', ')
}
