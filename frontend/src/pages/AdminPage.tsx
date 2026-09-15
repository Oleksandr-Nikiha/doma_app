import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  useAddOptionGroupItem,
  useAdminCategories,
  useAdminManagers,
  useAdminMe,
  useAdminOptionGroupItems,
  useAdminOptionGroups,
  useAdminProducts,
  useAdminVariantChoices,
  useAttachProductOptionGroup,
  useCreateCategory,
  useCreateManager,
  useCreateOptionGroup,
  useCreateProduct,
  useCreateVariant,
  useDeleteCategory,
  useDeleteManager,
  useDeleteOptionGroup,
  useDeleteOptionGroupItem,
  useDeleteProduct,
  useDeleteVariant,
  useDetachProductOptionGroup,
  useLocations,
  useToggleProductAvailability,
  useToggleVariantAvailability,
  useUpdateCategory,
  useUpdateManager,
  useUpdateOptionGroup,
  useUpdateOptionGroupItem,
  useUpdateProduct,
  useUpdateProductOptionGroup,
  useUpdateVariant,
} from "@/api/queries";
import type {
  AdminCategory,
  AdminOptionGroup,
  AdminProduct,
  AdminVariant,
  CategoryCreatePayload,
  CategoryUpdatePayload,
  Location,
  Manager,
  OptionGroupCreatePayload,
  OptionGroupItemCreatePayload,
  OptionGroupUpdatePayload,
  ProductCreatePayload,
  ProductOptionGroupAdmin,
  ProductUpdatePayload,
  VariantCreatePayload,
  VariantUpdatePayload,
} from "@/api/types";
import { EmptyState, ErrorBox, ScreenTitle, Spinner, Thumb } from "@/components/ui";
import { useBackButton } from "@/hooks/useBackButton";
import { haptic, hapticNotify } from "@/telegram/sdk";

type AdminTab = "catalog" | "options" | "stoplist" | "managers";

