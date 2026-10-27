#!/bin/bash
# Script para exportar workflows desde el contenedor docker de n8n hacia la carpeta versionada n8n/workflows/

CONTAINER_NAME="meta_hackathon_n8n"
TARGET_DIR="./n8n/workflows"

mkdir -p "$TARGET_DIR"

echo "📦 Exportando workflows de n8n desde el contenedor $CONTAINER_NAME..."

# Exportar workflows usando n8n CLI dentro del contenedor
docker exec -u node "$CONTAINER_NAME" n8n export:workflow --all --output=/data/workflows/

echo "✅ Workflows exportados exitosamente en $TARGET_DIR"
