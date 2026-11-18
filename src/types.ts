export type Role = 'side' | 'protein' | 'full'

export const ROLE_LABEL: Record<Role, string> = { side: 'Гарнір', protein: 'Білок', full: 'Повна' }
export const TASTES = ['пікантне', 'ситне', 'легке', 'хрустке', 'солодке'] as const

export interface Ingredient {
  name: string
  /** обов'язковий інгредієнт */
  required: boolean
  /** інгредієнти з однаковою групою взаємозамінні («кріп або петрушка») */
  group?: string
  /** дозволені заміни, якщо немає */
  replacements?: string[]
}

export interface Variant {
  id: string
  name: string
  addIngredients?: Ingredient[]
}

export interface Dish {
  id?: number
  name: string
  role: Role
  timeMin: number
  oven: boolean
  tags: string[]
  /** фото страви; перше — обкладинка (у каталозі й угорі сторінки) */
  photos?: Blob[]
  ingredients: Ingredient[]
  variants: Variant[]
  /** id страв, що добре пасують */
  pairs: number[]
  /** ручний порядок */
  order: number
  /** час (мс), коли страву приховано; undefined — не приховано */
  hiddenAt?: number
  /** складність, 1–5 зірочок */
  effort?: number
  /** наскільки подобається, 1–5 сердечок */
  love?: number
}

/** Пункт списку покупок. done — уже куплено. */
export interface ShopItem {
  id?: number
  name: string
  done: boolean
  order: number
}

export interface PantryItem {
  name: string
}
