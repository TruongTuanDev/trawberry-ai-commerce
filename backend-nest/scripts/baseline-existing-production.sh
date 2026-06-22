#!/usr/bin/env sh
set -eu

status_output="$(npx prisma migrate status 2>&1)" || status_code=$?
status_code="${status_code:-0}"

if [ "$status_code" -eq 0 ]; then
  echo "Prisma migration history already exists; baseline is not required."
  exit 0
fi

if ! printf '%s\n' "$status_output" | grep -Eq 'P3005|database schema is not empty'; then
  printf '%s\n' "$status_output"
  echo "Refusing to baseline: Prisma did not report an existing non-empty schema."
  exit "$status_code"
fi

set +e
diff_output="$(npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --exit-code 2>&1)"
diff_code=$?
set -e

if [ "$diff_code" -ne 0 ]; then
  printf '%s\n' "$diff_output"
  echo "Refusing to baseline: the live schema differs from the Prisma data model."
  exit 1
fi

echo "Live schema matches the Prisma data model. Baseline existing migrations."
for migration_dir in prisma/migrations/*; do
  migration="$(basename "$migration_dir")"
  case "$migration" in
    20260620_add_public_product_full_text_search|20260620_add_visual_product_embeddings)
      continue
      ;;
  esac
  npx prisma migrate resolve --applied "$migration"
done

echo "Existing production schema baseline completed."
