#!/bin/bash
# Restaure tous les dashboards PIDEVxBMP dans Grafana
# Usage: ./restore-dashboards.sh

set -e

GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"
AUTH="${GRAFANA_AUTH:-admin:admin}"
DASHBOARDS_DIR="$HOME/PIDEVxBMP/k8s/grafana-dashboards"

echo "🔍 Vérification Grafana..."
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 -u "$AUTH" "$GRAFANA_URL/api/health" || echo "000")
if [ "$HTTP" != "200" ]; then
  echo "❌ Grafana non accessible (HTTP $HTTP)"
  exit 1
fi
echo "✅ Grafana OK"
echo ""

if [ ! -d "$DASHBOARDS_DIR" ]; then
  echo "❌ Dossier introuvable: $DASHBOARDS_DIR"
  exit 1
fi

count=0
for json_file in "$DASHBOARDS_DIR"/*.json; do
  [ -f "$json_file" ] || continue
  name=$(basename "$json_file")
  echo "📊 Importing $name..."

  # Construire le payload
  python3 -c "
import json, sys
with open('$json_file') as f:
    d = json.load(f)
d['id'] = None
with open('/tmp/restore-payload.json', 'w') as f:
    json.dump({'dashboard': d, 'overwrite': True, 'folderId': 0}, f)
"

  # Import
  result=$(curl -s -X POST -u "$AUTH" -H "Content-Type: application/json" \
    -d @/tmp/restore-payload.json "$GRAFANA_URL/api/dashboards/db")

  status=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','?'))" 2>/dev/null || echo "?")
  url=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('url',''))" 2>/dev/null || echo "")

  echo "  → $status: ${GRAFANA_URL}${url}"
  count=$((count + 1))
done

echo ""
echo "✅ $count dashboard(s) restauré(s)"
