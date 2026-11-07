const METS: Record<string, number> = { walking: 3.5, running: 7.0 }
const WEIGHTS: Record<string, Record<string, number>> = {
  male:   { '10s': 60, '20s': 68, '30s': 72, '40s': 74, '50s': 73, '60s': 70 },
  female: { '10s': 50, '20s': 52, '30s': 54, '40s': 55, '50s': 55, '60s': 53 },
  other:  { '10s': 55, '20s': 60, '30s': 63, '40s': 64, '50s': 63, '60s': 61 },
}

export function calculateCalories(exerciseType: string, durationMin: number, gender: string, ageGroup: string): number {
  const met = METS[exerciseType] ?? 3.5
  const weight = (WEIGHTS[gender] ?? WEIGHTS.other)[ageGroup] ?? 65
  return Math.round(met * weight * (durationMin / 60))
}

export function getFoodExample(kcal: number): string {
  if (kcal < 100) return 'おにぎり0.5個分！'
  if (kcal < 200) return 'おにぎり1個分！'
  if (kcal < 300) return 'ラーメン0.5杯分！'
  if (kcal < 400) return 'ラーメン1杯分！'
  if (kcal < 500) return '焼肉定食0.5人前！'
  if (kcal < 700) return '焼肉定食1人前！'
  return 'すき焼き1人前！'
}
