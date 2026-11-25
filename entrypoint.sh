#!/bin/sh
set -e

# Determine if H2 file mode is explicitly requested (dev profile or jdbc:h2 URL).
# In PostgreSQL production mode (default 'prod'), skip H2 seeding entirely and preserve existing data/dayforgedb.mv.db.
IS_H2_MODE=false
case ",${SPRING_PROFILES_ACTIVE:-prod}," in
    *,dev,*) IS_H2_MODE=true ;;
esac
case "${SUPABASE_DB_URL:-}" in
    jdbc:h2:*) IS_H2_MODE=true ;;
esac

if [ "$IS_H2_MODE" = "true" ]; then
    DB_BASE="${DB_PATH:-/var/data/keizoku}"
    DATA_DIR="$(dirname "$DB_BASE")"
    TARGET_DB="${DB_BASE}.mv.db"
    APP_DATA_DIR="/app/data"
    SEED_DB="/app/seed-data/dayforgedb.mv.db"

    mkdir -p "$DATA_DIR" "$APP_DATA_DIR"

    if [ ! -f "$TARGET_DB" ]; then
        if [ "$DATA_DIR/dayforgedb.mv.db" != "$TARGET_DB" ] && [ -f "$DATA_DIR/dayforgedb.mv.db" ]; then
            echo "Found legacy database at $DATA_DIR/dayforgedb.mv.db. Migrating to $TARGET_DB..."
            cp -p "$DATA_DIR/dayforgedb.mv.db" "${TARGET_DB}.tmp" && mv "${TARGET_DB}.tmp" "$TARGET_DB"
        elif [ -f "$SEED_DB" ]; then
            echo "Initializing $TARGET_DB from application template..."
            cp -p "$SEED_DB" "${TARGET_DB}.tmp" && mv "${TARGET_DB}.tmp" "$TARGET_DB"
        fi
    else
        echo "Existing database found at $TARGET_DB. Preserving existing data."
    fi

    chown -R appuser:appgroup "$DATA_DIR" "$APP_DATA_DIR"
    chmod -R 775 "$DATA_DIR" "$APP_DATA_DIR"
else
    echo "PostgreSQL production mode active (profile=${SPRING_PROFILES_ACTIVE:-prod}); skipping H2 initialization."
fi

# If custom command passed, execute under appuser; otherwise start the Spring Boot JAR
if [ $# -gt 0 ]; then
    exec su-exec appuser "$@"
else
    exec su-exec appuser java -Dserver.address=0.0.0.0 "-Dserver.port=${PORT:-10000}" -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -jar /app/app.jar
fi
