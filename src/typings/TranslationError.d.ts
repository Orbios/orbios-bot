type TranslationError = {
  status?: number;
  message: string;
} & Error

export default TranslationError;
