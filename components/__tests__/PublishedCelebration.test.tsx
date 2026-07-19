import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PublishedCelebration from '@/components/PublishedCelebration'

describe('PublishedCelebration', () => {
  it('shows the live hotel, its link, and a booking-page link', () => {
    render(<PublishedCelebration hotelName="Bloom Hub" slug="bloom-hub" onGoToDashboard={() => {}} />)

    expect(screen.getByText('Bloom Hub is live!')).toBeInTheDocument()
    expect(screen.getByText('hotelify.com/bloom-hub')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View booking page' })).toHaveAttribute('href', '/book/bloom-hub')
  })

  it('fires onGoToDashboard from the dashboard button', async () => {
    const user = userEvent.setup()
    const onGoToDashboard = vi.fn()
    render(<PublishedCelebration hotelName="Bloom Hub" slug="bloom-hub" onGoToDashboard={onGoToDashboard} />)

    await user.click(screen.getByRole('button', { name: /Go to dashboard/ }))
    expect(onGoToDashboard).toHaveBeenCalledTimes(1)
  })

  it('confirms the copy action in the button label', async () => {
    const user = userEvent.setup()
    render(<PublishedCelebration hotelName="Bloom Hub" slug="bloom-hub" onGoToDashboard={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(await screen.findByRole('button', { name: 'Copied ✓' })).toBeInTheDocument()
  })
})
