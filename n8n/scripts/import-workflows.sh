#!/bin/bash
# Script para importar workflows versionados hacia el contenedor docker de n8n

CONTAINER_NAME="meta_hackathon_n8n"

echo "📥 Importando workflows hacia n8n desde /data/workflows..."

docker exec -u node "$CONTAINER_NAME" n8n import:workflow --input=/data/workflows/ai_finance_bot_workflow.json

echo "✅ Workflows importados exitosamente en n8n."
