import type { Dish, Ingredient, Role, Variant } from './types'

/**
 * Чернетка для форми. Один «пункт» = один рядок у списку інгредієнтів.
 * Кілька назв у пункті — це група «або» («кріп або петрушка»): достатньо однієї.
 */
export interface ItemDraft {
  key: string
  names: string[]
  amount: string
  required: boolean
  /** заміни через кому */
  replacements: string
}

export interface VariantDraft {
  key: string
  id: string
  name: string
  items: ItemDraft[]
}

export interface Draft {
  name: string
  role: Role | null
  timeMin: string
  oven: boolean
  tags: string[]
  photo?: Blob
  items: ItemDraft[]
  variants: VariantDraft[]
}

let seq = 0
export const newKey = () => `k${Date.now().toString(36)}${(seq++).toString(36)}`

export const emptyItem = (): ItemDraft => ({ key: newKey(), names: [''], amount: '', required: true, replacements: '' })

export const emptyDraft = (): Draft => ({
  name: '', role: null, timeMin: '', oven: false, tags: [], items: [emptyItem()], variants: []
})

/** Інгредієнти з бази → пункти форми (групу збираємо в один пункт). */
export function toItems(ings: Ingredient[] = []): ItemDraft[] {
  const out: ItemDraft[] = []
  const byGroup = new Map<string, ItemDraft>()
  for (const g of ings) {
    const existing = g.group ? byGroup.get(g.group) : undefined
    if (existing) {
      existing.names.push(g.name)
      if (!existing.amount && g.amount) existing.amount = g.amount
      continue
    }
    const item: ItemDraft = {
      key: newKey(), names: [g.name], amount: g.amount, required: g.required,
      replacements: (g.replacements ?? []).join(', ')
    }
    if (g.group) byGroup.set(g.group, item)
    out.push(item)
  }
  return out
}

export function toDraft(d: Dish): Draft {
  return {
    name: d.name, role: d.role, timeMin: String(d.timeMin), oven: d.oven, tags: [...d.tags], photo: d.photo,
    items: toItems(d.ingredients),
    variants: d.variants.map(v => ({ key: newKey(), id: v.id, name: v.name, items: toItems(v.addIngredients) }))
  }
}

const clean = (s: string) => s.trim().replace(/\s+/g, ' ')

export function parseList(s: string): string[] {
  return [...new Set(s.split(/[,;]/).map(clean).filter(Boolean))]
}

/** Пункти форми → інгредієнти для бази. usedGroups спільний для страви й усіх варіантів. */
export function fromItems(items: ItemDraft[], usedGroups: Set<string>): Ingredient[] {
  const out: Ingredient[] = []
  for (const it of items) {
    const names = [...new Set(it.names.map(clean).filter(Boolean))]
    if (!names.length) continue
    const replacements = parseList(it.replacements)
    let group: string | undefined
    if (names.length > 1) {
      group = names.join('/')
      for (let n = 2; usedGroups.has(group); n++) group = `${names.join('/')}#${n}`
      usedGroups.add(group)
    }
    for (const name of names) {
      const ing: Ingredient = { name, amount: clean(it.amount), required: it.required }
      if (group) ing.group = group
      if (replacements.length) ing.replacements = replacements
      out.push(ing)
    }
  }
  return out
}

export type Errors = Partial<Record<'name' | 'role' | 'timeMin', string>>

export function validate(d: Draft): Errors {
  const e: Errors = {}
  if (!clean(d.name)) e.name = 'Вкажіть назву'
  if (!d.role) e.role = 'Оберіть роль'
  const t = Number(d.timeMin)
  if (!d.timeMin.trim() || !Number.isInteger(t) || t <= 0 || t > 1440) e.timeMin = 'Вкажіть час у хвилинах (ціле число)'
  return e
}

/** Готові поля страви з чернетки (без id, order, hiddenAt, pairs). */
export function fromDraft(d: Draft): Pick<Dish, 'name' | 'role' | 'timeMin' | 'oven' | 'tags' | 'photo' | 'ingredients' | 'variants'> {
  const used = new Set<string>()
  const ingredients = fromItems(d.items, used)
  const variants: Variant[] = d.variants
    .filter(v => clean(v.name))
    .map(v => {
      const add = fromItems(v.items, used)
      return add.length ? { id: v.id, name: clean(v.name), addIngredients: add } : { id: v.id, name: clean(v.name) }
    })
  return { name: clean(d.name), role: d.role!, timeMin: Number(d.timeMin), oven: d.oven, tags: d.tags, photo: d.photo, ingredients, variants }
}

/** Для перевірки «чи є незбережені зміни» (фото порівнюємо окремо). */
export const draftSignature = (d: Draft) =>
  JSON.stringify({ ...d, photo: undefined, items: d.items.map(i => ({ ...i, key: 0 })), variants: d.variants.map(v => ({ ...v, key: 0, items: v.items.map(i => ({ ...i, key: 0 })) })) })
