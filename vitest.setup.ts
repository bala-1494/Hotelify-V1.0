import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Unmount React trees and reset the DOM/localStorage between tests so state
// (rendered nodes, remembered setup-confirm flags) never leaks across cases.
afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

// jsdom ships a window.scrollTo that throws "Not implemented"; the wizard calls
// it on every step change, so replace it with a no-op to keep logs clean.
window.scrollTo = (() => {}) as typeof window.scrollTo