export function AdminPage() {
  const navigate = useNavigate();
  useBackButton(() => navigate("/profile"));

  const { data: adminMe, isPending: mePending, error: meError } = useAdminMe();
  const { data: locations = [] } = useLocations();

  const [activeTab, setActiveTab] = useState<AdminTab>("catalog");
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);

  // Якщо менеджер прив'язаний до закладу — автоматично фіксуємо локацію
  const effectiveLocationId =
    adminMe?.role === "manager" ? adminMe.location_id : selectedLocationId;

  if (mePending) return <Spinner />;
  if (meError) return <ErrorBox message={meError.message} onRetry={() => window.location.reload()} />;
  if (!adminMe || !adminMe.is_staff) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl">⛔</div>
        <p className="mt-4 text-lg font-bold">Доступ обмежено</p>
        <p className="mt-2 text-sm opacity-60">
          Цей розділ доступний лише для персоналу та адміністрації закладу.
        </p>
        <button
          onClick={() => navigate("/profile")}
          className="app-press mt-6 rounded-xl px-5 py-2.5 font-semibold"
          style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
        >
          Повернутися в профіль
        </button>
      </div>
    );
  }

  const roleLabel = adminMe.role === "admin" ? "👑 Головний адмін" : "👔 Менеджер";
  const locationBadge = adminMe.location_name
    ? `📍 ${adminMe.location_name}`
    : adminMe.role === "admin"
      ? "🌐 Усі заклади"
      : "";

  return (
    <div className="min-h-screen pb-16">
      {/* Верхня панель */}
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between">
          <ScreenTitle>Адмін-панель</ScreenTitle>
          <div className="flex flex-col items-end gap-1 pr-2 pt-2 text-right">
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ background: "var(--app-tint)", color: "var(--tg-theme-button-color)" }}
            >
              {roleLabel}
            </span>
            {locationBadge && <span className="text-[11px] opacity-60">{locationBadge}</span>}
          </div>
        </div>

        {/* Перемикач вкладок */}
        <div
          className="mt-3 flex rounded-xl p-1 text-xs font-medium"
          style={{ background: "var(--app-surface-2)" }}
        >
          <button
            onClick={() => {
              haptic("light");
              setActiveTab("catalog");
            }}
            className={`app-press flex-1 rounded-lg py-2 text-center transition-all ${
              activeTab === "catalog" ? "shadow-sm font-bold" : "opacity-70"
            }`}
            style={
              activeTab === "catalog"
                ? {
                    background: "var(--tg-theme-bg-color)",
                    color: "var(--tg-theme-text-color)",
                  }
                : undefined
            }
          >
            🍕 Меню
          </button>
          <button
            onClick={() => {
              haptic("light");
              setActiveTab("options");
            }}
            className={`app-press flex-1 rounded-lg py-2 text-center transition-all ${
              activeTab === "options" ? "shadow-sm font-bold" : "opacity-70"
            }`}
            style={
              activeTab === "options"
                ? {
                    background: "var(--tg-theme-bg-color)",
                    color: "var(--tg-theme-text-color)",
                  }
                : undefined
            }
          >
            🧩 Додатки
          </button>
          <button
            onClick={() => {
              haptic("light");
              setActiveTab("stoplist");
            }}
            className={`app-press flex-1 rounded-lg py-2 text-center transition-all ${
              activeTab === "stoplist" ? "shadow-sm font-bold" : "opacity-70"
            }`}
            style={
              activeTab === "stoplist"
                ? {
                    background: "var(--tg-theme-bg-color)",
                    color: "var(--tg-theme-text-color)",
                  }
                : undefined
            }
          >
            ⛔ Стоп
          </button>
          {adminMe.role === "admin" && (
            <button
              onClick={() => {
                haptic("light");
                setActiveTab("managers");
              }}
              className={`app-press flex-1 rounded-lg py-2 text-center transition-all ${
                activeTab === "managers" ? "shadow-sm font-bold" : "opacity-70"
              }`}
              style={
                activeTab === "managers"
                  ? {
                      background: "var(--tg-theme-bg-color)",
                      color: "var(--tg-theme-text-color)",
                    }
                  : undefined
              }
            >
              👥 Штат
            </button>
          )}
        </div>

        {/* Фільтр по закладах для Admin */}
        {adminMe.role === "admin" && (activeTab === "catalog" || activeTab === "stoplist") && locations.length > 1 && (
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              onClick={() => {
                haptic("light");
                setSelectedLocationId(null);
              }}
              className="app-press shrink-0 rounded-full px-3 py-1.5 font-medium transition-all"
              style={
                selectedLocationId === null
                  ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                  : { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }
              }
            >
              Всі заклади
            </button>
            {locations.map((loc) => (
              <button
                key={loc.id}
                onClick={() => {
                  haptic("light");
                  setSelectedLocationId(loc.id);
                }}
                className="app-press shrink-0 rounded-full px-3 py-1.5 font-medium transition-all"
                style={
                  selectedLocationId === loc.id
                    ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                    : { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }
                }
              >
                📍 {loc.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Вміст вкладок */}
      <div className="mt-4 px-4">
        {activeTab === "catalog" && (
          <CatalogTab
            locationId={effectiveLocationId}
            locations={locations}
            isSuperAdmin={adminMe.role === "admin"}
            userLocationId={adminMe.location_id}
          />
        )}
        {activeTab === "options" && (
          <OptionGroupsTab />
        )}
        {activeTab === "stoplist" && (
          <StopListTab locationId={effectiveLocationId} />
        )}
        {activeTab === "managers" && adminMe.role === "admin" && (
          <ManagersTab locations={locations} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 1. ВКЛАДКА КАТАЛОГУ (Категорії + Страви + Варіанти + Додатки)
// ============================================================================

function CatalogTab({
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
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);

  const { data: products = [], isPending: prodLoading, error: prodError } = useAdminProducts({
    categoryId: selectedCatId,
    locationId: locationId,
  });

  // Модальні вікна
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);

  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);

  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [targetProductForVariant, setTargetProductForVariant] = useState<number | null>(null);
  const [editingVariant, setEditingVariant] = useState<AdminVariant | null>(null);

  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [targetProductForOptions, setTargetProductForOptions] = useState<AdminProduct | null>(null);

  const deleteCategory = useDeleteCategory();
  const deleteProduct = useDeleteProduct();
  const deleteVariant = useDeleteVariant();

  if (catLoading) return <Spinner />;
  if (catError) return <ErrorBox message={catError.message} />;

  const defaultLocation = locationId || userLocationId || (locations[0]?.id ?? 1);

  return (
    <div className="space-y-6">
      {/* Блок категорій */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Категорії ({categories.length})</h2>
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
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => {
              haptic("light");
              setSelectedCatId(null);
            }}
            className="app-press shrink-0 rounded-xl px-3.5 py-2 text-xs font-medium transition-all"
            style={
              selectedCatId === null
                ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                : { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }
            }
          >
            Всі страви
          </button>
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex shrink-0 items-center overflow-hidden rounded-xl border text-xs transition-all"
              style={{
                borderColor: selectedCatId === c.id ? "var(--tg-theme-button-color)" : "var(--app-border)",
                background: selectedCatId === c.id ? "var(--app-tint)" : "var(--app-surface)",
              }}
            >
              <button
                onClick={() => {
                  haptic("light");
                  setSelectedCatId(c.id);
                }}
                className="px-3 py-2 font-medium"
              >
                {c.icon && <span className="mr-1">{c.icon}</span>}
                {c.name}
                <span className="ml-1 opacity-50">({c.products_count})</span>
              </button>
              <button
                onClick={() => {
                  haptic("light");
                  setEditingCategory(c);
                  setCatModalOpen(true);
                }}
                title="Редагувати"
                className="px-2 py-2 opacity-40 hover:opacity-100"
              >
                ✏️
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Блок страв */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">
            Страви {selectedCatId ? `в категорії` : `(всі)`} ({products.length})
          </h2>
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

        {prodLoading ? (
          <Spinner />
        ) : prodError ? (
          <ErrorBox message={prodError.message} />
        ) : products.length === 0 ? (
          <EmptyState icon="🍕" title="Немає страв" hint="Додайте першу страву за допомогою кнопки вище" />
        ) : (
          <div className="space-y-3">
            {products.map((p) => (
              <div
                key={p.id}
                className="app-card rounded-2xl p-3.5 transition-shadow"
                style={{
                  border: "1px solid var(--app-border)",
                  opacity: p.is_available ? 1 : 0.65,
                }}
              >
                <div className="flex gap-3">
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
            ))}
          </div>
        )}
      </section>

      {/* Модальне вікно Категорії */}
      {catModalOpen && (
        <CategoryModal
          category={editingCategory}
          locations={locations}
          defaultLocationId={defaultLocation}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setCatModalOpen(false)}
          onDelete={(id) => {
            deleteCategory.mutate(id);
            setCatModalOpen(false);
          }}
        />
      )}

      {/* Модальне вікно Страви */}
      {prodModalOpen && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          defaultCategoryId={selectedCatId || categories[0]?.id || 1}
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

// ============================================================================
// 2. ВКЛАДКА ГРУП ДОДАТКІВ (Створення, соуси, топінги, ціни)
// ============================================================================

function OptionGroupsTab() {
  const { data: groups = [], isPending, error } = useAdminOptionGroups();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AdminOptionGroup | null>(null);

  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);

  const deleteGroup = useDeleteOptionGroup();

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Групи додатків ({groups.length})</h2>
          <p className="text-xs opacity-60">Соуси, сирні бортики, напої та інгредієнти</p>
        </div>
        <button
          onClick={() => {
            haptic("light");
            setEditingGroup(null);
            setModalOpen(true);
          }}
          className="app-press flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold"
          style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
        >
          <span>+</span> Нова група
        </button>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon="🧩" title="Немає груп додатків" hint="Створіть першу групу додатків, наприклад: 'Соуси' або 'Додатки до піци'" />
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <OptionGroupCard
              key={g.id}
              group={g}
              onEdit={() => {
                setEditingGroup(g);
                setModalOpen(true);
              }}
              onDelete={() => {
                if (window.confirm(`Видалити групу "${g.name}"? Її буде вилучено з усіх страв.`)) {
                  hapticNotify("warning");
                  deleteGroup.mutate(g.id);
                }
              }}
              onAddItem={() => {
                setActiveGroupId(g.id);
                setAddItemModalOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Модалка створення/редагування групи */}
      {modalOpen && (
        <OptionGroupModal
          group={editingGroup}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* Модалка додавання позиції в групу */}
      {addItemModalOpen && activeGroupId && (
        <AddOptionItemModal
          groupId={activeGroupId}
          onClose={() => {
            setAddItemModalOpen(false);
            setActiveGroupId(null);
          }}
        />
      )}
    </div>
  );
}

function OptionGroupCard({
  group,
  onEdit,
  onDelete,
  onAddItem,
}: {
  group: AdminOptionGroup;
  onEdit: () => void;
  onDelete: () => void;
  onAddItem: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: items = [], isPending: itemsLoading } = useAdminOptionGroupItems(expanded ? group.id : 0);

  const deleteItem = useDeleteOptionGroupItem();
  const updateItem = useUpdateOptionGroupItem();

  return (
    <div
      className="app-card rounded-2xl p-3.5 transition-all"
      style={{ border: "1px solid var(--app-border)" }}
    >
      <div className="flex items-center justify-between">
        <div
          onClick={() => {
            haptic("light");
            setExpanded(!expanded);
          }}
          className="flex-1 cursor-pointer min-w-0"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold truncate">{group.name}</span>
            <span className="text-xs opacity-50">{expanded ? "▲" : "▼"}</span>
          </div>
          <p className="text-[11px] opacity-60">
            {group.items_count} позицій • підключено до {group.products_count} страв
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onEdit}
            className="app-press rounded-lg p-1 text-xs opacity-60 hover:opacity-100"
            title="Редагувати"
          >
            ✏️
          </button>
          <button
            onClick={onDelete}
            className="app-press rounded-lg p-1 text-xs opacity-60 hover:opacity-100"
            title="Видалити"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Розгорнутий список позицій у групі */}
      {expanded && (
        <div className="mt-3 border-t pt-2.5 space-y-2" style={{ borderColor: "var(--app-border)" }}>
          <div className="flex items-center justify-between text-xs font-semibold opacity-70">
            <span>Позиції та доплати:</span>
            <button
              onClick={onAddItem}
              className="text-[var(--tg-theme-button-color)] hover:underline"
            >
              + Додати позицію
            </button>
          </div>

          {itemsLoading ? (
            <Spinner />
          ) : items.length === 0 ? (
            <p className="text-xs opacity-50 py-1">Група порожня. Додайте соуси або топінги.</p>
          ) : (
            <div className="space-y-1.5">
              {items.map((it) => (
                <div
                  key={it.variant_id}
                  className="flex items-center justify-between rounded-xl px-2.5 py-2 text-xs"
                  style={{
                    background: "var(--app-surface-2)",
                    opacity: it.is_available ? 1 : 0.5,
                  }}
                >
                  <div className="min-w-0">
                    <p className="font-bold truncate">{it.product_name}</p>
                    <p className="text-[10px] opacity-60">{it.variant_label}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold">
                      {it.price_delta > 0 ? `+${it.price_delta.toFixed(0)} ₴` : "0 ₴"}
                    </span>
                    <button
                      onClick={() => {
                        haptic("light");
                        updateItem.mutate({
                          groupId: group.id,
                          variantId: it.variant_id,
                          payload: { is_available: !it.is_available },
                        });
                      }}
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: it.is_available
                          ? "color-mix(in srgb, #22c55e 15%, transparent)"
                          : "color-mix(in srgb, #ef4444 15%, transparent)",
                        color: it.is_available ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {it.is_available ? "Активна" : "Стоп"}
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Вилучити "${it.product_name}" з групи?`)) {
                          hapticNotify("warning");
                          deleteItem.mutate({ groupId: group.id, variantId: it.variant_id });
                        }
                      }}
                      className="opacity-50 hover:opacity-100 text-xs pl-1"
                      title="Вилучити"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 3. ВКЛАДКА СТОП-ЛИСТУ (Швидке перемикання наявності)
// ============================================================================

function StopListTab({ locationId }: { locationId?: number | null }) {
  const { data: products = [], isPending, error } = useAdminProducts({ locationId });
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const toggleProduct = useToggleProductAvailability();
  const toggleVariant = useToggleVariantAvailability();

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} />;

  const categoryNames = Array.from(new Set(products.map((p) => p.category_name).filter(Boolean))) as string[];

  const filtered = products.filter((p) => {
    const matchSearch =
      search.trim() === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.category_name && p.category_name.toLowerCase().includes(search.toLowerCase()));
    const matchCat = filterCategory === null || p.category_name === filterCategory;
    return matchSearch && matchCat;
  });

  const stoppedCount = products.filter(
    (p) => !p.is_available || p.variants.some((v) => !v.is_available),
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Швидкий Стоп-лист</h2>
          <p className="text-xs opacity-60">
            {stoppedCount > 0
              ? `У стоп-листі: ${stoppedCount} позицій`
              : "Всі страви в наявності"}
          </p>
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Швидкий пошук страви чи напою..."
        className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-1 focus:ring-[var(--tg-theme-button-color)]"
        style={{ background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }}
      />

      {categoryNames.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            onClick={() => {
              haptic("light");
              setFilterCategory(null);
            }}
            className="app-press shrink-0 rounded-full px-3 py-1 font-medium"
            style={
              filterCategory === null
                ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                : { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }
            }
          >
            Всі ({products.length})
          </button>
          {categoryNames.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                haptic("light");
                setFilterCategory(cat);
              }}
              className="app-press shrink-0 rounded-full px-3 py-1 font-medium"
              style={
                filterCategory === cat
                  ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                  : { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }
              }
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((p) => {
          return (
            <div
              key={p.id}
              className="app-card rounded-2xl p-3.5 transition-all"
              style={{
                border: "1px solid var(--app-border)",
                background: !p.is_available
                  ? "color-mix(in srgb, #ef4444 8%, var(--app-surface))"
                  : "var(--app-surface)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Thumb src={p.image_url} className="h-12 w-12 shrink-0 rounded-xl" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{p.name}</p>
                    <p className="text-[11px] opacity-50">{p.category_name}</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    haptic("medium");
                    toggleProduct.mutate({ productId: p.id, isAvailable: !p.is_available });
                  }}
                  className="app-press shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition-colors"
                  style={
                    p.is_available
                      ? { background: "color-mix(in srgb, #22c55e 18%, transparent)", color: "#16a34a" }
                      : { background: "color-mix(in srgb, #ef4444 25%, transparent)", color: "#dc2626" }
                  }
                >
                  {p.is_available ? "✓ Доступно" : "⛔ НА СТОПІ"}
                </button>
              </div>

              {p.variants.length > 0 && (
                <div className="mt-3 border-t pt-2 space-y-1.5" style={{ borderColor: "var(--app-border)" }}>
                  <p className="text-[11px] font-semibold opacity-60">Окремі розміри/порції:</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {p.variants.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs"
                        style={{ background: "var(--app-surface-2)" }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{v.label}</span>
                          {v.weight && <span className="opacity-50">({v.weight})</span>}
                          <span className="font-bold opacity-80">{v.price.toFixed(0)} ₴</span>
                        </div>
                        <button
                          disabled={!p.is_available}
                          onClick={() => {
                            haptic("light");
                            toggleVariant.mutate({ variantId: v.id, isAvailable: !v.is_available });
                          }}
                          className="app-press rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors disabled:opacity-40"
                          style={
                            v.is_available && p.is_available
                              ? { background: "color-mix(in srgb, #22c55e 15%, transparent)", color: "#16a34a" }
                              : { background: "color-mix(in srgb, #ef4444 20%, transparent)", color: "#dc2626" }
                          }
                        >
                          {v.is_available && p.is_available ? "Доступний" : "На стопі"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 4. ВКЛАДКА ШТАТУ / МЕНЕДЖЕРІВ (Тільки для Admin)
// ============================================================================

function ManagersTab({ locations }: { locations: Location[] }) {
  const { data: managers = [], isPending, error } = useAdminManagers();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingManager, setEditingManager] = useState<Manager | null>(null);

  const updateManager = useUpdateManager();
  const deleteManager = useDeleteManager();

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Співробітники ({managers.length})</h2>
          <p className="text-xs opacity-60">Управління доступом до адмінки та модерації</p>
        </div>
        <button
          onClick={() => {
            haptic("light");
            setEditingManager(null);
            setModalOpen(true);
          }}
          className="app-press flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold"
          style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
        >
          <span>+</span> Додати
        </button>
      </div>

      <div className="space-y-2.5">
        {managers.map((m) => {
          const isSuper = m.role === "admin";
          return (
            <div
              key={m.id}
              className="app-card rounded-2xl p-3.5 transition-all"
              style={{
                border: "1px solid var(--app-border)",
                opacity: m.is_active ? 1 : 0.5,
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{isSuper ? "👑" : "👔"}</span>
                    <span className="text-sm font-bold">{m.full_name}</span>
                    <span
                      className="rounded-full px-2 py-0.2 text-[10px] font-bold"
                      style={{
                        background: isSuper
                          ? "color-mix(in srgb, #f59e0b 20%, transparent)"
                          : "var(--app-tint)",
                        color: isSuper ? "#d97706" : "var(--tg-theme-button-color)",
                      }}
                    >
                      {isSuper ? "Адміністратор" : "Менеджер"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs opacity-70">📞 {m.phone}</p>
                  <p className="text-[11px] opacity-50">
                    ID: {m.telegram_id} {m.location_name && `• 📍 ${m.location_name}`}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => {
                      haptic("light");
                      updateManager.mutate({
                        managerId: m.id,
                        payload: { is_active: !m.is_active },
                      });
                    }}
                    className="app-press rounded-lg px-2 py-1 text-[11px] font-bold"
                    style={{
                      background: m.is_active
                        ? "color-mix(in srgb, #22c55e 15%, transparent)"
                        : "color-mix(in srgb, #ef4444 15%, transparent)",
                      color: m.is_active ? "#16a34a" : "#dc2626",
                    }}
                  >
                    {m.is_active ? "Активний" : "Вимкнений"}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        haptic("light");
                        setEditingManager(m);
                        setModalOpen(true);
                      }}
                      className="opacity-60 hover:opacity-100 text-xs"
                      title="Редагувати"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Видалити співробітника ${m.full_name}?`)) {
                          hapticNotify("warning");
                          deleteManager.mutate(m.id);
                        }
                      }}
                      className="opacity-60 hover:opacity-100 text-xs"
                      title="Видалити"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <ManagerModal
          manager={editingManager}
          locations={locations}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// МОДАЛЬНІ ВІКНА (Форми)
// ============================================================================

function ProductOptionsModal({
  product,
  onClose,
}: {
  product: AdminProduct;
  onClose: () => void;
}) {
  const { data: allGroups = [] } = useAdminOptionGroups();
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [minSelect, setMinSelect] = useState("0");
  const [maxSelect, setMaxSelect] = useState("3");
  const [freeCount, setFreeCount] = useState("0");

  const attachGroup = useAttachProductOptionGroup();
  const updateGroup = useUpdateProductOptionGroup();
  const detachGroup = useDetachProductOptionGroup();

  const handleAttach = (e: React.FormEvent) => {
    e.preventDefault();
    const gId = parseInt(selectedGroupId, 10);
    if (!gId) return;

    attachGroup.mutate(
      {
        productId: product.id,
        payload: {
          group_id: gId,
          min_select: parseInt(minSelect, 10) || 0,
          max_select: parseInt(maxSelect, 10) || 1,
          free_count: parseInt(freeCount, 10) || 0,
        },
      },
      {
        onSuccess: () => {
          hapticNotify("success");
          setSelectedGroupId("");
          setMinSelect("0");
          setMaxSelect("3");
          setFreeCount("0");
        },
      },
    );
  };

  const attached = product.option_groups || [];
  const attachedIds = new Set(attached.map((a) => a.group_id));
  const availableToAttach = allGroups.filter((g) => !attachedIds.has(g.id));

  const inputStyle = { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="app-card w-full max-w-md rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--tg-theme-bg-color)", border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base">Додатки до страви</h3>
            <p className="text-xs opacity-60">«{product.name}»</p>
          </div>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        {/* Список вже прив'язаних груп */}
        <div className="space-y-2">
          <span className="text-xs font-bold opacity-70">Прикріплені групи додатків:</span>
          {attached.length === 0 ? (
            <p className="text-xs opacity-50 py-1">Ще немає прив'язаних додатків.</p>
          ) : (
            attached.map((og: ProductOptionGroupAdmin) => (
              <AttachedGroupRow
                key={og.group_id}
                item={og}
                onUpdate={(payload) => updateGroup.mutate({ productId: product.id, groupId: og.group_id, payload })}
                onDetach={() => detachGroup.mutate({ productId: product.id, groupId: og.group_id })}
              />
            ))
          )}
        </div>

        {/* Форма прив'язки нової групи */}
        {availableToAttach.length > 0 && (
          <form onSubmit={handleAttach} className="rounded-xl border p-3 space-y-3" style={{ borderColor: "var(--app-border)" }}>
            <span className="text-xs font-bold opacity-80">+ Прикріпити нову групу:</span>

            <label className="block text-xs">
              <span className="opacity-60">Група додатків</span>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                required
                className="mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={inputStyle}
              >
                <option value="">-- Виберіть групу --</option>
                {availableToAttach.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.items_count} поз.)
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <label className="block">
                <span className="opacity-60 text-[10px]">Мін. вибір</span>
                <input
                  type="number"
                  min="0"
                  value={minSelect}
                  onChange={(e) => setMinSelect(e.target.value)}
                  className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={inputStyle}
                />
              </label>
              <label className="block">
                <span className="opacity-60 text-[10px]">Макс. вибір</span>
                <input
                  type="number"
                  min="1"
                  value={maxSelect}
                  onChange={(e) => setMaxSelect(e.target.value)}
                  className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={inputStyle}
                />
              </label>
              <label className="block">
                <span className="opacity-60 text-[10px]">Безкоштовно</span>
                <input
                  type="number"
                  min="0"
                  value={freeCount}
                  onChange={(e) => setFreeCount(e.target.value)}
                  className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={inputStyle}
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={!selectedGroupId}
              className="app-press w-full rounded-xl py-2 text-xs font-bold disabled:opacity-40"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              Прикріпити до страви
            </button>
          </form>
        )}

        <button
          onClick={onClose}
          className="app-press w-full rounded-xl py-2.5 text-xs font-bold"
          style={{ background: "var(--app-surface-2)" }}
        >
          Готово
        </button>
      </div>
    </div>
  );
}

function AttachedGroupRow({
  item,
  onUpdate,
  onDetach,
}: {
  item: ProductOptionGroupAdmin;
  onUpdate: (payload: { min_select: number; max_select: number; free_count: number }) => void;
  onDetach: () => void;
}) {
  const [min, setMin] = useState(String(item.min_select));
  const [max, setMax] = useState(String(item.max_select));
  const [free, setFree] = useState(String(item.free_count));
  const [dirty, setDirty] = useState(false);

  const handleSave = () => {
    onUpdate({
      min_select: parseInt(min, 10) || 0,
      max_select: parseInt(max, 10) || 1,
      free_count: parseInt(free, 10) || 0,
    });
    setDirty(false);
    hapticNotify("success");
  };

  const inputStyle = { background: "var(--tg-theme-bg-color)", color: "var(--tg-theme-text-color)" };

  return (
    <div className="rounded-xl p-2.5 space-y-2 text-xs" style={{ background: "var(--app-surface-2)" }}>
      <div className="flex items-center justify-between">
        <span className="font-bold">🧩 {item.group_name}</span>
        <button
          onClick={() => {
            if (window.confirm(`Відв'язати групу "${item.group_name}" від страви?`)) {
              onDetach();
            }
          }}
          className="opacity-50 hover:opacity-100 text-red-500 font-medium"
        >
          Відкріпити
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="opacity-50 text-[10px]">Мін (0=опц.)</span>
          <input
            type="number"
            min="0"
            value={min}
            onChange={(e) => {
              setMin(e.target.value);
              setDirty(true);
            }}
            className="mt-0.5 w-full rounded-md px-2 py-1 text-xs outline-none"
            style={inputStyle}
          />
        </label>
        <label className="block">
          <span className="opacity-50 text-[10px]">Макс (к-сть)</span>
          <input
            type="number"
            min="1"
            value={max}
            onChange={(e) => {
              setMax(e.target.value);
              setDirty(true);
            }}
            className="mt-0.5 w-full rounded-md px-2 py-1 text-xs outline-none"
            style={inputStyle}
          />
        </label>
        <label className="block">
          <span className="opacity-50 text-[10px]">Безкоштовно</span>
          <input
            type="number"
            min="0"
            value={free}
            onChange={(e) => {
              setFree(e.target.value);
              setDirty(true);
            }}
            className="mt-0.5 w-full rounded-md px-2 py-1 text-xs outline-none"
            style={inputStyle}
          />
        </label>
      </div>

      {dirty && (
        <button
          onClick={handleSave}
          className="app-press w-full rounded-lg py-1 font-bold text-[11px]"
          style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
        >
          Зберегти ліміти
        </button>
      )}
    </div>
  );
}

function OptionGroupModal({
  group,
  onClose,
}: {
  group: AdminOptionGroup | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(group?.name || "");
  const [sortOrder, setSortOrder] = useState(group?.sort_order ?? 0);

  const createGroup = useCreateOptionGroup();
  const updateGroup = useUpdateOptionGroup();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (group) {
      const payload: OptionGroupUpdatePayload = {
        name: name.trim(),
        sort_order: Number(sortOrder),
      };
      updateGroup.mutate(
        { groupId: group.id, payload },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
        },
      );
    } else {
      const payload: OptionGroupCreatePayload = {
        name: name.trim(),
        sort_order: Number(sortOrder),
      };
      createGroup.mutate(payload, {
        onSuccess: () => {
          hapticNotify("success");
          onClose();
        },
      });
    }
  };

  const inputStyle = { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="app-card w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ background: "var(--tg-theme-bg-color)", border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">{group ? "Редагування групи" : "Нова група додатків"}</h3>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <label className="block">
            <span className="opacity-60">Назва групи додатків</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Соус до піци, Додатки, Напої..."
              required
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <label className="block">
            <span className="opacity-60">Порядок сортування</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="app-press rounded-xl px-4 py-2.5 font-semibold opacity-70"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="app-press flex-1 rounded-xl py-2.5 font-bold"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              Зберегти
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddOptionItemModal({
  groupId,
  onClose,
}: {
  groupId: number;
  onClose: () => void;
}) {
  const { data: choices = [], isPending } = useAdminVariantChoices();
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [priceDelta, setPriceDelta] = useState<string>("0");
  const [search, setSearch] = useState("");

  const addItem = useAddOptionGroupItem();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const vId = parseInt(selectedVariantId, 10);
    if (!vId) return;

    const payload: OptionGroupItemCreatePayload = {
      variant_id: vId,
      price_delta: parseFloat(priceDelta) || 0,
      sort_order: 0,
      is_available: true,
    };

    addItem.mutate(
      { groupId, payload },
      {
        onSuccess: () => {
          hapticNotify("success");
          onClose();
        },
      },
    );
  };

  const filteredChoices = choices.filter(
    (c) =>
      search.trim() === "" ||
      c.product_name.toLowerCase().includes(search.toLowerCase()) ||
      c.variant_label.toLowerCase().includes(search.toLowerCase()),
  );

  const inputStyle = { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="app-card w-full max-w-sm rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--tg-theme-bg-color)", border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">Додати позицію в групу</h3>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <span className="opacity-60">Пошук страви/соусу</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Фільтр страв..."
              className="mt-1 w-full rounded-xl px-3 py-2 text-xs outline-none"
              style={inputStyle}
            />
          </div>

          <label className="block">
            <span className="opacity-60">Виберіть варіант товару</span>
            {isPending ? (
              <Spinner />
            ) : (
              <select
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(e.target.value)}
                required
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              >
                <option value="">-- Оберіть товар зі списку --</option>
                {filteredChoices.map((c) => (
                  <option key={c.variant_id} value={c.variant_id}>
                    {c.product_name} ({c.variant_label}) - {c.price.toFixed(0)} ₴
                  </option>
                ))}
              </select>
            )}
          </label>

          <label className="block">
            <span className="opacity-60">Доплата як додаток (₴)</span>
            <input
              type="number"
              step="any"
              value={priceDelta}
              onChange={(e) => setPriceDelta(e.target.value)}
              placeholder="20 (0 = без доплати)"
              required
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
            <span className="mt-1 block text-[10px] opacity-50">
              Ця сума додається до ціни страви при виборі даного додатку.
            </span>
          </label>

          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="app-press rounded-xl px-4 py-2.5 font-semibold opacity-70"
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={!selectedVariantId}
              className="app-press flex-1 rounded-xl py-2.5 font-bold disabled:opacity-40"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              Додати в групу
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoryModal({
  category,
  locations,
  defaultLocationId,
  isSuperAdmin,
  onClose,
  onDelete,
}: {
  category: AdminCategory | null;
  locations: Location[];
  defaultLocationId: number;
  isSuperAdmin: boolean;
  onClose: () => void;
  onDelete: (id: number) => void;
}) {
  const [name, setName] = useState(category?.name || "");
  const [icon, setIcon] = useState(category?.icon || "🍕");
  const [sortOrder, setSortOrder] = useState(category?.sort_order ?? 0);
  const [isVisible, setIsVisible] = useState(category?.is_visible ?? true);
  const [locId, setLocId] = useState(category?.location_id || defaultLocationId);

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (category) {
      const payload: CategoryUpdatePayload = {
        name: name.trim(),
        icon: icon.trim() || null,
        sort_order: Number(sortOrder),
        is_visible: isVisible,
      };
      if (isSuperAdmin) payload.location_id = Number(locId);

      updateCategory.mutate(
        { categoryId: category.id, payload },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
        },
      );
    } else {
      const payload: CategoryCreatePayload = {
        name: name.trim(),
        location_id: Number(locId),
        icon: icon.trim() || null,
        sort_order: Number(sortOrder),
        is_visible: isVisible,
      };

      createCategory.mutate(payload, {
        onSuccess: () => {
          hapticNotify("success");
          onClose();
        },
      });
    }
  };

  const inputStyle = { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="app-card w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ background: "var(--tg-theme-bg-color)", border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">{category ? "Редагування категорії" : "Нова категорія"}</h3>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <label className="block">
            <span className="opacity-60">Назва</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Піца, Напої, Десерти..."
              required
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="opacity-60">Іконка (емодзі)</span>
              <input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="🍕"
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm text-center outline-none"
                style={inputStyle}
              />
            </label>

            <label className="block">
              <span className="opacity-60">Порядок сортування</span>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </label>
          </div>

          {isSuperAdmin && (
            <label className="block">
              <span className="opacity-60">Заклад</span>
              <select
                value={locId}
                onChange={(e) => setLocId(Number(e.target.value))}
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex items-center gap-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => setIsVisible(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span className="font-medium">Видима для клієнтів</span>
          </label>

          <div className="flex gap-2 pt-3">
            {category && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Видалити категорію "${category.name}" та всі її страви?`)) {
                    onDelete(category.id);
                  }
                }}
                className="app-press rounded-xl px-4 py-2.5 font-semibold text-red-500 bg-red-500/10"
              >
                Видалити
              </button>
            )}
            <button
              type="submit"
              className="app-press flex-1 rounded-xl py-2.5 font-bold"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              Зберегти
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProductModal({
  product,
  categories,
  defaultCategoryId,
  onClose,
}: {
  product: AdminProduct | null;
  categories: AdminCategory[];
  defaultCategoryId: number;
  onClose: () => void;
}) {
  const [name, setName] = useState(product?.name || "");
  const [categoryId, setCategoryId] = useState(product?.category_id || defaultCategoryId);
  const [description, setDescription] = useState(product?.description || "");
  const [imageUrl, setImageUrl] = useState(product?.image_url || "");
  const [sortOrder, setSortOrder] = useState(product?.sort_order ?? 0);

  const [initialVariantLabel, setInitialVariantLabel] = useState("Стандарт");
  const [initialVariantPrice, setInitialVariantPrice] = useState("150");
  const [initialVariantWeight, setInitialVariantWeight] = useState("");

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (product) {
      const payload: ProductUpdatePayload = {
        name: name.trim(),
        category_id: Number(categoryId),
        description: description.trim() || null,
        image_url: imageUrl.trim() || null,
        sort_order: Number(sortOrder),
      };
      updateProduct.mutate(
        { productId: product.id, payload },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
        },
      );
    } else {
      const payload: ProductCreatePayload = {
        name: name.trim(),
        category_id: Number(categoryId),
        description: description.trim() || null,
        image_url: imageUrl.trim() || null,
        sort_order: Number(sortOrder),
        is_available: true,
        variants: [
          {
            label: initialVariantLabel.trim() || "Стандарт",
            price: parseFloat(initialVariantPrice) || 0,
            weight: initialVariantWeight.trim() || null,
            sort_order: 0,
            is_available: true,
          },
        ],
      };
      createProduct.mutate(payload, {
        onSuccess: () => {
          hapticNotify("success");
          onClose();
        },
      });
    }
  };

  const inputStyle = { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="app-card w-full max-w-sm rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--tg-theme-bg-color)", border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">{product ? "Редагування страви" : "Нова страва"}</h3>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <label className="block">
            <span className="opacity-60">Назва страви</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Маргарита, Чізбургер..."
              required
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <label className="block">
            <span className="opacity-60">Категорія</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name} ({c.location_name})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="opacity-60">Опис / Склад</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Склад, алергени або особливості страви..."
              className="mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <label className="block">
            <span className="opacity-60">URL зображення</span>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <label className="block">
            <span className="opacity-60">Порядок сортування</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          {!product && (
            <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "var(--app-border)" }}>
              <span className="font-bold opacity-80">Початковий варіант ціни:</span>
              <div className="grid grid-cols-3 gap-2">
                <label className="block col-span-1">
                  <span className="opacity-50 text-[10px]">Розмір</span>
                  <input
                    value={initialVariantLabel}
                    onChange={(e) => setInitialVariantLabel(e.target.value)}
                    placeholder="30 см"
                    className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                    style={inputStyle}
                  />
                </label>
                <label className="block col-span-1">
                  <span className="opacity-50 text-[10px]">Ціна (₴)</span>
                  <input
                    type="number"
                    value={initialVariantPrice}
                    onChange={(e) => setInitialVariantPrice(e.target.value)}
                    placeholder="180"
                    required
                    className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                    style={inputStyle}
                  />
                </label>
                <label className="block col-span-1">
                  <span className="opacity-50 text-[10px]">Вага / Об'єм</span>
                  <input
                    value={initialVariantWeight}
                    onChange={(e) => setInitialVariantWeight(e.target.value)}
                    placeholder="450 г"
                    className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                    style={inputStyle}
                  />
                </label>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="app-press rounded-xl px-4 py-2.5 font-semibold opacity-70"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="app-press flex-1 rounded-xl py-2.5 font-bold"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              {product ? "Зберегти" : "Створити страву"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VariantModal({
  productId,
  variant,
  onClose,
}: {
  productId: number;
  variant: AdminVariant | null;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(variant?.label || "Порція");
  const [price, setPrice] = useState(variant ? String(variant.price) : "100");
  const [weight, setWeight] = useState(variant?.weight || "");
  const [sortOrder, setSortOrder] = useState(variant?.sort_order ?? 0);

  const createVariant = useCreateVariant();
  const updateVariant = useUpdateVariant();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !price) return;

    if (variant) {
      const payload: VariantUpdatePayload = {
        label: label.trim(),
        price: parseFloat(price) || 0,
        weight: weight.trim() || null,
        sort_order: Number(sortOrder),
      };
      updateVariant.mutate(
        { variantId: variant.id, payload },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
        },
      );
    } else {
      const payload: VariantCreatePayload = {
        label: label.trim(),
        price: parseFloat(price) || 0,
        weight: weight.trim() || null,
        sort_order: Number(sortOrder),
        is_available: true,
      };
      createVariant.mutate(
        { productId, payload },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
        },
      );
    }
  };

  const inputStyle = { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="app-card w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ background: "var(--tg-theme-bg-color)", border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">{variant ? "Редагування розміру/ціни" : "Новий розмір/ціна"}</h3>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <label className="block">
            <span className="opacity-60">Назва варіанта (напр. 30 см, 0.5 л, Велика)</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="30 см"
              required
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="opacity-60">Ціна (₴)</span>
              <input
                type="number"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="150"
                required
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </label>

            <label className="block">
              <span className="opacity-60">Вага / Вихід (опц.)</span>
              <input
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="450 г"
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </label>
          </div>

          <label className="block">
            <span className="opacity-60">Порядок сортування</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="app-press rounded-xl px-4 py-2.5 font-semibold opacity-70"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="app-press flex-1 rounded-xl py-2.5 font-bold"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              Зберегти
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ManagerModal({
  manager,
  locations,
  onClose,
}: {
  manager: Manager | null;
  locations: Location[];
  onClose: () => void;
}) {
  const [telegramId, setTelegramId] = useState(manager ? String(manager.telegram_id) : "");
  const [role, setRole] = useState<"admin" | "manager">(manager?.role || "manager");
  const [locationId, setLocationId] = useState<string>(
    manager?.location_id ? String(manager.location_id) : "",
  );

  const createManager = useCreateManager();
  const updateManager = useUpdateManager();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLoc = locationId ? Number(locationId) : null;

    if (manager) {
      updateManager.mutate(
        {
          managerId: manager.id,
          payload: {
            role,
            location_id: parsedLoc,
          },
        },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
        },
      );
    } else {
      const tid = parseInt(telegramId.trim(), 10);
      if (isNaN(tid)) {
        alert("Введіть коректний числовий Telegram ID");
        return;
      }
      createManager.mutate(
        {
          telegram_id: tid,
          role,
          location_id: parsedLoc,
        },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
          onError: (err) => {
            alert(`Помилка: ${err.message}`);
          },
        },
      );
    }
  };

  const inputStyle = { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="app-card w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ background: "var(--tg-theme-bg-color)", border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">
            {manager ? "Редагування співробітника" : "Призначити співробітника"}
          </h3>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <label className="block">
            <span className="opacity-60">Telegram ID</span>
            <input
              type="number"
              value={telegramId}
              disabled={!!manager}
              onChange={(e) => setTelegramId(e.target.value)}
              placeholder="123456789"
              required
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none disabled:opacity-50"
              style={inputStyle}
            />
            {!manager && (
              <span className="mt-1 block text-[10px] opacity-50">
                Користувач вже повинен відкрити бот або додаток, щоб бути в базі.
              </span>
            )}
          </label>

          <label className="block">
            <span className="opacity-60">Роль</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "manager")}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            >
              <option value="manager">Менеджер закладу</option>
              <option value="admin">Головний адміністратор</option>
            </select>
          </label>

          <label className="block">
            <span className="opacity-60">Заклад (прив'язка)</span>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            >
              <option value="">Без прив'язки (всі заклади)</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="app-press rounded-xl px-4 py-2.5 font-semibold opacity-70"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="app-press flex-1 rounded-xl py-2.5 font-bold"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              Зберегти
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
