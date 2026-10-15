/**
 * lib/rag/__tests__/evidence_guidance.test.ts
 * Automated regression test suite for PlanetPulse Evidence-Based Carbon Guidance
 * Tests Cases A through J as specified in the acceptance criteria.
 */

import { buildUserContext } from '../context/userContext'
import { CarbonCoachService } from '../services/carbonCoachService'
import { validateCoachOutput } from '../validation/outputValidator'
import { evaluateDomainGate, STANDARD_DOMAIN_REFUSAL, INSUFFICIENT_CONTEXT_REFUSAL } from '../guardrails/domainGate'
import { classifyQuery } from '../query/queryClassifier'
import { Activity } from '@/lib/supabase'

describe('Evidence-Based Personalized Carbon Guidance Suite (Cases A - J)', () => {
  const coachService = new CarbonCoachService()

  // --------------------------------------------------------------------------
  // Case A: All sectors have actual, valid zero emissions (zero_measured)
  // --------------------------------------------------------------------------
  test('Case A: All sectors have actual, valid zero emissions (zero_measured)', async () => {
    const zeroActivities: Activity[] = [
      { id: '1', type: 'car', quantity: 0, co2_kg: 0, date: '2026-10-15', created_at: '' },
      { id: '2', type: 'electricity', quantity: 0, co2_kg: 0, date: '2026-10-15', created_at: '' },
    ]

    const ctx = buildUserContext(zeroActivities, 25, {
      reportingPeriod: { from: '2026-10-12', to: '2026-10-18' },
    })

    expect(ctx.dataStatus).toBe('zero_measured')
    expect(ctx.weeklyTotalCO2).toBe(0)
    expect(ctx.isZeroFootprint).toBe(true)
    expect(ctx.hasValidFootprint).toBe(true)
    expect(ctx.largestCategory).toBeNull()

    const res = await coachService.consultCoach('What did I emit this week?', ctx)
    expect(res.grounded).toBe(true)
    expect(res.answer).toContain('0.0 kg CO₂')
    expect(res.answer).toContain('zero net carbon intensity')
    // Must NOT claim any sector is the primary emitter
    expect(res.answer).not.toMatch(/primary emitting sector is/i)
  })

  // --------------------------------------------------------------------------
  // Case B: Sector emissions are missing or null (empty data)
  // --------------------------------------------------------------------------
  test('Case B: Sector emissions are missing or null (empty data)', async () => {
    const ctx = buildUserContext([], 30, {
      reportingPeriod: { from: '2026-10-12', to: '2026-10-18' },
    })

    expect(ctx.dataStatus).toBe('empty')
    expect(ctx.weeklyTotalCO2).toBe(0)
    expect(ctx.largestCategory).toBeNull()
    expect(ctx.sectorsWithData.length).toBe(0)
    expect(ctx.sectorsMissing.length).toBe(6)

    // Direct footprint explanation
    const statsRes = await coachService.consultCoach('What is my largest emission source?', ctx)
    expect(statsRes.grounded).toBe(true)
    expect(statsRes.answer).toContain('uncalculated')
    expect(statsRes.answer).not.toContain('0.0 kg CO₂')
    expect(statsRes.answer).toContain('cannot be determined')
    expect(statsRes.answer).not.toMatch(/primary emitting sector is/i)

    // Reduction advice query when data is empty
    const adviceRes = await coachService.consultCoach('How can I reduce my carbon footprint?', ctx)
    expect(adviceRes.answer).not.toContain('none habits')
    expect(adviceRes.answer).not.toContain('short trips currently taken by none')
    // Recommendations must suggest logging, not buying an EV or carpooling
    const hasUnsolicitedCarAdvice = adviceRes.recommendations.some(
      (r) => /electric vehicle|carpool|driving habits/i.test(r)
    )
    expect(hasUnsolicitedCarAdvice).toBe(false)
  })

  // --------------------------------------------------------------------------
  // Case C: Only some sectors have valid data (partial data)
  // --------------------------------------------------------------------------
  test('Case C: Only some sectors have valid data (partial data)', async () => {
    // Only electricity and vegetarian meal logged; transportation is completely unrecorded
    const partialActivities: Activity[] = [
      { id: '1', type: 'electricity', quantity: 50, co2_kg: 40.0, date: '2026-10-14', created_at: '' },
      { id: '2', type: 'veg_meal', quantity: 4, co2_kg: 2.0, date: '2026-10-14', created_at: '' },
    ]

    const ctx = buildUserContext(partialActivities, 35)

    expect(ctx.dataStatus).toBe('partial')
    expect(ctx.weeklyTotalCO2).toBe(42.0)
    expect(ctx.largestCategory).toBe('Electricity')
    expect(ctx.sectorsWithData).toContain('Electricity')
    expect(ctx.sectorsWithData).toContain('Vegetarian meal')
    expect(ctx.sectorsMissing).toContain('Car travel')
    expect(ctx.sectorsMissing).toContain('Flight')

    const res = await coachService.consultCoach('Explain my footprint and give me advice', ctx)
    expect(res.answer).toContain('42')
    expect(res.answer).toContain('Electricity')
    // Since user has no car activity and didn't ask about cars, recommendations must NOT demand EV or carpooling
    for (const rec of res.recommendations) {
      expect(rec).not.toMatch(/electric vehicle|carpool|short trips currently taken by car/i)
    }
  })

  // --------------------------------------------------------------------------
  // Case D: Transportation has the highest recorded emissions
  // --------------------------------------------------------------------------
  test('Case D: Transportation has the highest recorded emissions', async () => {
    const transportActivities: Activity[] = [
      { id: '1', type: 'car', quantity: 250, co2_kg: 50.0, date: '2026-10-13', created_at: '' },
      { id: '2', type: 'electricity', quantity: 15, co2_kg: 12.0, date: '2026-10-13', created_at: '' },
    ]

    const ctx = buildUserContext(transportActivities, 40)

    expect(ctx.largestCategory).toBe('Car travel')
    expect(ctx.largestCategoryCO2).toBe(50.0)

    const res = await coachService.consultCoach('How can I reduce my carbon footprint?', ctx)
    expect(res.grounded).toBe(true)
    expect(res.summary).toContain('Car travel')
    // Recommendations should target the recorded vehicle usage
    const hasTransportRec = res.recommendations.some(
      (r) => /vehicle|transit|trips|errands/i.test(r)
    )
    expect(hasTransportRec).toBe(true)
  })

  // --------------------------------------------------------------------------
  // Case E: Another sector has the highest recorded emissions (Diet / Meals)
  // --------------------------------------------------------------------------
  test('Case E: Non-transportation sector has the highest recorded emissions (Diet)', async () => {
    const dietActivities: Activity[] = [
      { id: '1', type: 'non_veg_meal', quantity: 12, co2_kg: 24.0, date: '2026-10-14', created_at: '' },
      { id: '2', type: 'car', quantity: 10, co2_kg: 2.0, date: '2026-10-14', created_at: '' },
    ]

    const ctx = buildUserContext(dietActivities, 15)

    expect(ctx.largestCategory).toBe('Non-veg meal')
    expect(ctx.largestCategoryCO2).toBe(24.0)

    const res = await coachService.consultCoach('How do I reduce my emissions?', ctx)
    expect(res.summary).toContain('Non-veg meal')
    // Recommendations should prioritize dietary / meal shifts
    const hasDietRec = res.recommendations.some(
      (r) => /plant|vegetarian|meal|meat/i.test(r)
    )
    expect(hasDietRec).toBe(true)
  })

  // --------------------------------------------------------------------------
  // Case F: The RAG retriever returns irrelevant documents / ungrounded entity
  // --------------------------------------------------------------------------
  test('Case F: The RAG retriever abstains on ungrounded domain concepts', async () => {
    const q = 'What is the carbon emission factor of building a titanium submarine in Antarctica?'
    const dummyCtx = buildUserContext([], 20)

    const res = await coachService.consultCoach(q, dummyCtx)
    expect(res.grounded).toBe(false)
    expect(res.answer).toBe(INSUFFICIENT_CONTEXT_REFUSAL)
    expect(res.trace?.finalDecision).toBe('abstained_insufficient_context')
    expect(res.sources.length).toBe(0)
  })

  // --------------------------------------------------------------------------
  // Case G: The RAG retriever returns no documents (confidence gate)
  // --------------------------------------------------------------------------
  test('Case G: The RAG retriever returns no documents and triggers safe abstention', async () => {
    const q = 'What are the emission guidelines for hypergolic propellant smelting in Peru?'
    const dummyCtx = buildUserContext([], 20)

    const res = await coachService.consultCoach(q, dummyCtx)
    expect(res.grounded).toBe(false)
    expect(res.answer).toContain("don't have enough")
    expect(res.sources.length).toBe(0)
  })

  // --------------------------------------------------------------------------
  // Case H: The model produces a numerical claim unsupported by retrieved evidence
  // --------------------------------------------------------------------------
  test('Case H: Output validator detects and rejects unsupported numerical claims', () => {
    const dummyCtx = buildUserContext(
      [{ id: '1', type: 'car', quantity: 50, co2_kg: 10.0, date: '2026-10-14', created_at: '' }],
      20
    ) // weeklyTotalCO2 is 10.0

    const decision = {
      isAllowed: true,
      category: 'carbon_tracking' as const,
      confidence: 0.95,
      normalizedQuery: 'what is my footprint',
    }

    // Answer claims user logged 450 kg CO2 (hallucination / numerical discrepancy)
    const hallucinatedAnswer = 'Based on your dashboard ledger, you have logged 450.0 kg of CO2 this week.'
    const validation = validateCoachOutput(hallucinatedAnswer, decision, dummyCtx, '', false)

    expect(validation.isValid).toBe(false)
    expect(validation.violations.some((v) => v.includes('Numerical mismatch'))).toBe(true)
    expect(validation.unsupportedClaimsCount).toBeGreaterThan(0)
  })

  // --------------------------------------------------------------------------
  // Case I: A user asks an unrelated question (domain gate rejection)
  // --------------------------------------------------------------------------
  test('Case I: Domain gate rejects unrelated question without calling RAG or LLM', async () => {
    const questions = [
      'What is the capital of France?',
      'Write a Python quicksort algorithm',
      'Who won the 2024 World Cup?',
      'How to make homemade pizza dough?',
    ]

    const dummyCtx = buildUserContext([], 20)

    for (const q of questions) {
      const gate = evaluateDomainGate(q)
      expect(gate.isAllowed).toBe(false)
      expect(gate.category).toBe('out_of_domain')

      const res = await coachService.consultCoach(q, dummyCtx)
      expect(res.grounded).toBe(false)
      expect(res.answer).toContain('I can help with carbon emissions')
      expect(res.trace?.finalDecision).toBe('rejected_out_of_domain')
      expect(res.sources.length).toBe(0)
    }
  })

  // --------------------------------------------------------------------------
  // Case J: The database query fails or returns incomplete results (db_error)
  // --------------------------------------------------------------------------
  test('Case J: Database query failure handled transparently without fabricating zero data', async () => {
    const ctx = buildUserContext([], 20, {
      dbError: 'Supabase connection timeout: socket hang up',
      reportingPeriod: { from: '2026-10-12', to: '2026-10-18' },
    })

    expect(ctx.dataStatus).toBe('db_error')
    expect(ctx.hasValidFootprint).toBe(false)
    expect(ctx.dbErrorMessage).toContain('Supabase connection timeout')

    const res = await coachService.consultCoach('What did I emit this week?', ctx)
    expect(res.grounded).toBe(false)
    expect(res.answer).toContain('unable to retrieve your activity records')
    expect(res.answer).toContain('database')
    // Must NOT say the footprint is 0 or suggest an EV
    expect(res.answer).not.toMatch(/primary emitting sector is/i)
  })
})
