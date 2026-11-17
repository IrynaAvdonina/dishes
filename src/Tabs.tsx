import { NavLink } from 'react-router-dom'

/** Нижня панель вкладок. Пошук і Пари з'являться пізніше. */
export default function Tabs() {
  const cls = ({ isActive }: { isActive: boolean }) => isActive ? 'on' : ''
  return (
    <nav className="tabs">
      <NavLink to="/" end className={cls}>Страви</NavLink>
      <button disabled>Пошук</button>
      <button disabled>Пари</button>
      <NavLink to="/pantry" className={cls}>Продукти</NavLink>
    </nav>
  )
}
