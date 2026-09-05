#!/usr/bin/env bash
# Перегенеровує VITE_DEV_INIT_DATA у .env і перепіднімає фронтенд-контейнер.
#
# Навіщо: підписаний initData живе 24 години (max_age_seconds у валідаторі).
# Після протухання застосунок у браузері отримує 401 на кожен захищений запит,
# і це виглядає як зламаний код — хоча треба лише оновити рядок.
#
#   ./scripts/refresh_dev_init_data.sh
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .env ] || { echo "Немає .env — скопіюйте з .env.example"; exit 1; }

BOT_TOKEN=$(grep '^BOT_TOKEN=' .env | cut -d= -f2-)
[ -n "$BOT_TOKEN" ] || { echo "BOT_TOKEN не заданий у .env"; exit 1; }

PY=$([ -x .venv/bin/python ] && echo .venv/bin/python || echo python3)
NEW=$("$PY" scripts/generate_test_init_data.py "$BOT_TOKEN" | tail -2 | head -1)
[ -n "$NEW" ] || { echo "Не вдалося згенерувати initData"; exit 1; }

# BSD/GNU-сумісна заміна рядка без sed -i з екрануванням спецсимволів
"$PY" - "$NEW" <<'PYEOF'
import sys
new = sys.argv[1]
lines = open('.env', encoding='utf-8').read().splitlines(True)
found = False
out = []
for line in lines:
    if line.startswith('VITE_DEV_INIT_DATA='):
        out.append(f'VITE_DEV_INIT_DATA={new}\n'); found = True
    else:
        out.append(line)
if not found:
    out.append(f'\nVITE_DEV_INIT_DATA={new}\n')
open('.env', 'w', encoding='utf-8').write(''.join(out))
PYEOF

echo "✓ VITE_DEV_INIT_DATA оновлено (дійсний 24 години)"

# env_file читається при СТВОРЕННІ контейнера, тож restart тут не допоможе
if docker compose -f docker-compose.dev.yml ps --status running --services 2>/dev/null | grep -qx frontend; then
    docker compose -f docker-compose.dev.yml up -d --force-recreate frontend >/dev/null
    echo "✓ frontend перестворено з новою змінною"
else
    echo "  (frontend не запущений — змінна підхопиться при старті)"
fi
