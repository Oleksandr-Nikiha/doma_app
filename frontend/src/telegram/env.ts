// frontend/src/telegram/env.ts
import { isTMA, mockTelegramEnv } from "@telegram-apps/sdk-react";

export function isTelegramWebApp(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.pathname.startsWith("/admin")) {
    return false;
  }
  const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;
  if (tg && typeof tg.initData === "string" && tg.initData.trim().length > 0) {
    return true;
  }
  return isTMA();
}

export function initTelegramEnv(): void {
  // Блокуємо мокинг у продакшені на рівні збірки
  if (import.meta.env.PROD) {
    return;
  }

  // Не мокаємо Telegram для адмін-панелі на ПК
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
    return;
  }

  // Якщо ми реально в Telegram — перериваємо ініціалізацію моку
  if (isTMA()) {
    return;
  }

  const initDataRaw = import.meta.env.VITE_DEV_INIT_DATA;

  if (!initDataRaw) {
    // У режимі браузера без токена працюємо як звичайний гість
    return;
  }

  // Ініціалізуємо мокове середовище для SDK 3.x тільки за явним запитом
  if (
    typeof window !== "undefined" &&
    !window.location.search.includes("mock") &&
    !window.location.hash.includes("tgWebAppData")
  ) {
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