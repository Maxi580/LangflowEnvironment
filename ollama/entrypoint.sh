#!/bin/bash
set -e

OLLAMA_HOST=${OLLAMA_HOST:-0.0.0.0}
OLLAMA_PORT=${OLLAMA_PORT:-11434}

ollama serve &
OLLAMA_PID=$!

echo "Waiting for Ollama to start on ${OLLAMA_HOST}:${OLLAMA_PORT}..."

for i in $(seq 1 30); do
  if curl -s http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/tags > /dev/null; then
    echo "Ollama is ready!"
    break
  fi

  if [ $i -eq 30 ]; then
    echo "Timed out waiting for Ollama to start"
    exit 1
  fi

  echo "Waiting... ($i/30)"
  sleep 2
done


if [ -z "$OLLAMA_MODELS" ]; then
  echo "OLLAMA_MODELS not set, using default models: nomic-embed-text,tinyllama:1.1b"
  OLLAMA_MODELS="nomic-embed-text,tinyllama:1.1b"
else
  echo "Using models from environment: $OLLAMA_MODELS"
fi

IFS=',' read -ra MODELS <<< "$OLLAMA_MODELS"

INSTALLED_MODELS=$(ollama list)

for model in "${MODELS[@]}"; do
  model=$(echo "$model" | xargs)

  if [ -z "$model" ]; then
    continue
  fi

  if echo "$INSTALLED_MODELS" | grep -q "$model"; then
    echo "Model $model already installed, skipping..."
  else
    echo "Pulling model: $model..."
    ollama pull $model || echo "Warning: Failed to pull $model, continuing anyway"
    echo "Successfully pulled $model"
  fi
done

echo "Model setup complete!"

wait $OLLAMA_PID