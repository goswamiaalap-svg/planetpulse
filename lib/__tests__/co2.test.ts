// lib/__tests__/co2.test.ts — Unit tests for CO2 calculation

import { calculateCO2, EMISSION_FACTORS, ABSURD_THRESHOLDS } from '../co2'

describe('calculateCO2', () => {
  describe('car', () => {
    it('applies 0.20 kg/km factor correctly', () => {
      expect(calculateCO2('car', 10)).toBe(2.0)
    })
    it('handles 100km car trip', () => {
      expect(calculateCO2('car', 100)).toBe(20.0)
    })
    it('rounds to 3 decimal places', () => {
      expect(calculateCO2('car', 7)).toBe(1.4)
    })
  })

  describe('bus', () => {
    it('applies 0.08 kg/km factor correctly', () => {
      expect(calculateCO2('bus', 10)).toBe(0.8)
    })
    it('handles 50km bus trip', () => {
      expect(calculateCO2('bus', 50)).toBe(4.0)
    })
    it('rounds correctly for fractional results', () => {
      expect(calculateCO2('bus', 1)).toBe(0.08)
    })
  })

  describe('flight', () => {
    it('applies 0.25 kg/km factor correctly', () => {
      expect(calculateCO2('flight', 10)).toBe(2.5)
    })
    it('handles long-haul flight (10000 km)', () => {
      expect(calculateCO2('flight', 10000)).toBe(2500.0)
    })
    it('handles short-haul flight (500 km)', () => {
      expect(calculateCO2('flight', 500)).toBe(125.0)
    })
  })

  describe('electricity', () => {
    it('applies 0.80 kg/kWh factor correctly', () => {
      expect(calculateCO2('electricity', 10)).toBe(8.0)
    })
    it('handles monthly electricity bill (300 kWh)', () => {
      expect(calculateCO2('electricity', 300)).toBe(240.0)
    })
    it('handles 1 kWh', () => {
      expect(calculateCO2('electricity', 1)).toBe(0.8)
    })
  })

  describe('veg_meal', () => {
    it('applies 0.5 kg/meal factor correctly', () => {
      expect(calculateCO2('veg_meal', 1)).toBe(0.5)
    })
    it('handles multiple meals', () => {
      expect(calculateCO2('veg_meal', 10)).toBe(5.0)
    })
    it('handles 2 meals', () => {
      expect(calculateCO2('veg_meal', 2)).toBe(1.0)
    })
  })

  describe('non_veg_meal', () => {
    it('applies 2.0 kg/meal factor correctly', () => {
      expect(calculateCO2('non_veg_meal', 1)).toBe(2.0)
    })
    it('handles multiple meals', () => {
      expect(calculateCO2('non_veg_meal', 5)).toBe(10.0)
    })
    it('non-veg meal produces 4x more CO2 than veg meal', () => {
      const veg = calculateCO2('veg_meal', 1)
      const nonVeg = calculateCO2('non_veg_meal', 1)
      expect(nonVeg).toBe(4 * veg)
    })
  })

  describe('edge cases', () => {
    it('returns 0 for zero quantity', () => {
      expect(calculateCO2('car', 0)).toBe(0)
    })
    it('handles fractional quantities', () => {
      expect(calculateCO2('car', 1.5)).toBe(0.3)
    })
    it('result is always a number', () => {
      for (const type of Object.keys(EMISSION_FACTORS) as Array<keyof typeof EMISSION_FACTORS>) {
        expect(typeof calculateCO2(type, 100)).toBe('number')
      }
    })
  })

  describe('EMISSION_FACTORS', () => {
    it('has exactly the specified factor values', () => {
      expect(EMISSION_FACTORS.car).toBe(0.20)
      expect(EMISSION_FACTORS.bus).toBe(0.08)
      expect(EMISSION_FACTORS.flight).toBe(0.25)
      expect(EMISSION_FACTORS.electricity).toBe(0.80)
      expect(EMISSION_FACTORS.veg_meal).toBe(0.5)
      expect(EMISSION_FACTORS.non_veg_meal).toBe(2.0)
    })
  })

  describe('ABSURD_THRESHOLDS', () => {
    it('car threshold is 2000 km', () => {
      expect(ABSURD_THRESHOLDS.car).toBe(2000)
    })
    it('bus threshold is 2000 km', () => {
      expect(ABSURD_THRESHOLDS.bus).toBe(2000)
    })
    it('flight threshold is 20000 km', () => {
      expect(ABSURD_THRESHOLDS.flight).toBe(20000)
    })
    it('electricity threshold is 10000 kWh', () => {
      expect(ABSURD_THRESHOLDS.electricity).toBe(10000)
    })
    it('meal thresholds are 20', () => {
      expect(ABSURD_THRESHOLDS.veg_meal).toBe(20)
      expect(ABSURD_THRESHOLDS.non_veg_meal).toBe(20)
    })
  })
})
