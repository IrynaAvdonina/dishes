import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { ensureSeed } from './db'
import Catalog from './Catalog'
import DishPage from './DishPage'
// шрифти лежать у самому застосунку, щоб працювали без інтернету
import '@fontsource/onest/400.css'
import '@fontsource/onest/500.css'
import '@fontsource/onest/600.css'
import '@fontsource/unbounded/500.css'
import './styles.css'

ensureSeed().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route path="/dish/:id" element={<DishPage />} />
        </Routes>
      </HashRouter>
    </StrictMode>
  )
})
