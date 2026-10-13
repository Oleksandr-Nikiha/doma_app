/**
 * Утиліти для роботи з робочим часом закладу Doma Pizza & Sushi
 * Кухня та доставка: 10:30 – 21:30 щодня
 */

export interface WorkingHoursInfo {
  isOpen: boolean;
  isBakeryOpen: boolean; // для зворотної сумісності
  isDeliveryOpen: boolean;
  currentKyivTime: string;
  statusText: string;
  shortStatusText: string;
  badgeColor: "emerald" | "amber" | "rose";
  checkoutNotice: string | null;
}

export function getWorkingHoursInfo(): WorkingHoursInfo {
  try {
    const now = new Date();
    // Розрахунок часу в зоні Europe/Kyiv
    const kyivDateStr = now.toLocaleString("en-US", { timeZone: "Europe/Kyiv" });
    const kyivDate = new Date(kyivDateStr);

    const hours = kyivDate.getHours();
    const minutes = kyivDate.getMinutes();
    const currentTotalMinutes = hours * 60 + minutes;

    const timeFormatted = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

    // Робочий час: 10:30 (630 хв) – 21:30 (1290 хв)
    const isOpen = currentTotalMinutes >= 630 && currentTotalMinutes < 1290;

    if (isOpen) {
      return {
        isOpen: true,
        isBakeryOpen: true,
        isDeliveryOpen: true,
        currentKyivTime: timeFormatted,
        statusText: "Відчинено • Доставка та самовивіз працюють",
        shortStatusText: "Відчинено до 21:30",
        badgeColor: "emerald",
        checkoutNotice: null,
      };
    }

    return {
      isOpen: false,
      isBakeryOpen: false,
      isDeliveryOpen: false,
      currentKyivTime: timeFormatted,
      statusText: "Зачинено до 10:30 • Приймаємо передзамовлення",
      shortStatusText: "Зачинено (до 10:30)",
      badgeColor: "amber",
      checkoutNotice:
        "Заклад зараз зачинений (працюємо щодня з 10:30 до 21:30). Ваше замовлення буде прийнято як передзамовлення та приготовлено гарячим на відкриття!",
    };
  } catch {
    return {
      isOpen: true,
      isBakeryOpen: true,
      isDeliveryOpen: true,
      currentKyivTime: "",
      statusText: "Щодня 10:30 – 21:30",
      shortStatusText: "Щодня 10:30 – 21:30",
      badgeColor: "emerald",
      checkoutNotice: null,
    };
  }
}
