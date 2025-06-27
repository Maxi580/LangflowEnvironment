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

RUN . .venv/bin/activate && uv pip install \
    psycopg \
    psycopg-binary \
    psycopg-pool \
    psycopg2-binary

RUN . .venv/bin/activate && uv pip install langflow -U


COPY google_generative_ai.py /app/.venv/lib/python3.11/site-packages/langflow/components/models/google_generative_ai.py

EXPOSE ${LANGFLOW_PORT:-7860}

CMD ["/bin/bash", "-c", "source .venv/bin/activate && uv run langflow run"]