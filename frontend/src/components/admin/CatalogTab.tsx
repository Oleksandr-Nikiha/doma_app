import { useState, useMemo } from "react";
import {
  useAdminCategories,
  useAdminProducts,
  useDeleteCategory,
  useDeleteProduct,
  useDeleteVariant,
  useBulkProductAvailability,
} from "@/api/queries";
import type { AdminCategory, AdminProduct, AdminVariant, Location } from "@/api/types";
import { EmptyState, ErrorBox, Spinner, Thumb } from "@/components/ui";
import { haptic, hapticNotify } from "@/telegram/sdk";
import { ProductOptionsModal } from "./modals/ProductOptionsModal";
import { BulkProductOptionsModal } from "./modals/BulkProductOptionsModal";
import { CategoryModal } from "./modals/CategoryModal";
import { SubcategoryModal } from "./modals/SubcategoryModal";
import { ProductModal } from "./modals/ProductModal";
import { VariantModal } from "./modals/VariantModal";

export function CatalogTab({
  locationId,
  locations,
  isSuperAdmin,
  userLocationId,
}: {
  locationId?: number | null;
  locations: Location[];
  isSuperAdmin: boolean;
  userLocationId?: number | null;
}) {
  const { data: categories = [], isPending: catLoading, error: catError } = useAdminCategories(locationId);
  const [selectedParentCatId, setSelectedParentCatId] = useState<number | null>(null);
  const [selectedSubCatId, setSelectedSubCatId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const rootCategories = useMemo(
    () =>
      categories
        .filter((c) => c.parent_id === null)
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    [categories]
  );
  const subcategories = useMemo(
    () =>
      categories
        .filter((c) => c.parent_id !== null)
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    [categories]
  );

  const selectedParentCat = useMemo(
    () => (selectedParentCatId ? rootCategories.find((c) => c.id === selectedParentCatId) : null),
    [rootCategories, selectedParentCatId]
  );
  const selectedSubCat = useMemo(
    () => (selectedSubCatId ? subcategories.find((c) => c.id === selectedSubCatId) : null),
    [subcategories, selectedSubCatId]
  );

  const effectiveCategoryId = selectedSubCatId || selectedParentCatId || null;

  const { data: products = [], isPending: prodLoading, error: prodError } = useAdminProducts({
    categoryId: effectiveCategoryId,
    locationId: locationId,
  });

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const matchName = p.name.toLowerCase().includes(q);
      const matchDesc = p.description ? p.description.toLowerCase().includes(q) : false;
      const matchCat = p.category_name ? p.category_name.toLowerCase().includes(q) : false;
      const matchVariant = p.variants?.some((v) => v.label.toLowerCase().includes(q)) ?? false;
      return matchName || matchDesc || matchCat || matchVariant;
    });
  }, [products, search]);

  // Модальні вікна
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);

  const [subcatModalOpen, setSubcatModalOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<AdminCategory | null>(null);

  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);

  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [targetProductForVariant, setTargetProductForVariant] = useState<number | null>(null);
  const [editingVariant, setEditingVariant] = useState<AdminVariant | null>(null);

  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [targetProductForOptions, setTargetProductForOptions] = useState<AdminProduct | null>(null);

  // Масові операції (Bulk)
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [bulkOptionsModalOpen, setBulkOptionsModalOpen] = useState(false);
  const bulkAvailability = useBulkProductAvailability();

  const toggleSelectProduct = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const allFilteredSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((p) => selectedProductIds.includes(p.id));

  const toggleSelectAll = () => {
    haptic("light");
    if (allFilteredSelected) {
      const filteredIdSet = new Set(filteredProducts.map((p) => p.id));
      setSelectedProductIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const newSet = new Set([...selectedProductIds, ...filteredProducts.map((p) => p.id)]);
      setSelectedProductIds(Array.from(newSet));
    }
  };

  const deleteCategory = useDeleteCategory();
  const deleteProduct = useDeleteProduct();
  const deleteVariant = useDeleteVariant();

  if (catLoading) return <Spinner />;
  if (catError) return <ErrorBox message={catError.message} />;

  const defaultLocation = locationId || userLocationId || (locations[0]?.id ?? 1);

  return (
    <div className="space-y-6">
      {/* 1. Блок категорій (Надкатегорії) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">Категорії ({rootCategories.length})</h2>
            <p className="text-[11px] opacity-60">Основні розділи меню (Піца, Суші, Закуски...)</p>
          </div>
          <button
            onClick={() => {
              haptic("light");
              setEditingCategory(null);
              setCatModalOpen(true);
            }}
            className="app-press flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold"
            style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
          >
            <span>+</span> Категорія
          </button>
        </div>

        {/* Скрол списку категорій */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar md:flex-wrap">
          <button
            onClick={() => {
              haptic("light");
              setSelectedParentCatId(null);
              setSelectedSubCatId(null);
            }}
            className="app-press shrink-0 rounded-xl px-3.5 py-2 text-xs font-medium transition-all"
            style={
              selectedParentCatId === null
                ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                : { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }
            }
          >
            Всі розділи
          </button>
          {rootCategories.map((c) => {
            const isSelected = selectedParentCatId === c.id;
            return (
              <div
                key={c.id}
                className="flex shrink-0 items-center overflow-hidden rounded-xl border text-xs transition-all"
                style={{
                  borderColor: isSelected ? "var(--tg-theme-button-color)" : "var(--app-border)",
                  background: isSelected ? "var(--app-tint)" : "var(--app-surface)",
                }}
              >
                <button
                  onClick={() => {
                    haptic("light");
                    setSelectedParentCatId(c.id);
                    setSelectedSubCatId(null);
                  }}
                  className="px-3 py-2 font-medium flex items-center gap-1"
                >
                  {c.icon && <span>{c.icon}</span>}
                  <span>{c.name}</span>
                </button>
                <button
                  onClick={() => {
                    haptic("light");
                    setEditingCategory(c);
                    setCatModalOpen(true);
                  }}
                  title="Редагувати категорію"
                  className="px-2 py-2 opacity-40 hover:opacity-100"
                >
                  ✏️
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Блок підкатегорій */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">
              Підкатегорії {selectedParentCat ? `(${selectedParentCat.name})` : `(${subcategories.length})`}
            </h2>
            <p className="text-[11px] opacity-60">Підрозділи страв без власних емодзі</p>
          </div>
          <button
            onClick={() => {
              haptic("light");
              setEditingSubcategory(null);
              setSubcatModalOpen(true);
            }}
            className="app-press flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold"
            style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
          >
            <span>+</span> Підкатегорія
          </button>
        </div>

        {/* Скрол списку підкатегорій */}
        {(() => {
          const visibleSubcats = selectedParentCatId
            ? subcategories.filter((s) => s.parent_id === selectedParentCatId)
            : subcategories;

          if (selectedParentCatId && visibleSubcats.length === 0) {
            return (
              <div
                className="rounded-xl border border-dashed p-3 text-center text-xs opacity-50"
                style={{ borderColor: "var(--app-border)" }}
              >
                У категорії «{selectedParentCat?.name}» немає підкатегорій. Натисніть «+ Підкатегорія», щоб створити.
              </div>
            );
          }

          if (!selectedParentCatId && visibleSubcats.length === 0) {
            return (
              <div
                className="rounded-xl border border-dashed p-3 text-center text-xs opacity-50"
                style={{ borderColor: "var(--app-border)" }}
              >
                Немає створених підкатегорій
              </div>
            );
          }

          return (
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar md:flex-wrap">
              {selectedParentCatId && (
                <button
                  onClick={() => {
                    haptic("light");
                    setSelectedSubCatId(null);
                  }}
                  className="app-press shrink-0 rounded-xl px-3.5 py-2 text-xs font-medium transition-all"
                  style={
                    selectedSubCatId === null
                      ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                      : { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }
                  }
                >
                  Всі в {selectedParentCat?.name}
                </button>
              )}
              {visibleSubcats.map((sub) => {
                const isSelected = selectedSubCatId === sub.id;
                const parentOfSub = rootCategories.find((r) => r.id === sub.parent_id);
                return (
                  <div
                    key={sub.id}
                    className="flex shrink-0 items-center overflow-hidden rounded-xl border text-xs transition-all"
                    style={{
                      borderColor: isSelected ? "var(--tg-theme-button-color)" : "var(--app-border)",
                      background: isSelected ? "var(--app-tint)" : "var(--app-surface)",
                    }}
                  >
                    <button
                      onClick={() => {
                        haptic("light");
                        setSelectedSubCatId(sub.id);
                        if (sub.parent_id && selectedParentCatId !== sub.parent_id) {
                          setSelectedParentCatId(sub.parent_id);
                        }
                      }}
                      className="px-3 py-2 font-medium flex items-center"
                    >
                      {!selectedParentCatId && parentOfSub && (
                        <span className="opacity-50 mr-1">{parentOfSub.name} →</span>
                      )}
                      <span>{sub.name}</span>
                      <span className="ml-1 opacity-50">({sub.products_count})</span>
                    </button>
                    <button
                      onClick={() => {
                        haptic("light");
                        setEditingSubcategory(sub);
                        setSubcatModalOpen(true);
                      }}
                      title="Редагувати підкатегорію"
                      className="px-2 py-2 opacity-40 hover:opacity-100"
                    >
                      ✏️
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </section>

      {/* 3. Блок страв */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold">
            Страви{" "}
            {selectedSubCat
              ? `в «${selectedSubCat.name}»`
              : selectedParentCat
              ? `в «${selectedParentCat.name}» (всі)`
              : "(всі)"}{" "}
            <span className="text-xs font-normal opacity-60">
              ({filteredProducts.length}
              {search.trim() ? ` з ${products.length}` : ""})
            </span>
          </h2>
          <div className="flex items-center gap-2">
            {filteredProducts.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAll}
                className="app-press rounded-xl px-2.5 py-1.5 text-xs font-medium border transition-colors"
                style={{
                  borderColor: allFilteredSelected ? "var(--tg-theme-button-color)" : "var(--app-border)",
                  background: allFilteredSelected ? "var(--app-tint)" : "var(--app-surface)",
                  color: allFilteredSelected ? "var(--tg-theme-button-color)" : "var(--tg-theme-text-color)",
                }}
              >
                {allFilteredSelected ? "✓ Вибрано всі" : "Вибрати всі"}
              </button>
            )}
            <button
              onClick={() => {
                haptic("light");
                setEditingProduct(null);
                setProdModalOpen(true);
              }}
              className="app-press flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              <span>+</span> Страва
            </button>
          </div>
        </div>

        {/* Швидкий пошук страв у меню */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Швидкий пошук страви за назвою, описом або складом..."
            className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2.5 pl-10 text-sm outline-none transition focus:border-[var(--tg-theme-button-color)] focus:ring-1 focus:ring-[var(--tg-theme-button-color)]"
            style={{ color: "var(--tg-theme-text-color)" }}
          />
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm opacity-50">
            🔍
          </span>
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-xs opacity-50 hover:opacity-100"
              title="Очистити пошук"
            >
              ✕
            </button>
          )}
        </div>

        {prodLoading ? (
          <Spinner />
        ) : prodError ? (
          <ErrorBox message={prodError.message} />
        ) : products.length === 0 ? (
          <EmptyState icon="🍕" title="Немає страв" hint="Додайте першу страву за допомогою кнопки вище" />
        ) : filteredProducts.length === 0 ? (
          <div className="app-card rounded-2xl p-6 text-center space-y-3">
            <span className="text-3xl">🔍</span>
            <p className="font-bold text-sm">Нічого не знайдено</p>
            <p className="text-xs opacity-60">
              За запитом «{search}» не знайдено жодної страви. Спробуйте змінити пошуковий запит або обрати іншу категорію.
            </p>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="app-press rounded-xl px-4 py-2 text-xs font-semibold"
              style={{ background: "var(--app-surface-2)" }}
            >
              Скинути пошук
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((p) => {
              const isSelected = selectedProductIds.includes(p.id);
              return (
                <div
                  key={p.id}
                  className="app-card rounded-2xl p-3.5 transition-all"
                  style={{
                    border: isSelected
                      ? "2px solid var(--tg-theme-button-color)"
                      : "1px solid var(--app-border)",
                    background: isSelected
                      ? "color-mix(in srgb, var(--tg-theme-button-color) 7%, var(--app-surface))"
                      : "var(--app-surface)",
                    opacity: p.is_available ? 1 : 0.65,
                  }}
                >
                  <div className="flex gap-3 items-start">
                    <div className="pt-1 shrink-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          haptic("light");
                          toggleSelectProduct(p.id);
                        }}
                        className="h-4 w-4 rounded cursor-pointer accent-[var(--tg-theme-button-color)]"
                      />
                    </div>
                    <Thumb src={p.image_url} className="h-16 w-16 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1">
                      <p className="truncate text-sm font-bold">{p.name}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            haptic("light");
                            setEditingProduct(p);
                            setProdModalOpen(true);
                          }}
                          className="app-press rounded-lg p-1 text-xs opacity-60 hover:opacity-100"
                          title="Редагувати"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Видалити страву "${p.name}"?`)) {
                              hapticNotify("warning");
                              deleteProduct.mutate(p.id);
                            }
                          }}
                          className="app-press rounded-lg p-1 text-xs opacity-60 hover:opacity-100"
                          title="Видалити"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    {p.description && (
                      <p className="line-clamp-2 mt-0.5 text-xs opacity-60">{p.description}</p>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-[11px] opacity-50">
                      <span>{p.category_name}</span>
                      {p.location_name && <span>• 📍 {p.location_name}</span>}
                    </div>
                  </div>
                </div>

                {/* Варіанти цін (розміри / порції) */}
                <div className="mt-3 border-t pt-2.5" style={{ borderColor: "var(--app-border)" }}>
                  <div className="flex items-center justify-between text-xs font-semibold opacity-70">
                    <span>Розміри та ціни:</span>
                    <button
                      onClick={() => {
                        haptic("light");
                        setTargetProductForVariant(p.id);
                        setEditingVariant(null);
                        setVariantModalOpen(true);
                      }}
                      className="text-[var(--tg-theme-button-color)] hover:underline"
                    >
                      + Додати розмір
                    </button>
                  </div>

                  <div className="mt-1.5 space-y-1.5">
                    {p.variants.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs"
                        style={{
                          background: "var(--app-surface-2)",
                          opacity: v.is_available ? 1 : 0.5,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{v.label}</span>
                          {v.weight && <span className="opacity-50">({v.weight})</span>}
                          {!v.is_available && (
                            <span className="rounded bg-red-500/20 px-1 py-0.2 text-[10px] text-red-500 font-bold">
                              СТОП
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{v.price.toFixed(0)} ₴</span>
                          <button
                            onClick={() => {
                              haptic("light");
                              setTargetProductForVariant(p.id);
                              setEditingVariant(v);
                              setVariantModalOpen(true);
                            }}
                            className="opacity-50 hover:opacity-100 text-[11px]"
                          >
                            ✏️
                          </button>
                          {p.variants.length > 1 && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Видалити варіант "${v.label}"?`)) {
                                  hapticNotify("warning");
                                  deleteVariant.mutate(v.id);
                                }
                              }}
                              className="opacity-50 hover:opacity-100 text-[11px]"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Додатки (Модифікатори до страви) */}
                <div className="mt-2.5 border-t pt-2" style={{ borderColor: "var(--app-border)" }}>
                  <div className="flex items-center justify-between text-xs font-semibold opacity-70">
                    <span>Додатки до страви:</span>
                    <button
                      onClick={() => {
                        haptic("light");
                        setTargetProductForOptions(p);
                        setOptionsModalOpen(true);
                      }}
                      className="text-[var(--tg-theme-button-color)] hover:underline"
                    >
                      ⚙️ Налаштувати
                    </button>
                  </div>

                  {p.option_groups && p.option_groups.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {p.option_groups.map((og) => (
                        <span
                          key={og.group_id}
                          className="rounded-lg px-2.5 py-1 text-[11px] font-medium"
                          style={{ background: "var(--app-surface-2)" }}
                        >
                          🧩 {og.group_name}{" "}
                          <span className="opacity-60">
                            ({og.min_select}–{og.max_select}
                            {og.free_count > 0 ? `, б/к: ${og.free_count}` : ""})
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] opacity-40">Немає додатків (натисніть Налаштувати)</p>
                  )}
                </div>
              </div>
            );})}
          </div>
        )}
      </section>

      {/* Плаваюча панель масових дій */}
      {selectedProductIds.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-lg">
          <div
            className="app-card rounded-2xl p-3 shadow-2xl border flex flex-col gap-2.5 backdrop-blur-md"
            style={{
              background: "color-mix(in srgb, var(--tg-theme-bg-color) 94%, black)",
              borderColor: "var(--tg-theme-button-color)",
            }}
          >
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-bold">
                Обрано страв: <span className="text-[var(--tg-theme-button-color)] font-extrabold">{selectedProductIds.length}</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedProductIds([])}
                className="opacity-60 hover:opacity-100 font-medium"
              >
                ✕ Зняти вибір
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={bulkAvailability.isPending}
                onClick={() => {
                  haptic("medium");
                  bulkAvailability.mutate(
                    { product_ids: selectedProductIds, is_available: false },
                    {
                      onSuccess: () => {
                        hapticNotify("success");
                      },
                    },
                  );
                }}
                className="app-press rounded-xl py-2 px-2 text-xs font-bold text-center border border-red-500/30 bg-red-500/10 text-red-500 disabled:opacity-50"
              >
                ⛔ На стоп
              </button>

              <button
                type="button"
                disabled={bulkAvailability.isPending}
                onClick={() => {
                  haptic("medium");
                  bulkAvailability.mutate(
                    { product_ids: selectedProductIds, is_available: true },
                    {
                      onSuccess: () => {
                        hapticNotify("success");
                      },
                    },
                  );
                }}
                className="app-press rounded-xl py-2 px-2 text-xs font-bold text-center border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 disabled:opacity-50"
              >
                ✓ Доступно
              </button>

              <button
                type="button"
                onClick={() => {
                  haptic("light");
                  setBulkOptionsModalOpen(true);
                }}
                className="app-press rounded-xl py-2 px-2 text-xs font-bold text-center"
                style={{
                  background: "var(--tg-theme-button-color)",
                  color: "var(--tg-theme-button-text-color)",
                }}
              >
                🧩 Додатки
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальне вікно масового налаштування додатків */}
      {bulkOptionsModalOpen && selectedProductIds.length > 0 && (
        <BulkProductOptionsModal
          productIds={selectedProductIds}
          onClose={() => setBulkOptionsModalOpen(false)}
          onSuccess={() => {
            setSelectedProductIds([]);
          }}
        />
      )}

      {/* Модальне вікно Категорії */}
      {catModalOpen && (
        <CategoryModal
          category={editingCategory}
          locations={locations}
          defaultLocationId={defaultLocation}
          isSuperAdmin={isSuperAdmin}
          existingCategories={categories}
          onClose={() => setCatModalOpen(false)}
          onDelete={(id) => {
            deleteCategory.mutate(id);
            setCatModalOpen(false);
          }}
        />
      )}

      {/* Модальне вікно Підкатегорії */}
      {subcatModalOpen && (
        <SubcategoryModal
          subcategory={editingSubcategory}
          rootCategories={rootCategories}
          defaultParentId={selectedParentCatId}
          existingCategories={categories}
          onClose={() => setSubcatModalOpen(false)}
          onDelete={(id) => {
            deleteCategory.mutate(id);
            setSubcatModalOpen(false);
          }}
        />
      )}

      {/* Модальне вікно Страви */}
      {prodModalOpen && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          defaultCategoryId={effectiveCategoryId || categories[0]?.id || 1}
          onClose={() => setProdModalOpen(false)}
        />
      )}

      {/* Модальне вікно Варіанту ціни */}
      {variantModalOpen && targetProductForVariant && (
        <VariantModal
          productId={targetProductForVariant}
          variant={editingVariant}
          onClose={() => {
            setVariantModalOpen(false);
            setTargetProductForVariant(null);
            setEditingVariant(null);
          }}
        />
      )}

      {/* Модальне вікно налаштування додатків для страви */}
      {optionsModalOpen && targetProductForOptions && (
        <ProductOptionsModal
          product={targetProductForOptions}
          onClose={() => {
            setOptionsModalOpen(false);
            setTargetProductForOptions(null);
          }}
        />
      )}
    </div>
  );
}
