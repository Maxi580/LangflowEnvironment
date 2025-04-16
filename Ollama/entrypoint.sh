#!/bin/bash
set -e

ollama serve &
OLLAMA_PID=$!

echo "Waiting for Ollama to start..."

for i in $(seq 1 30); do
  if curl -s http://localhost:11434/api/tags > /dev/null; then
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

MODELS=("nomic-embed-text")
INSTALLED_MODELS=$(ollama list)

for model in "${MODELS[@]}"; do
  if echo "$INSTALLED_MODELS" | grep -q "$model"; then
    echo "Model $model already installed, skipping..."
  else
    echo "Pulling model: $model..."
    ollama pull $model || echo "Warning: Failed to pull $model, continuing anyway"
    echo "Successfully pulled $model"
  fi
done

echo "Embedding Model setup complete!"

wait $OLLAMA_PID