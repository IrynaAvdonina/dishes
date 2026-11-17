import { useLayoutEffect, useRef, useState, type UIEvent } from 'react'

/**
 * Пам'ять екранів на час роботи застосунку: позиція прокрутки й невеликий стан
 * (пошук, вибрані фільтри). Коли відкриваєш страву й повертаєшся — список на тому самому місці.
 */
const scrolls = new Map<string, number>()
const states = new Map<string, unknown>()

/** Прокрутка: повертає ref і onScroll для контейнера списку. ready — коли дані вже намальовані. */
export function useKeepScroll<T extends HTMLElement = HTMLDivElement>(key: string, ready: boolean) {
  const ref = useRef<T>(null)
  const done = useRef(false)
  useLayoutEffect(() => {
    if (!ready || done.current || !ref.current) return
    done.current = true
    ref.current.scrollTop = scrolls.get(key) ?? 0
  }, [ready, key])
  const onScroll = (e: UIEvent<T>) => { scrolls.set(key, e.currentTarget.scrollTop) }
  return { ref, onScroll }
}

/** Як useState, але значення переживає перехід на інший екран і назад. */
export function useScreenState<V>(key: string, initial: V) {
  const [v, setV] = useState<V>(() => (states.has(key) ? states.get(key) as V : initial))
  const set = (next: V | ((prev: V) => V)) => setV(prev => {
    const val = typeof next === 'function' ? (next as (p: V) => V)(prev) : next
    states.set(key, val)
    return val
  })
  return [v, set] as const
}
