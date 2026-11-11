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
  search: {
    label: 'Місто',
    placeholder: 'Знайдіть місто',
    clear: 'Очистити пошук',
    suggestions: 'Знайдені міста',
    loading: 'Шукаємо…',
    empty: 'Не знайшли міст за запитом «{query}». Перевірте написання або введіть назву англійською.',
    error: 'Не вдалося завантажити міста. Спробуйте ще раз.',
    offline: 'Схоже, немає інтернету. Перевірте з’єднання та спробуйте ще раз.',
    retry: 'Спробувати ще',
    results: 'Знайдено міст: {count}. Оберіть стрілками.',
    selected: 'Обрано: {city}',
  },
  home: {
    heading: 'Ваші міста',
  },
  favourites: {
    heading: 'Вибрані міста',
    emptyTitle: 'Тут поки порожньо',
    emptyText: 'Натисніть зірочку біля міста, щоб зберегти його тут. Можна зберегти до {max} міст.',
    emptyAction: 'Знайти місто',
  },
  footer: {
    data: 'Дані про погоду',
  },
}
