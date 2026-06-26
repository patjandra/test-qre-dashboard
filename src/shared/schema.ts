// Zod schemas validating IPC payloads at the main-process boundary.
import { z } from 'zod'

export const architectureModelSchema = z.object({
  kind: z.literal('GateBased'),
  errorRate: z.number().positive().max(1),
  gateTimeNs: z.number().positive(),
  measurementTimeNs: z.number().positive()
})

export const errorCorrectionSchema = z.object({
  qec: z.enum(['SurfaceCode', 'SurfaceCodeLowMove']),
  factory: z.literal('RoundBasedFactory')
})

export const applicationLangSchema = z.enum([
  'qsharp',
  'cirq',
  'openqasm',
  'qir',
  'logical-counts'
])

export const runInputsSchema = z.object({
  benchmarkId: z.string().optional(),
  applicationPath: z.string().min(1),
  applicationLang: applicationLangSchema,
  architectureModel: architectureModelSchema,
  errorCorrection: errorCorrectionSchema,
  errorBudget: z.number().positive().max(1),
  qreVersion: z.string().min(1)
})

export const compareRunsSchema = z.object({
  runIds: z.array(z.string().min(1)).min(2)
})

export const runIdSchema = z.object({ runId: z.string().min(1) })

export type RunInputsInput = z.infer<typeof runInputsSchema>
