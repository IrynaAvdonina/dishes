import type { Dish, Ingredient } from './types'

const i = (name: string, amount = '', required = true, extra: Partial<Ingredient> = {}): Ingredient =>
  ({ name, amount, required, ...extra })

export const seedPantry = [
  'гречка', 'гриби', 'цибуля', 'олія', 'сіль', 'курячі ніжки', 'часник', 'паприка', 'картопля', 'масло',
  'молоко', 'лосось', 'рис', 'морква', 'перець', 'свинина', 'яйце', 'борошно', 'сир', 'баклажан', 'кабачок',
  'буряк', 'капуста', 'яловичина', 'курка'
]

const herb = (): Ingredient[] => [
  i('кріп', '', true, { group: 'зелень', replacements: ['зелена цибуля', 'листя селери'] }),
  i('петрушка', '', true, { group: 'зелень', replacements: ['зелена цибуля', 'листя селери'] })
]

export function seedDishes(): Dish[] {
  const base = { variants: [], pairs: [] as number[] }
  const list: Omit<Dish, 'order'>[] = [
    { name: 'Гречка з грибами', role: 'side', timeMin: 25, oven: false, tags: ['ситне', 'легке'],
      ingredients: [i('гречка', '200 г'), i('гриби', '250 г'), i('цибуля', '1 шт'), i('олія', '2 ст. л.')], ...base },
    { name: 'Курячі ніжки в духовці', role: 'protein', timeMin: 60, oven: true, tags: ['пікантне', 'хрустке'],
      ingredients: [i('курячі ніжки', '6 шт'), i('часник', '4 зубчики'), i('паприка', '1 ч. л.'),
        i('олія', '2 ст. л.', true, { replacements: ['масло'] }), i('сіль', 'за смаком'), ...herb()],
      variants: [
        { id: 'classic', name: 'Класичні' },
        { id: 'potato', name: 'З картоплею', addIngredients: [i('картопля', '500 г', true, { replacements: ['батат'] })] },
        { id: 'hot', name: 'Гострі', addIngredients: [i('чилі', '1 стручок', true, { replacements: ['сушений перець'] })] }
      ], pairs: [] },
    { name: 'Борщ зі сметаною', role: 'full', timeMin: 90, oven: false, tags: ['ситне'],
      ingredients: [i('буряк', '2 шт'), i('капуста', '300 г'), i('картопля', '3 шт'), i('яловичина', '400 г'), i('сметана', '', false)], ...base },
    { name: 'Картопляне пюре', role: 'side', timeMin: 30, oven: false, tags: ['ситне'],
      ingredients: [i('картопля', '800 г'), i('масло', '50 г'), i('молоко', '100 мл')], ...base },
    { name: 'Лосось на пару', role: 'protein', timeMin: 20, oven: false, tags: ['легке'],
      ingredients: [i('лосось', '2 стейки'), i('лимон', '1 шт'), i('сіль', 'за смаком')], ...base },
    { name: 'Плов з куркою', role: 'full', timeMin: 75, oven: false, tags: ['ситне', 'пікантне'],
      ingredients: [i('рис', '300 г'), i('курка', '500 г'), i('морква', '2 шт'), i('цибуля', '2 шт'), i('зіра', '1 ч. л.')], ...base },
    { name: 'Рис із овочами', role: 'side', timeMin: 25, oven: false, tags: ['легке'],
      ingredients: [i('рис', '200 г'), i('морква', '1 шт'), i('перець', '1 шт')], ...base },
    { name: 'Відбивні зі свинини', role: 'protein', timeMin: 40, oven: true, tags: ['хрустке', 'ситне'],
      ingredients: [i('свинина', '500 г'), i('яйце', '2 шт'), i('борошно', '3 ст. л.')], ...base },
    { name: 'Сирники', role: 'full', timeMin: 30, oven: false, tags: ['солодке', 'легке'],
      ingredients: [i('сир', '400 г'), i('яйце', '1 шт'), i('борошно', '4 ст. л.')], ...base },
    { name: 'Запечені овочі', role: 'side', timeMin: 45, oven: true, tags: ['легке'],
      ingredients: [i('баклажан', '1 шт'), i('кабачок', '1 шт'), i('перець', '2 шт')], ...base }
  ]
  return list.map((d, n) => ({ ...d, order: n }))
}
