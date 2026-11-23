/**
 * Formata uma duração em minutos inteiros para exibição humana ("45 min", "2h", "1h 20min").
 * Retorna "-" para valores nulos ou menores/iguais a zero.
 */
export function formatDurationMinutes(minutes?: number | null): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) {
    return "-";
  }
  const rounded = Math.round(minutes);
  if (rounded <= 0) {
    return "-";
  }
  if (rounded < 60) {
    return `${rounded} min`;
  }
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`;
}

/**
 * Converte entradas textuais flexíveis de duração ("80", "80 min", "2h", "1h20", "1h 20min")
 * para minutos inteiros positivos. Retorna null quando vazio ou inválido.
 */
export function parseDurationToMinutes(input: string): number | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const hoursMatch = /^(\d+)\s*h(?:\s*(\d{1,2})\s*(?:min|m)?)?$/i.exec(trimmed);
  if (hoursMatch) {
    const hours = Number(hoursMatch[1]);
    const mins = hoursMatch[2] ? Number(hoursMatch[2]) : 0;
    if (!Number.isInteger(hours) || !Number.isInteger(mins) || mins < 0 || mins >= 60) {
      return null;
    }
    const total = hours * 60 + mins;
    return total > 0 && total <= 1440 ? total : null;
  }

  const minsOnlyMatch = /^(\d+)\s*(?:min|m)?$/i.exec(trimmed);
  if (minsOnlyMatch) {
    const mins = Number(minsOnlyMatch[1]);
    return Number.isInteger(mins) && mins > 0 && mins <= 1440 ? mins : null;
  }

  return null;
}
