# LangFlow Setup Guide

This repository contains a Docker Compose setup for running Langflow with Ollama and Qdrant.
- clone the repository and rename the .env.example to .env
- Install Docker and have it running
- Go to the root directory and execute the command ```docker compose up -d```
- Wait until everything is composed, installed and started up. The containers themselves also have to install dependencies, so even after every container is started up it takes some time after they are ready.
- Open the Frontend Container via the Docker UI

## Services & Access URLs

### For Accessing Services from Your Host Machine

| Service               | URL                             | Purpose |
|-----------------------|---------------------------------|---------|
| Langflow UI           | http://localhost:7860           | Main interface for building LLM workflows |
| Ollama API            | http://localhost:11434          | LLM hosting service API endpoint |
| Ollama Model Overview | http://localhost:11434/api/tags | LLM hosting service API endpoint |
| Qdrant Dashboard      | http://localhost:6333/dashboard | Vector database dashboard |
| Qdrant API            | http://localhost:6333           | Vector database API endpoint |

### For Container-to-Container Communication

When configuring services within Langflow to talk to each other:

| Service | Internal URL                                           | Notes |
|---------|--------------------------------------------------------|-------|
| Ollama | http://ollama:11434, http://host.docker.internal:11434 | Used by Langflow to send requests to Ollama |
| Qdrant | http://qdrant:6333, http://host.docker.internal:6333   | Used by Langflow to connect to Qdrant |
