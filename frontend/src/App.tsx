import { Route, Routes } from 'react-router'

import { RequireAuth, RequireRole } from './auth/guards'
import { Layout } from './components/Layout'
import { AccountPage } from './pages/AccountPage'
import { CoachPage } from './pages/CoachPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ParentPage } from './pages/ParentPage'
import { RegisterPage } from './pages/RegisterPage'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route
          path="coach"
          element={
            <RequireRole roles={['COACH']}>
              <CoachPage />
            </RequireRole>
          }
        />
        <Route
          path="parent"
          element={
            <RequireRole roles={['PARENT']}>
              <ParentPage />
            </RequireRole>
          }
        />
        <Route
          path="account"
          element={
            <RequireAuth>
              <AccountPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
