import { NavLink } from 'react-router-dom'
import { useToBuyCount } from './shoppingData'

const S = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

/** Страви: миска з парою. */
const IcDishes = ({ on }: { on: boolean }) => (
  <svg {...S}>
    <path d="M3.5 11.5h17a8.5 8.5 0 01-17 0z" fill={on ? '#E5EBFC' : 'none'} />
    <path d="M9 8c0-1.2 1.2-1.6 1.2-2.8M13.6 8c0-1.2 1.2-1.6 1.2-2.8" />
  </svg>
)
/** Пошук «Що приготувати»: лупа. */
const IcFind = ({ on }: { on: boolean }) => (
  <svg {...S}>
    <circle cx="10.5" cy="10.5" r="6.5" fill={on ? '#E5EBFC' : 'none'} />
    <path d="M15.5 15.5L20 20" />
  </svg>
)
/** Покупки: аркуш списку з галочкою. */
const IcShop = ({ on }: { on: boolean }) => (
  <svg {...S}>
    <rect x="4.5" y="3.5" width="15" height="17" rx="3.5" fill={on ? '#E5EBFC' : 'none'} />
    <path d="M8 9l1.4 1.4L12 7.8M8 15l1.4 1.4L12 13.8M14.5 9.5H16M14.5 15.5H16" />
  </svg>
)
/** Продукти: кошик. */
const IcBasket = ({ on }: { on: boolean }) => (
  <svg {...S}>
    <path d="M3.5 10h17l-1.6 8.4a2 2 0 01-2 1.6H7.1a2 2 0 01-2-1.6z" fill={on ? '#E5EBFC' : 'none'} />
    <path d="M8.5 10l3-5.5M15.5 10l-3-5.5M9.5 14v2.5M14.5 14v2.5" />
  </svg>
)

const TABS = [
  { to: '/', label: 'Страви', Icon: IcDishes, end: true, r: '16px 16px 4px 16px' },
  { to: '/search', label: 'Пошук', Icon: IcFind, end: false, r: '16px 4px 16px 16px' },
  { to: '/shopping', label: 'Покупки', Icon: IcShop, end: false, r: '4px 16px 16px 16px' },
  { to: '/pantry', label: 'Продукти', Icon: IcBasket, end: false, r: '16px 16px 16px 4px' }
]

/** Нижня панель вкладок у стилі «Тихий фаянс»: тонка лінія зверху, значок у пілюлі з асиметричними кутами. */
export default function Tabs() {
  const toBuy = useToBuyCount()
  return (
    <nav className="tabs" aria-label="Розділи">
      {TABS.map(({ to, label, Icon, end, r }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'on' : ''}>
          {({ isActive }) => (<>
            <span className="ti" style={{ borderRadius: r, position: 'relative' }}>
              <Icon on={isActive} />
              {to === '/shopping' && toBuy > 0 && <span className="tbadge-n" aria-hidden="true">{toBuy > 99 ? '99+' : toBuy}</span>}
            </span>
            <span>{label}{to === '/shopping' && toBuy > 0 && <span className="sr-only">, купити {toBuy}</span>}</span>
          </>)}
        </NavLink>
      ))}
    </nav>
  )
}
