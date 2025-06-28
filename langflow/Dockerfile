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

COPY requirements.txt /app/requirements.txt
RUN . .venv/bin/activate && uv pip install -r requirements.txt

RUN mkdir -p /app/custom_components
COPY components/ /app/custom_components/

COPY google_generative_ai.py /app/.venv/lib/python3.11/site-packages/langflow/components/models/google_generative_ai.py

ENV LANGFLOW_COMPONENTS_PATH=/app/custom_components

EXPOSE ${LANGFLOW_PORT:-7860}

CMD ["/bin/bash", "-c", "source .venv/bin/activate && uv run langflow run --components-path /app/custom_components"]