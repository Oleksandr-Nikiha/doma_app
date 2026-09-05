// frontend/src/telegram/env.ts
import { isTMA, mockTelegramEnv } from "@telegram-apps/sdk-react";

export function initTelegramEnv(): void {
  // Блокуємо мокинг у продакшені на рівні збірки
  if (import.meta.env.PROD) {
    return;
  }

  // Якщо ми реально в Telegram — перериваємо ініціалізацію моку
  if (isTMA()) {
    return;
  }

  const initDataRaw = import.meta.env.VITE_DEV_INIT_DATA;

  if (!initDataRaw) {
    console.error(
      "❌ VITE_DEV_INIT_DATA не знайдено.\n" +
      "Для тестування захищених роутів згенеруйте токен за допомогою вашого скрипта:\n" +
      "python scripts/generate_test_init_data.py\n" +
      "та додайте результат у файл .env як VITE_DEV_INIT_DATA=ваш_рядок"
    );
    return;
  }

  // Ініціалізуємо мокове середовище для SDK 3.x
  mockTelegramEnv({
    launchParams: {
      tgWebAppData: initDataRaw,
      tgWebAppThemeParams: {
        accentTextColor: '#6ab2f2',
        bgColor: '#17212b',
        buttonColor: '#5288c1',
        buttonTextColor: '#ffffff',
        destructiveTextColor: '#ec3942',
        headerBgColor: '#17212b',
        hintColor: '#708499',
        linkColor: '#6ab3f3',
        secondaryBgColor: '#232e3c',
        sectionBgColor: '#17212b',
        sectionHeaderTextColor: '#6ab3f3',
        subtitleTextColor: '#708499',
        textColor: '#f5f5f5',
      },
      tgWebAppVersion: '7.2',
      tgWebAppPlatform: 'tdesktop',
    }
  });
}