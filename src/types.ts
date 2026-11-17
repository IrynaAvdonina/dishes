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
  photo?: Blob
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

export interface PantryItem {
  name: string
}
