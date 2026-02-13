type AIResponse = {
  detectedLanguage: 'english' | 'thai' | 'russian' | 'ukrainian';
  originalText: string;
  english: string;
  thai: string;
  russian: string;
  ukrainian: string;
}

export default AIResponse;
