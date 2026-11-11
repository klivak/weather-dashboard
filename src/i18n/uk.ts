import type { Messages } from './types'

export const uk: Messages = {
  app: {
    title: 'Weather Dashboard',
    description:
      'Порівнюйте поточну погоду, погодинну температуру та прогноз на 5 днів для п’яти міст одночасно.',
  },
  nav: {
    label: 'Розділи',
    home: 'Головна',
    favourites: 'Вибране',
  },
  settings: {
    language: 'Мова',
  },
  locales: {
    en: 'English',
    uk: 'Українська',
  },
  home: {
    heading: 'Ваші міста',
  },
  favourites: {
    heading: 'Вибрані міста',
    emptyTitle: 'Тут поки порожньо',
    emptyText: 'Натисніть зірочку біля міста, щоб зберегти його тут. Можна зберегти до {max} міст.',
    emptyAction: 'Знайти місто',
  },
  footer: {
    data: 'Дані про погоду',
  },
}
