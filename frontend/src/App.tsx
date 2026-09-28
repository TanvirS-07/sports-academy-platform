import { Outlet, Route, Routes } from 'react-router'

import { RequireAuth, RequireRole } from './auth/guards'
import { Layout } from './components/Layout'
import { AccountPage } from './pages/AccountPage'
import { CoachSessionPage } from './pages/CoachSessionPage'
import { CoachPage } from './pages/CoachPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { NewPlayerPage } from './pages/NewPlayerPage'
import { NewProgramPage } from './pages/NewProgramPage'
import { NewSessionPage } from './pages/NewSessionPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ParentPage } from './pages/ParentPage'
import { ParentSessionsPage } from './pages/ParentSessionsPage'
import { PlayerPage } from './pages/PlayerPage'
import { ProgramPage } from './pages/ProgramPage'
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
              <Outlet />
            </RequireRole>
          }
        >
          <Route index element={<CoachPage />} />
          <Route path="programs/new" element={<NewProgramPage />} />
          <Route path="programs/:programId" element={<ProgramPage />} />
          <Route path="programs/:programId/sessions/new" element={<NewSessionPage />} />
          <Route path="sessions/:sessionId" element={<CoachSessionPage />} />
        </Route>
        <Route
          path="parent"
          element={
            <RequireRole roles={['PARENT']}>
              <Outlet />
            </RequireRole>
          }
        >
          <Route index element={<ParentPage />} />
          <Route path="players/new" element={<NewPlayerPage />} />
          <Route path="players/:playerId" element={<PlayerPage />} />
          <Route path="sessions" element={<ParentSessionsPage />} />
        </Route>
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
