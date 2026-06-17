import { Injectable } from '@nestjs/common';

type SizeRecommendationInput = {
  categoryName?: string | null;
  selectedSize?: string | null;
  selectedRussianSize?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  gender?: string | null;
  bodyType?: string | null;
  bodyTraits?: string[];
};

type SizeOption = { letter: string; ru: string };

// Ordered small -> large. RU ranges follow the storefront label style ("S / 42-44").
const FEMALE_SIZES: SizeOption[] = [
  { letter: 'XS', ru: '40-42' },
  { letter: 'S', ru: '42-44' },
  { letter: 'M', ru: '44-46' },
  { letter: 'L', ru: '46-48' },
  { letter: 'XL', ru: '48-50' },
  { letter: '2XL', ru: '50-52' },
  { letter: '3XL', ru: '52-54' },
  { letter: '4XL', ru: '54-56' },
  { letter: '5XL', ru: '56-58' },
];

const MALE_SIZES: SizeOption[] = [
  { letter: 'S', ru: '44-46' },
  { letter: 'M', ru: '46-48' },
  { letter: 'L', ru: '48-50' },
  { letter: 'XL', ru: '50-52' },
  { letter: '2XL', ru: '52-54' },
  { letter: '3XL', ru: '54-56' },
  { letter: '4XL', ru: '56-58' },
  { letter: '5XL', ru: '58-60' },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Base size index from weight at a reference height.
function femaleBaseIndex(weight: number): number {
  if (weight <= 47) return 0; // XS
  if (weight <= 54) return 1; // S
  if (weight <= 61) return 2; // M
  if (weight <= 69) return 3; // L
  if (weight <= 78) return 4; // XL
  if (weight <= 88) return 5; // 2XL
  if (weight <= 98) return 6; // 3XL
  if (weight <= 110) return 7; // 4XL
  return 8; // 5XL
}

function maleBaseIndex(weight: number): number {
  if (weight <= 60) return 0; // S
  if (weight <= 69) return 1; // M
  if (weight <= 78) return 2; // L
  if (weight <= 88) return 3; // XL
  if (weight <= 98) return 4; // 2XL
  if (weight <= 110) return 5; // 3XL
  return 6; // 4XL
}

// Shorter people carry the same weight over less length -> larger size, and vice versa.
function femaleHeightAdjust(height: number): number {
  if (height <= 152) return 1;
  if (height <= 173) return 0;
  if (height <= 181) return -1;
  return -2;
}

function maleHeightAdjust(height: number): number {
  if (height <= 165) return 1;
  if (height <= 184) return 0;
  return -1;
}

@Injectable()
export class SizeRecommendationService {
  recommend(input: SizeRecommendationInput) {
    const height = this.toNumber(input.heightCm);
    const weight = this.toNumber(input.weightKg);
    const isMale = (input.gender ?? '').toLowerCase() === 'male';
    const sizes = isMale ? MALE_SIZES : FEMALE_SIZES;

    // Without body measurements we cannot compute a real recommendation,
    // so we keep the selected size as a reference baseline.
    if (!height || !weight || height < 80 || weight < 25) {
      return {
        recommendedSize: input.selectedSize ?? null,
        recommendedRussianSize: input.selectedRussianSize ?? null,
        note: 'Enter your height and weight to get a real size recommendation. Showing the selected size for now.',
        noteEn:
          'Enter your height and weight to get a real size recommendation. Showing the selected size for now.',
        noteRu:
          'Укажите рост и вес, чтобы получить точную рекомендацию размера. Пока показан выбранный размер.',
        confidence: 'low' as const,
      };
    }

    const baseIndex = isMale ? maleBaseIndex(weight) : femaleBaseIndex(weight);
    const adjust = isMale
      ? maleHeightAdjust(height)
      : femaleHeightAdjust(height);
    const recIndex = clamp(baseIndex + adjust, 0, sizes.length - 1);
    const rec = sizes[recIndex];

    const selectedIndex = this.parseSelectedIndex(
      sizes,
      input.selectedSize,
      input.selectedRussianSize,
    );

    const recLabel = `${rec.letter} / ${rec.ru}`;
    let noteRu: string;
    let noteEn: string;

    if (selectedIndex === null) {
      noteRu = `По росту ${height} см и весу ${weight} кг рекомендуем размер ${recLabel}.`;
      noteEn = `For ${height} cm and ${weight} kg we recommend size ${recLabel}.`;
    } else if (recIndex > selectedIndex) {
      const sel = sizes[selectedIndex];
      noteRu = `По росту ${height} см и весу ${weight} кг рекомендуем ${recLabel}. Выбранный размер ${sel.letter} может быть маловат и сидеть в обтяжку.`;
      noteEn = `For ${height} cm and ${weight} kg we recommend ${recLabel}. The selected size ${sel.letter} may be too tight.`;
    } else if (recIndex < selectedIndex) {
      const sel = sizes[selectedIndex];
      noteRu = `По росту ${height} см и весу ${weight} кг рекомендуем ${recLabel}. Выбранный размер ${sel.letter} может быть великоват.`;
      noteEn = `For ${height} cm and ${weight} kg we recommend ${recLabel}. The selected size ${sel.letter} may be too loose.`;
    } else {
      noteRu = `По росту ${height} см и весу ${weight} кг выбранный размер ${recLabel} вам подходит.`;
      noteEn = `For ${height} cm and ${weight} kg the selected size ${recLabel} fits you well.`;
    }

    return {
      recommendedSize: rec.letter,
      recommendedRussianSize: rec.ru,
      note: noteEn,
      noteEn,
      noteRu,
      confidence: 'high' as const,
    };
  }

  private toNumber(value: number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parseSelectedIndex(
    sizes: SizeOption[],
    selectedSize?: string | null,
    selectedRussianSize?: string | null,
  ): number | null {
    const normalized = (selectedSize ?? '').toUpperCase().replace(/\s+/g, '');

    if (normalized) {
      // Match the longest letter token first so "2XL" wins over "XL"/"L".
      const byLetterLength = sizes
        .map((size, index) => ({ index, letter: size.letter.toUpperCase() }))
        .sort((a, b) => b.letter.length - a.letter.length);
      for (const candidate of byLetterLength) {
        if (normalized.includes(candidate.letter)) {
          return candidate.index;
        }
      }
    }

    const russianSource = `${selectedRussianSize ?? ''}${selectedSize ?? ''}`;
    const match = russianSource.match(/\d{2}/);
    if (match) {
      const target = Number(match[0]);
      let bestIndex: number | null = null;
      let bestDelta = Number.POSITIVE_INFINITY;
      sizes.forEach((size, index) => {
        for (const part of size.ru.split('-')) {
          const delta = Math.abs(Number(part) - target);
          if (delta < bestDelta) {
            bestDelta = delta;
            bestIndex = index;
          }
        }
      });
      return bestIndex;
    }

    return null;
  }
}
