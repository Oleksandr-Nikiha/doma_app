-- 0008_order_statuses.sql
-- Оновлення перевірного обмеження для статусів замовлень (додано on_the_way / delivering)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (
    status = ANY (ARRAY[
        'pending_moderation'::text,
        'confirmed'::text,
        'in_progress'::text,
        'cooking'::text,
        'ready'::text,
        'ready_for_pickup'::text,
        'on_the_way'::text,
        'delivering'::text,
        'completed'::text,
        'rejected'::text,
        'cancelled'::text
    ])
);

-- Оновлюємо тригер синхронізації order_groups, якщо є права суперкористувача
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_roles r ON p.proowner = r.oid
        WHERE p.proname = 'trg_sync_order_status_to_groups'
          AND r.rolname = current_user
    ) THEN
        EXECUTE $sql$
        CREATE OR REPLACE FUNCTION trg_sync_order_status_to_groups()
        RETURNS TRIGGER AS $trg$
        BEGIN
            IF NEW.status IS DISTINCT FROM OLD.status THEN
                UPDATE order_groups
                SET status = CASE NEW.status
                    WHEN 'confirmed' THEN 'accepted'
                    WHEN 'cooking' THEN 'cooking'
                    WHEN 'in_progress' THEN 'cooking'
                    WHEN 'ready' THEN 'ready'
                    WHEN 'ready_for_pickup' THEN 'ready'
                    WHEN 'on_the_way' THEN 'ready'
                    WHEN 'delivering' THEN 'ready'
                    WHEN 'completed' THEN 'ready'
                    WHEN 'rejected' THEN 'cancelled'
                    WHEN 'cancelled' THEN 'cancelled'
                    ELSE 'pending'
                END
                WHERE order_id = NEW.id;
            END IF;
            RETURN NEW;
        END;
        $trg$ LANGUAGE plpgsql;
        $sql$;
    END IF;
END $$;

