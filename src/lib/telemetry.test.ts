import { describe, expect, it } from 'vitest'
import { crashReportingAvailable } from './telemetry'

describe('privacy-first crash reporting', () => {
  it('is unavailable when the build has no DSN', () => expect(crashReportingAvailable).toBe(false))
})
