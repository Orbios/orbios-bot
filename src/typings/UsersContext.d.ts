export type NameTranslations = {
  thai: string;
  english: string;
  russian: string;
}

export type UserContext = {
  gender: 'male' | 'female';
  nativeLanguage: 'thai' | 'russian' | 'english';
  englishLevel: 'basic' | 'intermediate' | 'advanced';
  nameTranslations: NameTranslations;
  aliases?: string[];
}

export type UsersContext = {
  [key: string]: UserContext;
};
