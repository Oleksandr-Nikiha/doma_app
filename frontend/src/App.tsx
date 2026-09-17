import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { ApiError } from "@/api/client";
import { useMe } from "@/api/queries";
import { Layout } from "@/components/Layout";
import { ErrorBox, Spinner } from "@/components/ui";
import { CartPage } from "@/pages/CartPage";
import { CategoriesPage } from "@/pages/CategoriesPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { ContactsPage } from "@/pages/ContactsPage";
import { OrderSuccessPage } from "@/pages/OrderSuccessPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { ProductPage } from "@/pages/ProductPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { RegisterPage } from "@/pages/RegisterPage";

import { isTelegramWebApp } from "@/telegram/env";

// Адмінка важить 150 КБ і потрібна лише персоналу — завантажуємо окремим чанком
const AdminPage = lazy(() => import("@/pages/AdminPage").then((m) => ({ default: m.AdminPage })));
const AdminLoginPage = lazy(() => import("@/pages/AdminLoginPage").then((m) => ({ default: m.AdminLoginPage })));

export function App() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const { data: user, isPending, error, refetch } = useMe();
  const isTg = isTelegramWebApp();

  // Для адмін-панелі (/admin, /admin/login) не показуємо онбординг клієнта
  if (!isAdminRoute) {
    if (isPending) return <Spinner />;

    // 401 означає, що бекенд не визнав підпис initData всередині Telegram.
    if (isTg && error instanceof ApiError && error.status === 401) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center px-8 text-center">
          <div className="text-5xl">🔒</div>
          <p className="mt-4 font-medium">Не вдалося підтвердити сесію</p>
          <p className="mt-2 text-sm opacity-60">
            Відкрийте застосунок через кнопку «Меню» в боті Doma.
          </p>
          <p className="mt-4 text-xs opacity-40">{error.detail}</p>
        </div>
      );
    }

    // Інші помилки мережі (500 тощо)
    if (error && !(error instanceof ApiError && error.status === 401)) {
      return <ErrorBox message={error.message} onRetry={() => void refetch()} />;
    }

    // Усередині Telegram, якщо нового користувача ще немає в БД — показуємо онбординг
    if (isTg && !user) return <RegisterPage />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<CategoriesPage />} />
        <Route path="/categories/:categoryId" element={<ProductsPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/orders" element={<OrdersPage />} />
      </Route>
      {/* Картка товару, чекаут, екран успіху та адмінка — без клієнтської нижньої панелі */}
      <Route
        path="/admin/login"
        element={
          <Suspense fallback={<Spinner />}>
            <AdminLoginPage />
          </Suspense>
        }
      />
      <Route
        path="/admin"
        element={
          <Suspense fallback={<Spinner />}>
            <AdminPage />
          </Suspense>
        }
      />
      <Route path="/products/:productId" element={<ProductPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/orders/:orderId/success" element={<OrderSuccessPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
