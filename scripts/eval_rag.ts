/**
 * scripts/eval_rag.ts
 * CLI evaluation suite runner for PlanetPulse RAG System
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/eval_rag.ts [--suite=all|retriever|generator|safety|latency]
 */

import fs from 'fs'
import path from 'path'
import { evaluateRetriever } from '../lib/rag/eval/retrieverEvaluator'
import { evaluateGenerator } from '../lib/rag/eval/generatorEvaluator'
import { evaluateEndToEnd } from '../lib/rag/eval/e2eEvaluator'

async function main() {
  const args = process.argv.slice(2)
  const suiteArg = args.find((a) => a.startsWith('--suite='))?.split('=')[1] || 'all'

  console.log('\n===============================================================')
  console.log('       PLANETPULSE RAG SYSTEM — EVALUATION & AUDIT SUITE       ')
  console.log('===============================================================\n')

  const reportDir = path.join(process.cwd(), 'eval_reports')
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true })
  }

  // 1. RETRIEVER EVALUATION
  if (suiteArg === 'all' || suiteArg === 'retriever') {
    console.log('▶ Running Retriever-Only Evaluation (K=1, 3, 5, 8, 10)...')
    const retReport = await evaluateRetriever([1, 3, 5, 8, 10])

    console.log('\n--- RETRIEVER PERFORMANCE BY K ---')
    console.table(
      Object.values(retReport.metricsByK).map((m) => ({
        K: m.k,
        'Hit Rate': `${(m.hitRate * 100).toFixed(1)}%`,
        Precision: `${(m.precision * 100).toFixed(1)}%`,
        Recall: `${(m.recall * 100).toFixed(1)}%`,
        MRR: m.mrr,
        'Avg Score': m.avgScore,
      }))
    )

    console.log(`Optimal K chosen: K=${retReport.bestK}`)
    console.log(`Latency: p50 = ${retReport.p50LatencyMs}ms, p95 = ${retReport.p95LatencyMs}ms, avg = ${retReport.avgLatencyMs}ms`)
    fs.writeFileSync(path.join(reportDir, 'retriever_report.json'), JSON.stringify(retReport, null, 2))
  }

  // 2. GENERATOR EVALUATION
  if (suiteArg === 'all' || suiteArg === 'generator') {
    console.log('\n▶ Running Generator-Only Controlled Context Evaluation...')
    const genReport = await evaluateGenerator()

    console.log('\n--- GENERATOR CONTROLLED SCENARIOS ---')
    console.table(
      genReport.scenarios.map((s) => ({
        Scenario: s.scenario,
        Passed: s.passed ? '✅ PASS' : '❌ FAIL',
        Faithfulness: s.faithfulnessScore,
        Relevancy: s.relevancyScore,
        Refusal: s.refusalCompliance ? 'YES' : 'NO',
      }))
    )

    console.log(`Generator Pass Rate: ${genReport.passedCount}/${genReport.totalScenarios} (${((genReport.passedCount / genReport.totalScenarios) * 100).toFixed(1)}%)`)
    fs.writeFileSync(path.join(reportDir, 'generator_report.json'), JSON.stringify(genReport, null, 2))
  }

  // 3. END-TO-END & SAFETY EVALUATION
  if (suiteArg === 'all' || suiteArg === 'safety' || suiteArg === 'latency' || suiteArg === 'e2e') {
    console.log('\n▶ Running End-to-End Golden Dataset (85 test cases) & Safety Suite...')
    const e2eReport = await evaluateEndToEnd()

    console.log('\n--- CATEGORY PERFORMANCE SUMMARY ---')
    console.table(
      Object.entries(e2eReport.categorySummary).map(([cat, d]) => ({
        Category: cat,
        Total: d.total,
        Passed: d.passed,
        'Pass Rate': `${(d.passRate * 100).toFixed(1)}%`,
        'Avg Latency (ms)': d.avgLatencyMs,
      }))
    )

    console.log('\n--- SAFETY & ROBUSTNESS METRICS ---')
    console.log(`• Out-of-Domain Rejection Rate: ${(e2eReport.safetyMetrics.outOfDomainRejectionRate * 100).toFixed(1)}%`)
    console.log(`• Prompt Injection Resistance Rate: ${(e2eReport.safetyMetrics.promptInjectionResistanceRate * 100).toFixed(1)}%`)
    console.log(`• Non-Existent KB Fact Abstention Accuracy: ${(e2eReport.safetyMetrics.abstentionAccuracy * 100).toFixed(1)}%`)
    console.log(`• Hallucination Rate: ${(e2eReport.safetyMetrics.hallucinationRate * 100).toFixed(1)}%`)

    console.log('\n--- LATENCY PROFILING ---')
    console.log(`• p50 Latency: ${e2eReport.latencyMetrics.p50Ms} ms`)
    console.log(`• p95 Latency: ${e2eReport.latencyMetrics.p95Ms} ms`)
    console.log(`• Avg Latency: ${e2eReport.latencyMetrics.avgMs} ms`)

    if (e2eReport.failedCases.length > 0) {
      console.log('\n⚠️ FAILED CASES BREAKDOWN:')
      e2eReport.failedCases.forEach((f) => {
        console.log(`  [${f.id}] (${f.category}) "${f.query}" -> Decision: ${f.actualDecision} (Expected: ${f.expectedBehavior})`)
      })
    } else {
      console.log('\n🎉 ALL 85 TEST CASES PASSED WITH 100% SUCCESS!')
    }

    fs.writeFileSync(path.join(reportDir, 'e2e_report.json'), JSON.stringify(e2eReport, null, 2))
  }

  console.log('\n===============================================================')
  console.log(`Detailed machine-readable JSON reports saved to: ${reportDir}`)
  console.log('===============================================================\n')
}

main().catch((err) => {
  console.error('[eval_rag] Fatal error during evaluation:', err)
  process.exit(1)
})
