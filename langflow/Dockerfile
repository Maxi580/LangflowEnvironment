FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN pip install uv
RUN uv --version
RUN uv venv

RUN . .venv/bin/activate && uv pip install langflow -U

ENV LANGFLOW_HOST=${LANGFLOW_HOST:-0.0.0.0}
ENV LANGFLOW_PORT=${LANGFLOW_PORT:-7860}
ENV LANGFLOW_AUTO_RELOAD=${LANGFLOW_AUTO_RELOAD:-true}
ENV LANGFLOW_DEV=${LANGFLOW_DEV:-false}
ENV LANGFLOW_DATABASE_URL=${LANGFLOW_DATABASE_URL:-sqlite:////root/.langflow/langflow.db}
ENV LANGFLOW_CACHE=${LANGFLOW_CACHE:-true}
ENV LANGFLOW_EMBEDDING_MODEL_ENDPOINT=${OLLAMA_INTERNAL_URL:-http://ollama:11434}
ENV LANGFLOW_ALLOWED_ORIGINS=${LANGFLOW_ALLOWED_ORIGINS:-*}
ENV LANGFLOW_REMOVE_EXAMPLE_FLOWS=${LANGFLOW_REMOVE_EXAMPLE_FLOWS:-true}

EXPOSE ${LANGFLOW_PORT:-7860}

CMD ["/bin/bash", "-c", "source .venv/bin/activate && uv run langflow run"]