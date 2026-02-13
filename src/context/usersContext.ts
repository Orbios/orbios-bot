import { UsersContext } from '../typings/UsersContext.js';

const USERS_CONTEXT: UsersContext = {
  'Nana Thailand': {
    gender: 'female',
    nativeLanguage: 'thai',
    englishLevel: 'basic',
    nameTranslations: {
      thai: 'นานา',
      english: 'Nana',
      russian: 'Нана',
    },
    aliases: ['Nana', 'nanathailand'],
  },
  'Erik Sytnyk': {
    gender: 'male',
    nativeLanguage: 'russian',
    englishLevel: 'advanced',
    nameTranslations: {
      thai: 'อีริค',
      english: 'Erik',
      russian: 'Эрик',
    },
    aliases: ['Erik', 'erik_sytnyk'],
  },
  'Andrew Temchenko': {
    gender: 'male',
    nativeLanguage: 'russian',
    englishLevel: 'intermediate',
    nameTranslations: {
      thai: 'แอนดรูว์',
      english: 'Andrew',
      russian: 'Андрей',
    },
    aliases: ['Andrey', 'Андрей', 'orbios_andrew'],
  },
  'Olha Kyrylenko': {
    gender: 'female',
    nativeLanguage: 'russian',
    englishLevel: 'basic',
    nameTranslations: {
      thai: 'โอลฮา',
      english: 'Olha',
      russian: 'Оля',
    },
    aliases: ['Olya', 'Ольга', 'kyrylenko_olha'],
  },
};

export default USERS_CONTEXT;
