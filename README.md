# Setup Guide

## Requirements
- **Git**: To clone the repository (Url: [https://git-scm.com/downloads](https://git-scm.com/downloads))
- **WSL** (Windows Subsystem for Linux): Needed for Docker (Url: [https://learn.microsoft.com/en-us/windows/wsl/install](https://learn.microsoft.com/en-us/windows/wsl/install))
- **Docker**: To create the containers and run the system (Url: [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/))

## Setup

- The first step is to clone the repository with the command ``git clone https://github.com/Maxi580/LangflowEnvironment.git``
- After this a terminal must be opened in the project root directory. This is the path where the repository is cloned to
- In this path the command ``docker compose up -d`` must be executed while the docker engine is running
- The containers are automatically created this can take a while. Even if all containers are created they might still need to install dependecies. This can be checked when clicking on them in the Docker UI. If bugs are encountered a small wait could help
- Then if all is up and running the below commands help in accessing everything
 

## Services Access URLs

When the system is locally hosted the following URLs should redirect you to the corresponding service

| Service               | URL                             | Purpose                                   |
|-----------------------|---------------------------------|-------------------------------------------|
| Frontend              | http://localhost:3000/          | Main interface for the user (frontend)    |
| Langflow UI           | http://localhost:7860           | Main interface for building LLM workflows |
| Backend UI            | http://localhost:8000/docs      | Interface for the Backend                 |
| Ollama API            | http://localhost:11434          | LLM hosting service API endpoint          |
| Ollama Model Overview | http://localhost:11434/api/tags | LLM hosting service API endpoint          |
| Qdrant Dashboard      | http://localhost:6333/dashboard | Vector database dashboard                 |
| Qdrant API            | http://localhost:6333           | Vector database API endpoint              |

