import type { DeliveryAddress } from "../../types/catalog.ts";

interface AddressFieldsProps {
  fulfillmentType: "delivery" | "pickup";
  street: string;
  setStreet: (v: string) => void;
  house: string;
  setHouse: (v: string) => void;
  apartment: string;
  setApartment: (v: string) => void;
  streetsList: DeliveryAddress[];
}

export function AddressFields({
  fulfillmentType,
  street,
  setStreet,
  house,
  setHouse,
  apartment,
  setApartment,
  streetsList,
}: AddressFieldsProps) {
  if (fulfillmentType === "pickup") {
    return (
      <div className="p-4 rounded-2xl bg-[#1E3A2F]/20 border border-emerald-500/30 text-xs sm:text-sm text-[#F1F5F9] flex items-start gap-3">
        <span className="text-xl">📍</span>
        <div>
          <span className="font-bold text-white">Адреса для самовивозу:</span>
          <div className="text-[#CBD5E1]">м. Київ, вул. Набережна, 12 (Urban Pizza & Sushi)</div>
          <div className="text-[11px] text-emerald-400 font-medium mt-0.5">
            Заклад відчинений з 10:30 до 21:30. Приготуємо гарячим та свіжим до вашого приходу!
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 rounded-2xl bg-[#181B22] border border-white/10">
      <div>
        <label className="block text-xs font-bold text-[#94A3B8] mb-1">
          Вулиця (м. Київ) *
        </label>
        <input
          type="text"
          required
          list="streets-datalist"
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          placeholder="Введіть або оберіть вулицю..."
          className="w-full bg-[#121417] border border-white/10 text-white placeholder:text-[#64748B] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#D34528]/40"
        />
        <datalist id="streets-datalist">
          {streetsList.map((s) => (
            <option key={s.id} value={s.street} />
          ))}
        </datalist>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-[#94A3B8] mb-1">
            Будинок *
          </label>
          <input
            type="text"
            required
            value={house}
            onChange={(e) => setHouse(e.target.value)}
            placeholder="Напр. 15, 2Д"
            className="w-full bg-[#121417] border border-white/10 text-white placeholder:text-[#64748B] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#D34528]/40"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#94A3B8] mb-1">
            Квартира / Офіс
          </label>
          <input
            type="text"
            value={apartment}
            onChange={(e) => setApartment(e.target.value)}
            placeholder="Опціонально"
            className="w-full bg-[#121417] border border-white/10 text-white placeholder:text-[#64748B] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#D34528]/40"
          />
        </div>
      </div>
      <div className="text-[11px] text-[#94A3B8] bg-[#121417] rounded-xl p-2.5 border border-white/10 flex items-center justify-between">
        <span>🛵 Доставка по Києву щодня: 10:30 – 21:30</span>
        <span className="font-bold text-[#E2583E]">від 250 ₴ безкоштовно</span>
      </div>
    </div>
  );
}

