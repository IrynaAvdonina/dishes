import Dexie, { type Table } from 'dexie'
import type { Dish, PantryItem } from './types'
import { seedDishes, seedPantry } from './seed'

class AppDB extends Dexie {
  dishes!: Table<Dish, number>
  pantry!: Table<PantryItem, string>
  constructor() {
    super('dishes-app')
    this.version(1).stores({
      dishes: '++id, role, order, hiddenAt',
      pantry: 'name'
    })
  }
}

export const db = new AppDB()

/** Перший запуск: заповнюємо прикладами, які можна видалити. */
export async function ensureSeed() {
  if ((await db.dishes.count()) === 0) {
    await db.dishes.bulkAdd(seedDishes())
    await db.pantry.bulkPut(seedPantry.map(name => ({ name })))
  }
}
