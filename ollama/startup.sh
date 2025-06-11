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

DEFAULT_EMBEDDING_MODEL=${DEFAULT_EMBEDDING_MODEL:-nomic-embed-text}
DEFAULT_VISION_MODEL=${DEFAULT_VISION_MODEL:-moondream:latest}

echo "Required default models:"
echo "  Embedding: $DEFAULT_EMBEDDING_MODEL"
echo "  Vision: $DEFAULT_VISION_MODEL"

if [ -z "OLLAMA_CHAT_MODELS" ]; then
  echo "OLLAMA_CHAT_MODELS not set, using only required defaults"
  OLLAMA_CHAT_MODELS=""
else
  echo "Additional models from environment: OLLAMA_CHAT_MODELS"
fi

ALL_MODELS="$DEFAULT_EMBEDDING_MODEL,$DEFAULT_VISION_MODEL"
if [ -n "OLLAMA_CHAT_MODELS" ]; then
  ALL_MODELS="$ALL_MODELS,OLLAMA_CHAT_MODELS"
fi

echo "Complete model list: $ALL_MODELS"

IFS=',' read -ra MODELS <<< "$ALL_MODELS"

echo "Checking for existing models..."
INSTALLED_MODELS=$(ollama list 2>/dev/null || echo "")

for model in "${MODELS[@]}"; do
  model=$(echo "$model" | xargs)

  if [ -z "$model" ]; then
    continue
  fi

  if echo "$INSTALLED_MODELS" | grep -q "^$model"; then
    echo "✓ Model $model already installed, skipping..."
  else
    echo "⬇ Downloading model: $model..."
    if ollama pull $model; then
      echo "✓ Successfully downloaded $model"
    else
      echo "⚠ Warning: Failed to download $model, continuing anyway"
    fi
  fi
done

echo "Model setup complete! Available models:"
ollama list

touch /root/.ollama/models_initialized

echo "Ollama is ready with all models!"

wait $OLLAMA_PID