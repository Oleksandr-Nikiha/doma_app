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
      <div className="p-4 rounded-2xl bg-[#FFF9EE] border border-[#E8C288] text-xs sm:text-sm text-[#7A4B1A] flex items-start gap-3">
        <span className="text-xl">📍</span>
        <div>
          <span className="font-bold">Адреса для самовивозу:</span>
          <div>м. Вишгород, вул. Набережна, 8Д (Doma Pizza & Sushi)</div>
          <div className="text-[11px] text-[#A66C31] mt-0.5">
            Заклад відчинений з 10:30 до 21:30. Приготуємо гарячим та свіжим до вашого приходу!
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 rounded-2xl bg-[#FAF7F2] border border-[#EADFCF]">
      <div>
        <label className="block text-xs font-bold text-[#6B533E] mb-1">
          Вулиця (м. Вишгород) *
        </label>
        <input
          type="text"
          required
          list="streets-datalist"
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          placeholder="Введіть або оберіть вулицю..."
          className="w-full bg-white border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
        />
        <datalist id="streets-datalist">
          {streetsList.map((s) => (
            <option key={s.id} value={s.street} />
          ))}
        </datalist>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-[#6B533E] mb-1">
            Будинок *
          </label>
          <input
            type="text"
            required
            value={house}
            onChange={(e) => setHouse(e.target.value)}
            placeholder="Напр. 15, 2Д"
            className="w-full bg-white border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#6B533E] mb-1">
            Квартира / Офіс
          </label>
          <input
            type="text"
            value={apartment}
            onChange={(e) => setApartment(e.target.value)}
            placeholder="Опціонально"
            className="w-full bg-white border border-[#D8C7B0] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8823E]/30"
          />
        </div>
      </div>
      <div className="text-[11px] text-[#7A695C] bg-white rounded-xl p-2.5 border border-[#EADFCF] flex items-center justify-between">
        <span>🛵 Доставка по Вишгороду щодня: 10:30 – 21:30</span>
        <span className="font-bold text-[#C8823E]">від 250 ₴ безкоштовно</span>
      </div>
    </div>
  );
}

