import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import { ensureSeed } from './db'
import Catalog from './Catalog'
import DishPage from './DishPage'
import DishForm from './DishForm'
// шрифти лежать у самому застосунку, щоб працювали без інтернету
import '@fontsource/onest/400.css'
import '@fontsource/onest/500.css'
import '@fontsource/onest/600.css'
import '@fontsource/unbounded/500.css'
import './styles.css'

// «роутер із даними» потрібен, щоб форма могла перехопити «назад» і спитати про незбережені зміни
const router = createHashRouter([
  { path: '/', element: <Catalog /> },
  { path: '/new', element: <DishForm /> },
  { path: '/dish/:id', element: <DishPage /> },
  { path: '/dish/:id/edit', element: <DishForm /> }
])

ensureSeed().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  )
})
