# LangFlow Setup Guide

This repository contains a Docker Compose setup for running Langflow with Ollama and Qdrant.

## Services & Access URLs

### For Accessing Services from Your Host Machine

| Service | URL | Purpose |
|---------|-----|---------|
| Langflow UI | http://localhost:7860 | Main interface for building LLM workflows |
| Ollama API | http://localhost:11434 | LLM hosting service API endpoint |
| Qdrant Dashboard | http://localhost:6333/dashboard | Vector database dashboard |
| Qdrant API | http://localhost:6333 | Vector database API endpoint |

### For Container-to-Container Communication

When configuring services within Langflow to talk to each other:

| Service | Internal URL                                                                        | Notes |
|---------|-------------------------------------------------------------------------------------|-------|
| Ollama | http://host.docker.internal:11434, http://ollama.local:11434 or http://ollama:11434 | Used by Langflow to send requests to Ollama |
| Qdrant | http://host.docker.internal:6333, http://qdrant.local:6333 or http://qdrant:6333   | Used by Langflow to connect to Qdrant |