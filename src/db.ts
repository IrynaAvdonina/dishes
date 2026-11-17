import Dexie, { type Table } from 'dexie'
import type { Dish, PantryItem } from './types'
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
