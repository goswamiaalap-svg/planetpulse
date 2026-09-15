# Testing — PlanetPulse

## Unit Tests for `lib/co2.ts`

The core CO₂ calculation logic is covered by a Jest test suite in `lib/__tests__/co2.test.ts`.

### Running the Tests

```bash
# From the project root
npm test
```

This runs Jest with the pattern `lib/__tests__`, so only unit tests are executed (not Next.js integration tests).

### What's Tested

| Test Group | Coverage |
|---|---|
| `calculateCO2('car', ...)` | Factor 0.20 kg/km, rounding, multiple quantities |
| `calculateCO2('bus', ...)` | Factor 0.08 kg/km, edge cases |
| `calculateCO2('flight', ...)` | Factor 0.25 kg/km, short and long haul |
| `calculateCO2('electricity', ...)` | Factor 0.80 kg/kWh, monthly bill scenario |
| `calculateCO2('veg_meal', ...)` | Factor 0.5 kg/meal |
| `calculateCO2('non_veg_meal', ...)` | Factor 2.0 kg/meal, 4× veg ratio confirmed |
| Edge cases | Zero quantity, fractional quantities, return type |
| `EMISSION_FACTORS` | All 6 exact values asserted |
| `ABSURD_THRESHOLDS` | All 6 threshold values asserted |

### Example Test Output

```
PASS lib/__tests__/co2.test.ts
  calculateCO2
    car
      ✓ applies 0.20 kg/km factor correctly (2 ms)
      ✓ handles 100km car trip
      ✓ rounds to 3 decimal places
    bus
      ✓ applies 0.08 kg/km factor correctly
      ✓ handles 50km bus trip
      ✓ rounds correctly for fractional results
    flight
      ✓ applies 0.25 kg/km factor correctly
      ✓ handles long-haul flight (10000 km)
      ✓ handles short-haul flight (500 km)
    electricity
      ✓ applies 0.80 kg/kWh factor correctly
      ✓ handles monthly electricity bill (300 kWh)
      ✓ handles 1 kWh
    veg_meal
      ✓ applies 0.5 kg/meal factor correctly
      ✓ handles multiple meals
      ✓ handles 2 meals
    non_veg_meal
      ✓ applies 2.0 kg/meal factor correctly
      ✓ handles multiple meals
      ✓ non-veg meal produces 4x more CO2 than veg meal
    edge cases
      ✓ returns 0 for zero quantity
      ✓ handles fractional quantities
      ✓ result is always a number
    EMISSION_FACTORS
      ✓ has exactly the specified factor values
    ABSURD_THRESHOLDS
      ✓ car threshold is 2000 km
      ✓ bus threshold is 2000 km
      ✓ flight threshold is 20000 km
      ✓ electricity threshold is 10000 kWh
      ✓ meal thresholds are 20

Test Suites: 1 passed, 1 total
Tests:       27 passed, 27 total
```

### Dependencies

The test setup uses:
- `jest` — test runner
- `ts-jest` — TypeScript transformer for Jest
- `@types/jest` — TypeScript type definitions

These are all in `devDependencies` and installed via `npm install`.

### Configuration

- **`jest.config.js`** — sets `preset: 'ts-jest'`, `testEnvironment: 'node'`, and the `@/` module alias
- **`tsconfig.json`** — `ts-jest` uses a `commonjs` module override for test compatibility
