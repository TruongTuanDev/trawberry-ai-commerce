import { Injectable } from '@nestjs/common';

type SizeRecommendationInput = {
  categoryName?: string | null;
  selectedSize?: string | null;
  selectedRussianSize?: string | null;
  bodyType?: string | null;
  bodyTraits?: string[];
};

@Injectable()
export class SizeRecommendationService {
  recommend(input: SizeRecommendationInput) {
    const bodyTraits = input.bodyTraits ?? [];
    const category = (input.categoryName ?? '').toLowerCase();
    const isTop = /(shirt|top|jacket|hoodie|sweater|dress|blouse|coat)/.test(
      category,
    );
    const isBottom = /(pants|jeans|skirt|shorts|trousers)/.test(category);

    let noteEn =
      'AI suggestion is for reference only. Your selected size is the current baseline.';
    let noteRu =
      'AI-рекомендация носит справочный характер. За основу взят выбранный размер.';
    let confidence: 'low' | 'medium' | 'high' = 'medium';

    if (input.bodyType === 'slim') {
      noteEn =
        'AI suggestion is for reference only. A slim build usually matches the selected size.';
      noteRu =
        'AI-рекомендация носит справочный характер. При худощавом телосложении выбранный размер часто подходит.';
      confidence = 'high';
    }

    if (bodyTraits.includes('wide_shoulders') && isTop) {
      noteEn =
        'AI suggestion is for reference only. Broad shoulders may need a roomier top, so consider one size up.';
      noteRu =
        'AI-рекомендация носит справочный характер. При широких плечах верх может потребовать более свободную посадку, рассмотрите размер больше.';
      confidence = 'medium';
    } else if (bodyTraits.includes('large_belly') && (isTop || isBottom)) {
      noteEn =
        'AI suggestion is for reference only. For a fuller midsection, a relaxed fit or one size up may feel more comfortable.';
      noteRu =
        'AI-рекомендация носит справочный характер. При более выраженном животе может быть комфортнее свободная посадка или размер больше.';
      confidence = 'medium';
    } else if (bodyTraits.includes('long_legs') && isBottom) {
      noteEn =
        'AI suggestion is for reference only. The selected size may fit, but check inseam and length carefully.';
      noteRu =
        'AI-рекомендация носит справочный характер. Выбранный размер может подойти, но длину изделия стоит проверить отдельно.';
      confidence = 'low';
    }

    return {
      recommendedSize: input.selectedSize ?? null,
      recommendedRussianSize: input.selectedRussianSize ?? null,
      note: noteEn,
      noteEn,
      noteRu,
      confidence,
    };
  }
}
