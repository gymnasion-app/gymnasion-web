/** Ticks do eixo Y dos gráficos de linha. */

/** Passo "redondo" (1, 2, 5 × 10^n) para os ticks do eixo Y. */
function niceStep(rough: number): number {
  if (!Number.isFinite(rough) || rough <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(rough)));
  const f = rough / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
}

export function niceTicks(min: number, max: number, count: number): number[] {
  let lo = min;
  let hi = max;
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.1 || 1;
    lo -= pad;
    hi += pad;
  }
  const step = niceStep((hi - lo) / Math.max(1, count - 1));
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  // Quantidade calculada antes do laço: nunca entra em loop, mesmo com passo abaixo da precisão do número
  const total = Math.min(50, Math.max(1, Math.round((end - start) / step) + 1));
  return Array.from({ length: total }, (_, i) => Number((start + i * step).toFixed(10)));
}
