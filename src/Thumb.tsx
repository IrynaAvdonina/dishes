import { useEffect, useState } from 'react'
import type { Dish } from './types'
import { IcOven, IcPlate, RoleGlyph } from './icons'

const SHAPES = ['26px', '50%', '38px 38px 12px 12px', '12px 38px 12px 38px', '42px 14px 42px 14px', '20px 20px 42px 20px']
export const TINTS: [string, string][] = [['#FDF4CF', '#8A6B00'], ['#FDE6D8', '#9A4A1C'], ['#E5EBFC', '#3149B8'], ['#E3F1E4', '#2F6B3A'], ['#F6E4F0', '#8A3C74'], ['#E8F3F6', '#2D6577']]
export const shapeOf = (id: number) => SHAPES[((id * 5 + 1) % 6 + 6) % 6]
export const tintOf = (id: number) => TINTS[((id * 7 + 2) % 6 + 6) % 6]

export function usePhotoUrl(photo?: Blob) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!photo) { setUrl(undefined); return }
    const u = URL.createObjectURL(photo)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [photo])
  return url
}

/** Зменшена мініатюра (для списків пар і вибору страви). */
export function MiniThumb({ dish, size = 56 }: { dish: Dish; size?: number }) {
  return (
    <div style={{ flex: 'none', width: size, height: size }}>
      <div style={{ transform: `scale(${size / 84})`, transformOrigin: 'top left', width: 84, height: 84 }}><Thumb dish={dish} /></div>
    </div>
  )
}

export default function Thumb({ dish }: { dish: Dish }) {
  const id = dish.id ?? 0
  const [bg, ink] = tintOf(id)
  const url = usePhotoUrl(dish.photo)
  return (
    <div className="thumb" role="img" aria-label={`${dish.name}`}>
      <div className="shape" style={{ background: bg, borderRadius: shapeOf(id) }}>
        {url ? <img src={url} alt="" /> : <IcPlate c={ink} />}
      </div>
      {dish.oven && (
        <div className="tbadge" style={{ right: -4, top: -4, width: 30, height: 30 }} title="Потрібна духовка" aria-label="Потрібна духовка">
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#FBE3A0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IcOven /></div>
        </div>
      )}
      <div className="tbadge" style={{ right: -4, bottom: -4 }}><RoleGlyph role={dish.role} /></div>
    </div>
  )
}
