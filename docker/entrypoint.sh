#!/bin/bash
set -e

# =============================================================================
# DocRoom Docker Entrypoint
# Handles runtime environment injection and role-based startup
# =============================================================================

echo "=============================================="
echo "  DocRoom Container Startup"
echo "=============================================="
echo ""

# =============================================================================
# Runtime Environment Variable Injection
# =============================================================================
# Next.js bakes NEXT_PUBLIC_* variables at build time. For Docker deployments,
# we use placeholders during build and replace them with actual values at runtime.

echo "[1/3] Injecting runtime environment variables..."

# List of NEXT_PUBLIC_ variables to inject at runtime
# Note: NEXT_PUBLIC_UPLOAD_TRANSPORT is hardcoded to "s3" at build time
# because it's used in server-side conditionals evaluated at build time
NEXT_PUBLIC_VARS=(
    "NEXT_PUBLIC_BASE_URL"
    "NEXT_PUBLIC_MARKETING_URL"
    "NEXT_PUBLIC_APP_BASE_HOST"
    "NEXT_PUBLIC_APP_DOMAIN"
    "NEXT_PUBLIC_SELFHOSTED"
    "NEXT_PUBLIC_DISABLE_SIGNUP"
    "NEXT_PUBLIC_WEBHOOK_BASE_URL"
    "NEXT_PUBLIC_WEBHOOK_BASE_HOST"
)

# Only inject if we're running the app (not worker)
if [ "${APP_ROLE}" = "app" ]; then
    for VAR_NAME in "${NEXT_PUBLIC_VARS[@]}"; do
        VAR_VALUE="${!VAR_NAME}"
        PLACEHOLDER="__${VAR_NAME}__"

        if [ -n "$VAR_VALUE" ]; then
            echo "  - $VAR_NAME"
            # Replace placeholders in all JS files
            find /app/.next -type f \( -name "*.js" -o -name "*.json" \) -exec \
                sed -i "s|${PLACEHOLDER}|${VAR_VALUE}|g" {} + 2>/dev/null || true
        fi
    done
    echo "  Done!"
else
    echo "  Skipped (worker mode)"
fi

echo ""

# =============================================================================
# Role-based Startup
# =============================================================================
APP_ROLE="${APP_ROLE:-app}"

echo "[2/3] Starting in ${APP_ROLE} mode..."
echo ""

case "$APP_ROLE" in
    # =========================================================================
    # Application Server
    # =========================================================================
    app)
        echo "[3/3] Running database migrations..."

        # Run migrations
        npx prisma migrate deploy

        # Smart auto-seed: Check if database needs seeding
        # We check if the Integration table has any records - if empty, it's a fresh DB
        echo ""
        echo "Checking if database needs seeding..."

        INTEGRATION_COUNT=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) as count FROM \"Integration\";" 2>/dev/null | grep -oE '[0-9]+' | head -1 || echo "0")

        if [ "$RUN_SEED" = "true" ]; then
            echo "  RUN_SEED=true, running seed..."
            npx prisma db seed || echo "  Seed completed or skipped"
        elif [ "$INTEGRATION_COUNT" = "0" ] || [ -z "$INTEGRATION_COUNT" ]; then
            echo "  Fresh database detected (no integrations found)"
            echo "  Auto-running seed..."
            npx prisma db seed || echo "  Seed completed or skipped"
        else
            echo "  Database already seeded ($INTEGRATION_COUNT integrations found)"
        fi

        echo ""
        echo "=============================================="
        echo "  Starting Next.js server on port ${PORT:-3000}"
        echo "=============================================="
        echo ""

        exec node server.js
        ;;

    # =========================================================================
    # Background Workers
    # =========================================================================
    worker)
        echo "[3/3] Waiting for database connection..."

        # Wait for database to be ready
        MAX_RETRIES=30
        RETRY_COUNT=0

        until npx prisma db execute --stdin <<< "SELECT 1" 2>/dev/null; do
            RETRY_COUNT=$((RETRY_COUNT + 1))
            if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
                echo "ERROR: Database connection timeout after ${MAX_RETRIES} attempts!"
                exit 1
            fi
            echo "  Attempt $RETRY_COUNT/$MAX_RETRIES - waiting 2s..."
            sleep 2
        done

        echo "  Database connected!"
        echo ""
        echo "=============================================="
        echo "  Starting BullMQ Workers"
        echo "=============================================="
        echo ""

        exec npx tsx workers/index.ts
        ;;

    # =========================================================================
    # Migration Only (one-off job)
    # =========================================================================
    migrate)
        echo "[3/3] Running migrations..."
        npx prisma migrate deploy
        echo ""
        echo "Migrations complete!"
        exit 0
        ;;

    # =========================================================================
    # Seed Only (one-off job)
    # =========================================================================
    seed)
        echo "[3/3] Running database seed..."
        npx prisma db seed
        echo ""
        echo "Seed complete!"
        exit 0
        ;;

    # =========================================================================
    # Prisma Studio (for debugging)
    # =========================================================================
    studio)
        echo "[3/3] Starting Prisma Studio..."
        exec npx prisma studio
        ;;

    # =========================================================================
    # Unknown Role
    # =========================================================================
    *)
        echo "ERROR: Unknown APP_ROLE: $APP_ROLE"
        echo ""
        echo "Valid roles:"
        echo "  - app      : Run Next.js application server"
        echo "  - worker   : Run BullMQ background workers"
        echo "  - migrate  : Run database migrations only"
        echo "  - seed     : Run database seed only"
        echo "  - studio   : Run Prisma Studio"
        exit 1
        ;;
esac
