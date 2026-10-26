#!/bin/bash
# Instala a CLI do graphify em sessões novas (o contêiner da nuvem começa sem ela).
# Versão fixada para o grafo versionado em graphify-out/ continuar compatível.
set -euo pipefail
if [ -x /root/.local/bin/graphify ] || command -v graphify >/dev/null 2>&1; then
  exit 0
fi
uv tool install "graphifyy[sql]==0.9.95" >/dev/null 2>&1 || true
