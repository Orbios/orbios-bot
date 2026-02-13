import SupportedLanguages from '../enums/supportedLanguages.js';

/**
 * Detected language result
 */
export type LanguageDetectionResult = {
  language: SupportedLanguages;
  confidence: 'high' | 'medium' | 'low';
  method: 'cyrillic-analysis' | 'franc' | 'fallback';
}

/**
 * Ukrainian-specific characters (not present in Russian)
 */
const UKRAINIAN_ONLY_CHARS = /[іїєґІЇЄҐ]/;

/**
 * Russian-specific characters (not present in Ukrainian)
 */
const RUSSIAN_ONLY_CHARS = /[ыэёъЫЭЁЪ]/;

/**
 * Common Ukrainian words that help distinguish from Russian
 */
const UKRAINIAN_WORDS = [
  'також',
  'будь ласка',
  'дякую',
  'привіт',
  'ласкаво просимо',
  'дуже',
  'немає',
  'є',
  'що',
  'який',
  'яка',
  'яке',
  'які',
  'цей',
  'ця',
  'це',
  'ці',
  'мій',
  'моя',
  'моє',
  'мої',
  'твій',
  'твоя',
  'твоє',
  'твої',
  'добрий',
  'добра',
  'добре',
  'день',
  'працює',
  'працюють',
];

/**
 * Common Russian words that help distinguish from Ukrainian
 */
const RUSSIAN_WORDS = [
  'также',
  'пожалуйста',
  'спасибо',
  'привет',
  'очень',
  'нет',
  'этот',
  'эта',
  'это',
  'эти',
  'мой',
  'моя',
  'мое',
  'мои',
  'твой',
  'твоя',
  'твое',
  'твои',
  'который',
  'которая',
  'которое',
  'которые',
  'добрый',
  'добрая',
  'доброе',
  'день',
  'работает',
  'работают',
  'программа',
];

/**
 * Check if text contains Cyrillic characters
 */
function hasCyrillic(text: string): boolean {
  return /[\u0400-\u04FF]/.test(text);
}

/**
 * Analyze Cyrillic text to distinguish between Ukrainian and Russian
 * This is the most reliable method for short texts
 */
function analyzeCyrillicText(text: string): LanguageDetectionResult | null {
  if (!hasCyrillic(text)) {
    return null;
  }

  const lowerText = text.toLowerCase();

  // Check for Ukrainian-only characters
  const hasUkrainianChars = UKRAINIAN_ONLY_CHARS.test(text);
  const hasRussianChars = RUSSIAN_ONLY_CHARS.test(text);

  // If we find Ukrainian-specific characters, it's definitely Ukrainian
  if (hasUkrainianChars && !hasRussianChars) {
    return {
      language: SupportedLanguages.UA,
      confidence: 'high',
      method: 'cyrillic-analysis',
    };
  }

  // If we find Russian-specific characters, it's definitely Russian
  if (hasRussianChars && !hasUkrainianChars) {
    return {
      language: SupportedLanguages.RU,
      confidence: 'high',
      method: 'cyrillic-analysis',
    };
  }

  // Check for Ukrainian-specific words
  const ukrainianWordCount = UKRAINIAN_WORDS.filter(word => lowerText.includes(word)).length;
  const russianWordCount = RUSSIAN_WORDS.filter(word => lowerText.includes(word)).length;

  if (ukrainianWordCount > russianWordCount) {
    return {
      language: SupportedLanguages.UA,
      confidence: ukrainianWordCount >= 2 ? 'high' : 'medium',
      method: 'cyrillic-analysis',
    };
  }

  if (russianWordCount > ukrainianWordCount) {
    return {
      language: SupportedLanguages.RU,
      confidence: russianWordCount >= 2 ? 'high' : 'medium',
      method: 'cyrillic-analysis',
    };
  }

  // If we can't determine from characters or words, return null to try franc
  return null;
}

/**
 * Use franc library for language detection
 * Good for longer texts and non-Cyrillic languages
 */
async function detectWithFranc(text: string): Promise<LanguageDetectionResult | null> {
  // franc requires at least 10 characters for reliable detection
  if (text.length < 10) {
    return null;
  }

  // Dynamic import for ESM module compatibility
  const { franc } = await import('franc-min');
  const francResult = franc(text, { minLength: 3 });

  // Map franc ISO 639-3 codes to our language types
  const languageMap: Record<string, SupportedLanguages> = {
    eng: SupportedLanguages.EN,
    tha: SupportedLanguages.TH,
    rus: SupportedLanguages.TH,
    ukr: SupportedLanguages.UA,
  };

  const detectedLang = languageMap[francResult];
  if (detectedLang) {
    return {
      language: detectedLang,
      confidence: text.length > 50 ? 'high' : 'medium',
      method: 'franc',
    };
  }

  return null;
}

/**
 * Fallback detection based on script type
 */
function fallbackDetection(text: string): LanguageDetectionResult {
  // Check for Thai script
  if (/[\u0E00-\u0E7F]/.test(text)) {
    return {
      language: SupportedLanguages.TH,
      confidence: 'high',
      method: 'fallback',
    };
  }

  // Check for Cyrillic (default to Ukrainian if can't distinguish)
  if (hasCyrillic(text)) {
    return {
      language: SupportedLanguages.UA,
      confidence: 'low',
      method: 'fallback',
    };
  }

  // Default to English
  return {
    language: SupportedLanguages.EN,
    confidence: 'low',
    method: 'fallback',
  };
}

/**
 * Detect language of the given text
 * Uses a multi-stage approach for maximum accuracy
 */
export async function detectLanguage(text: string): Promise<LanguageDetectionResult> {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return {
      language: SupportedLanguages.EN,
      confidence: 'low',
      method: 'fallback',
    };
  }

  // Stage 1: Cyrillic character analysis (most reliable for Russian/Ukrainian)
  const cyrillicResult = analyzeCyrillicText(trimmedText);
  if (cyrillicResult && cyrillicResult.confidence === 'high') {
    return cyrillicResult;
  }

  // Stage 2: Try franc for longer texts
  const francResult = await detectWithFranc(trimmedText);
  if (francResult) {
    // If franc disagrees with medium-confidence cyrillic analysis, prefer cyrillic
    if (cyrillicResult && (francResult.language === SupportedLanguages.RU || francResult.language === SupportedLanguages.UA)) {
      return cyrillicResult;
    }
    return francResult;
  }

  // Stage 3: Return medium-confidence cyrillic result if available
  if (cyrillicResult) {
    return cyrillicResult;
  }

  // Stage 4: Fallback detection
  return fallbackDetection(trimmedText);
}

/**
 * Check if the detection is reliable enough to trust
 */
export function isReliableDetection(result: LanguageDetectionResult): boolean {
  return result.confidence === 'high' || (result.confidence === 'medium' && result.method === 'cyrillic-analysis');
}
