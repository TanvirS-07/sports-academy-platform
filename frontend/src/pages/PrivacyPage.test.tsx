import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { PrivacyPage } from './PrivacyPage'

describe('PrivacyPage', () => {
  it('says what signing in with Google shares', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Privacy policy' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Signing in with Google' })).toBeInTheDocument()
    expect(document.title).toBe('Privacy policy · Precision Cricket Academy')
  })
})
