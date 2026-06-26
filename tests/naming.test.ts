import { describe, it, expect } from 'vitest'
import { defaultRunName } from '../src/shared/naming'

describe('defaultRunName', () => {
  it('builds a name from benchmark label, QEC and error budget', () => {
    expect(defaultRunName('Grover', 'SurfaceCode', 0.01)).toBe(
      'Grover · SurfaceCode · budget 0.01'
    )
  })

  it('works for imported programs', () => {
    expect(defaultRunName('Imported program', 'SurfaceCodeLowMove', 0.001)).toBe(
      'Imported program · SurfaceCodeLowMove · budget 0.001'
    )
  })
})
