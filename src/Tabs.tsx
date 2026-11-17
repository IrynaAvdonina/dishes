import { NavLink } from 'react-router-dom'

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
/** Пари: квадрат гарніру + коло білка (як значки ролей). */
const IcPairs = ({ on }: { on: boolean }) => (
  <svg {...S}>
    <rect x="3" y="6" width="10.5" height="10.5" rx="3.2" fill={on ? '#F6D96B' : 'none'} />
    <circle cx="15.5" cy="12.5" r="5.5" fill={on ? '#F5A97F' : '#fff'} />
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
  { to: '/pairs', label: 'Пари', Icon: IcPairs, end: false, r: '4px 16px 16px 16px' },
  { to: '/pantry', label: 'Продукти', Icon: IcBasket, end: false, r: '16px 16px 16px 4px' }
]

/** Нижня панель вкладок у стилі «Тихий фаянс»: фестон зверху, значок у пілюлі з асиметричними кутами. */
export default function Tabs() {
  return (
    <nav className="tabs" aria-label="Розділи">
      {TABS.map(({ to, label, Icon, end, r }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'on' : ''}>
          {({ isActive }) => (<>
            <span className="ti" style={{ borderRadius: r }}><Icon on={isActive} /></span>
            <span>{label}</span>
          </>)}
        </NavLink>
      ))}
    </nav>
  )
}
