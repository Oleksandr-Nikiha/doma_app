import { SegmentedControl } from "@/components/ui";
import { haptic } from "@/telegram/sdk";

interface FulfillmentSelectorProps {
  fulfillmentType: "delivery" | "pickup";
  onChange: (val: "delivery" | "pickup") => void;
  isDeliveryEnabled: boolean;
}

export function FulfillmentSelector({
  fulfillmentType,
  onChange,
  isDeliveryEnabled,
}: FulfillmentSelectorProps) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider opacity-60">
        Спосіб отримання
      </label>
      <SegmentedControl
        value={fulfillmentType}
        onChange={(val) => {
          haptic("light");
          onChange(val);
        }}
        options={[
          { value: "delivery", label: "Доставка", icon: "🛵", disabled: !isDeliveryEnabled },
          { value: "pickup", label: "Самовивіз", icon: "🛍️" },
        ]}
      />

      {/* Попередження про високе навантаження */}
      {!isDeliveryEnabled && (
        <div
          className="mt-2.5 rounded-xl p-3 text-xs leading-relaxed flex items-start gap-2 border"
          style={{
            background: "color-mix(in srgb, #ef4444 10%, transparent)",
            color: "#ef4444",
            borderColor: "color-mix(in srgb, #ef4444 30%, transparent)",
          }}
        >
          <span className="text-sm">⚠️</span>
          <div>
            <p className="font-semibold">Доставка тимчасово вимкнена</p>
            <p className="mt-0.5 opacity-90">
              Через високе навантаження кухні та кур'єрів заклад наразі приймає замовлення лише на <b>самовивіз</b>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

