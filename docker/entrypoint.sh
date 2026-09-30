#!/bin/sh
# Entrypoint del servicio `app` (self-hosted con Docker).
# 1. Backup rotativo de la DB (un solo archivo .bak, se pisa en cada arranque).
# 2. `prisma db push`: crea el schema SQLite la primera vez y lo actualiza tras un `git pull`.
#    Sin --accept-data-loss: si un cambio de schema borraría datos, falla y no arranca.
# 3. Bootstrap idempotente del ranking raíz (migrate-rankings.ts), sin su backup por archivo.
# 4. `next start` como proceso principal para que reciba SIGTERM directo.
set -eu

DB_FILE="${DATABASE_URL#file:}"
case "$DB_FILE" in
  /*)
    if [ -s "$DB_FILE" ]; then
      cp "$DB_FILE" "$DB_FILE.bak"
      echo "[entrypoint] backup: $DB_FILE.bak"
    fi
    ;;
esac

echo "[entrypoint] prisma db push"
npx prisma db push --skip-generate

echo "[entrypoint] bootstrap del ranking raíz"
MIGRATE_SKIP_BACKUP=1 npx tsx scripts/migrate-rankings.ts

echo "[entrypoint] next start en :3000"
exec ./node_modules/.bin/next start -p 3000
