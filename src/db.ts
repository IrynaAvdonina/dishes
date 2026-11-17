import Dexie, { type Table } from 'dexie'
import type { Dish, Ingredient, PantryItem } from './types'
import { seedDishes, seedPantry } from './seed'

interface Meta { key: string; value: unknown }

class AppDB extends Dexie {
  dishes!: Table<Dish, number>
  pantry!: Table<PantryItem, string>
  meta!: Table<Meta, string>
  constructor() {
    super('dishes-app')
    this.version(1).stores({
      dishes: '++id, role, order, hiddenAt',
      pantry: 'name'
    })
    // службові позначки (напр. «приклади вже додавались»)
    this.version(2).stores({ meta: 'key' })
    // одноразово для вже збережених даних: без кількостей і без солі (сіль є завжди)
    this.version(3).upgrade(async tx => {
      const isSalt = (n: string) => n.trim().toLowerCase() === 'сіль'
      const strip = (list?: (Ingredient & { amount?: string })[]) =>
        list?.filter(g => !isSalt(g.name)).map(({ amount: _a, ...g }) => g)
      await tx.table('dishes').toCollection().modify((d: Dish) => {
        d.ingredients = strip(d.ingredients) ?? []
        d.variants = d.variants.map(v => {
          const add = strip(v.addIngredients)
          return add?.length ? { ...v, addIngredients: add } : { id: v.id, name: v.name }
        })
      })
      await tx.table('pantry').filter((p: PantryItem) => isSalt(p.name)).delete()
    })
    // одноразово: базове, що є завжди (олія, цукор, спеції), теж не інгредієнт і не продукт.
    // Список зафіксований тут навмисно: оновлення бази не має змінюватися згодом.
    this.version(4).upgrade(async tx => {
      const base = new Set(['сіль', 'олія', 'цукор', 'чорний перець', 'паприка', 'лавровий лист'])
      const isBase = (n: string) => base.has(n.trim().toLowerCase().replace(/\s+/g, ' '))
      const strip = (list?: Ingredient[]) => list?.filter(g => !isBase(g.name))
      await tx.table('dishes').toCollection().modify((d: Dish) => {
        d.ingredients = strip(d.ingredients) ?? []
        d.variants = d.variants.map(v => {
          const add = strip(v.addIngredients)
          return add?.length ? { ...v, addIngredients: add } : { id: v.id, name: v.name }
        })
      })
      await tx.table('pantry').filter((p: PantryItem) => isBase(p.name)).delete()
    })
  }
}

export const db = new AppDB()

export const markSeeded = () => db.meta.put({ key: 'seeded', value: true })

/**
 * Перший запуск: заповнюємо прикладами, які можна видалити.
 * Лише один раз: якщо потім видалити всі страви, приклади не повертаються.
 */
export async function ensureSeed() {
  await db.transaction('rw', db.dishes, db.pantry, db.meta, async () => {
    if (await db.meta.get('seeded')) return
    if ((await db.dishes.count()) === 0) {
      await db.dishes.bulkAdd(seedDishes())
      await db.pantry.bulkPut(seedPantry.map(name => ({ name })))
    }
    await markSeeded()
  })
}
