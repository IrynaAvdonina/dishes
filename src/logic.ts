import type { Dish, Ingredient, Variant } from './types'

/** Збережені налаштування можуть бути старішої форми: доповнюємо типовими. */
export function mergeFilters(saved: Partial<Filters> | null | undefined): Filters {
  const f = { ...defaultFilters, ...saved, roles: { ...defaultFilters.roles, ...saved?.roles } }
  if (!f.roles.side && !f.roles.protein && !f.roles.full) f.roles = { ...defaultFilters.roles }
  return f
}

export type SortKey = 'manual' | 'time' | 'ing' | 'name' | 'love' | 'effort'
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
    // без оцінки — у кінці списку
    : key === 'love' ? (y.love ?? 0) - (x.love ?? 0)
    : key === 'effort' ? (x.effort ?? 6) - (y.effort ?? 6)
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
/**
 * Базове, що є вдома завжди: не пишемо як інгредієнти й не ведемо в «Моїх продуктах».
 * Якщо таке трапиться (у заміні чи в старих даних) — вважається наявним.
 */
export const STAPLES = ['сіль', 'олія', 'цукор', 'чорний перець', 'паприка', 'лавровий лист']
const STAPLE_SET = new Set(STAPLES.map(norm))
export const isStaple = (name: string) => STAPLE_SET.has(norm(name))

export const pantrySet = (rows: { name: string }[] | undefined) => new Set([...(rows ?? []).map(p => norm(p.name)), ...STAPLE_SET])

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

// ── пошук за наявними продуктами ────────────────────────────────────

export interface Coverage {
  /** чого немає навіть із замінами */
  missing: string[]
  /** що закривається заміною з «Моїх продуктів» */
  subs: { name: string; sub: string }[]
}

/**
 * Що з обов'язкових інгредієнтів є вдома, що можна замінити, а чого немає.
 * Група «або»: достатньо одного; заміною може стати заміна будь-кого з групи.
 */
export function coverage(ings: Ingredient[], pantry: Set<string>): Coverage {
  const missing: string[] = []
  const subs: Coverage['subs'] = []
  const has = (n: string) => pantry.has(norm(n))
  const units = new Map<string, Ingredient[]>()
  for (const g of ings) {
    if (!g.required) continue
    const k = g.group ? `g:${g.group}` : `n:${norm(g.name)}`
    units.set(k, [...(units.get(k) ?? []), g])
  }
  for (const members of units.values()) {
    if (members.some(m => has(m.name))) continue
    const label = [...new Set(members.map(m => m.name))].join(' або ')
    const sub = members.flatMap(m => m.replacements ?? []).find(has)
    if (sub) subs.push({ name: label, sub })
    else missing.push(label)
  }
  return { missing, subs }
}

export const dishIngredients = (d: Dish, v?: Variant) => [...d.ingredients, ...(v?.addIngredients ?? [])]

export interface Match { dish: Dish; variant?: Variant; cov: Coverage }

/**
 * Найкращий варіант страви за продуктами вдома (найменше бракує, потім найменше замін).
 * want — продукти, які обов'язково мають бути в страві; якщо жоден варіант їх не містить — null.
 */
export function bestMatch(d: Dish, pantry: Set<string>, want: string[] = []): Match | null {
  const options: (Variant | undefined)[] = d.variants.length ? d.variants : [undefined]
  let best: Match | null = null
  for (const v of options) {
    const ings = dishIngredients(d, v)
    if (want.length) {
      const names = new Set(ings.map(i => norm(i.name)))
      if (!want.every(w => names.has(norm(w)))) continue
    }
    const cov = coverage(ings, pantry)
    if (!best || cov.missing.length < best.cov.missing.length
      || (cov.missing.length === best.cov.missing.length && cov.subs.length < best.cov.subs.length))
      best = { dish: d, variant: v, cov }
  }
  return best
}
