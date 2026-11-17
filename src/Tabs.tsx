import { NavLink } from 'react-router-dom'

/** Нижня панель вкладок. */
export default function Tabs() {
  const cls = ({ isActive }: { isActive: boolean }) => isActive ? 'on' : ''
  return (
    <nav className="tabs">
      <NavLink to="/" end className={cls}>Страви</NavLink>
      <NavLink to="/search" className={cls}>Пошук</NavLink>
      <NavLink to="/pairs" className={cls}>Пари</NavLink>
      <NavLink to="/pantry" className={cls}>Продукти</NavLink>
    </nav>
  )
}
