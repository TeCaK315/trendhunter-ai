// lib/competition/pain-matching.ts
// Pain matching + normalization
// mapPainsToCompetitor() and normalizePain()

interface UserPain {
  pain: string;
  paying_ratio: number;
}

interface MappedPain {
  pain: string;
  paying_ratio: number;
  status: 'FULLY' | 'PARTIALLY' | 'NOT_AT_ALL' | 'UNKNOWN';
}

const normalizePain = (pain: string): string =>
  pain
    .toLowerCase()
    .replace(/[^\wа-яёa-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Минимальная длина совпадения — защита от ложных матчей на коротких словах
// MIN=3 чтобы не терять короткие но важные термины: API, UX, CAC
const MIN_MATCH_LENGTH = 3;

export function mapPainsToCompetitor(
  userPains: UserPain[],
  p4PainGaps: Array<{ pain: string; status: 'FULLY' | 'PARTIALLY' | 'NOT_AT_ALL' | 'UNKNOWN' }>
): MappedPain[] {
  return userPains.map(up => {
    const normUp = normalizePain(up.pain);
    const match = p4PainGaps.find(gap => {
      const normGap = normalizePain(gap.pain);
      // Оба слова должны быть достаточно длинными для substring matching
      if (normUp.length < MIN_MATCH_LENGTH || normGap.length < MIN_MATCH_LENGTH) {
        return normUp === normGap; // только точное совпадение для коротких строк
      }
      return normUp.includes(normGap) || normGap.includes(normUp);
    });
    return {
      pain: up.pain,
      paying_ratio: up.paying_ratio,
      status: match?.status ?? 'UNKNOWN',
    };
  });
}

export { normalizePain };
export type { UserPain, MappedPain };
