#!/bin/bash
# Sirve una compilación web en local: tools/serve.sh <carpeta-dist> <puerto>
DIR=${1:-../expo/dist}; PORT=${2:-8770}
pkill -f "serve -s $DIR -l $PORT" 2>/dev/null
setsid nohup npx -y serve -s "$DIR" -l "$PORT" > /tmp/serve-$PORT.log 2>&1 < /dev/null &
for i in $(seq 1 20); do sleep 1; curl -s -o /dev/null localhost:$PORT && echo "listo en http://localhost:$PORT" && exit 0; done; echo "no arrancó"; exit 1
