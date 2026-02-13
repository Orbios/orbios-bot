import { EmbedBuilder } from 'discord.js';
import { MAX_LENGTH_FOR_DISCORD_MESSAGE } from '../constants/common.js';
import SupportedLanguages from '../enums/supportedLanguages.js';
import AIResponse from '../typings/AIResponse.js';
import { splitMessage } from './utils.js';

/**
 * Language labels for display
 */
const LANGUAGE_LABELS = {
  english: 'EN',
  thai: 'TH',
  russian: 'RU',
  ukrainian: 'UA',
  original: 'ORIGINAL',
} as const;

/**
 * Splits text into parts, not exceeding MAX_LENGTH_FOR_DISCORD_MESSAGE,
 * while spoilers ||...|| are not broken in the middle.
 */
function splitTextSafe(text: string, hasSpoiler: boolean): string[] {
  if (!hasSpoiler) {
    // Simple splitting by MAX_LENGTH_FOR_DISCORD_MESSAGE
    return splitMessage(text);
  }

  // If there are spoilers, we apply spoiler-breaking logic
  const MAX = MAX_LENGTH_FOR_DISCORD_MESSAGE;
  const messages: string[] = [];
  let remaining = text;

  while (remaining.length > MAX) {
    let chunk = remaining.slice(0, MAX);

    // Add || at the end/beginning to continue the spoiler
    if (!chunk.endsWith('||')) {
      chunk += '||';
      remaining = '||' + remaining.slice(MAX);
    } else {
      remaining = remaining.slice(MAX);
    }

    messages.push(chunk);
  }

  if (remaining.length > 0) {
    messages.push(remaining);
  }

  return messages;
}

/**
 * Formats translation response into Discord message format
 * - short messages → embed
 * - long messages → plain text
 */
export function formatTranslations(
  translations: AIResponse,
  userName: string,
  userAvatar: string,
  configuredLanguages: SupportedLanguages[],
): { embeds?: EmbedBuilder[]; messages?: string[] } {
  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setThumbnail(userAvatar)
    .setDescription(
      `# **${userName}** (${LANGUAGE_LABELS[translations.detectedLanguage] || translations.detectedLanguage})`,
    );

  const languageBlocks: { lang: SupportedLanguages; text: string }[] = [];

  if (translations.detectedLanguage === 'english') {
    if (configuredLanguages.includes(SupportedLanguages.EN)) {
      languageBlocks.push({
        lang: SupportedLanguages.EN,
        text: `## **English (original):**\n${translations.originalText}\n\n`,
      });
    }
  } else {
    if (configuredLanguages.includes(SupportedLanguages.EN)) {
      languageBlocks.push({
        lang: SupportedLanguages.EN,
        text: `## **English:**\n${translations.english}\n\n`,
      });
    }
    if (configuredLanguages.includes(SupportedLanguages.ORIGINAL)) {
      languageBlocks.push({
        lang: SupportedLanguages.ORIGINAL,
        text: `## **Original (${
          LANGUAGE_LABELS[translations.detectedLanguage] || translations.detectedLanguage
        }):**\n|| ${translations.originalText} ||\n\n`,
      });
    }
  }

  if (configuredLanguages.includes(SupportedLanguages.TH) && translations.detectedLanguage !== 'thai') {
    languageBlocks.push({
      lang: SupportedLanguages.TH,
      text: `## **การแปลเป็นภาษาไทย:**\n|| ${translations.thai} ||\n\n`,
    });
  }

  if (configuredLanguages.includes(SupportedLanguages.UA) && translations.detectedLanguage !== 'ukrainian') {
    languageBlocks.push({
      lang: SupportedLanguages.UA,
      text: `## **Український переклад:**\n|| ${translations.ukrainian} ||\n\n`,
    });
  }

  if (configuredLanguages.includes(SupportedLanguages.RU) && translations.detectedLanguage !== 'russian') {
    languageBlocks.push({
      lang: SupportedLanguages.RU,
      text: `## **Русский перевод:**\n|| ${translations.russian} ||\n\n`,
    });
  }

  const fullText = languageBlocks.map(b => b.text).join('');
  const messages: string[] = [];

  if (fullText.length <= MAX_LENGTH_FOR_DISCORD_MESSAGE) {
    // Fits in one message
    messages.push(fullText.trim());
  } else {
    // Doesn't get in the way, each language is a separate message, spoilers are safe
    for (const block of languageBlocks) {
      const hasSpoiler = block.text.includes('||');
      messages.push(...splitTextSafe(block.text, hasSpoiler));
    }
  }

  return { embeds: [embed], messages };
}

/**
 * Formats error message for user notification
 */
export function formatErrorMessage(error: unknown, originalContent: string): string {
  let errorMessage = '❌ Sorry, there was an error processing your message.\n';

  const errorWithStatus = error as { status?: number };

  if (errorWithStatus.status === 429) {
    errorMessage += 'Translation service rate limit exceeded. Please try again later.\n';
  } else if (errorWithStatus.status === 503) {
    errorMessage += 'Translation service is temporarily unavailable. Please try again later.\n';
  } else {
    errorMessage += 'An unexpected error occurred. Your message was left untranslated.\n';
  }

  errorMessage += originalContent;
  return errorMessage;
}
