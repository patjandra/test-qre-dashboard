// Generates a default, human-readable run name from a run's configuration.
// Used both as the Dashboard placeholder and as the main-process fallback when
// the user doesn't type a name.

export function defaultRunName(
  benchmarkLabel: string,
  qec: string,
  errorBudget: number
): string {
  return `${benchmarkLabel} · ${qec} · budget ${errorBudget}`
}
