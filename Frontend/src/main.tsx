import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import { WorkshopDataProvider } from './data/WorkshopDataProvider'
import { AuthProvider } from './auth/AuthProvider'
import { ToastProvider } from './components/ui/ToastProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <AuthProvider><WorkshopDataProvider><RouterProvider router={router} /></WorkshopDataProvider></AuthProvider>
    </ToastProvider>
  </StrictMode>,
)
