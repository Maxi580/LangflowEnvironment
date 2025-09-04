# Setup Guide

## Requirements
- **Git**: To clone the repository ([Download Git](https://git-scm.com/downloads))
- **WSL2** (Windows Subsystem for Linux): Required for containerization on Windows ([Install WSL](https://learn.microsoft.com/en-us/windows/wsl/install))

## Choose Your Container Engine

You can run this project with either **Docker** or **Podman**. Both approaches are documented below:

---

## Option A: Docker Setup

### Requirements
- **Docker Desktop**: Container platform ([Download Docker Desktop](https://www.docker.com/products/docker-desktop/))

### Installation
1. **Install Docker Desktop**
   - Download from: [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
   - Follow the installation wizard
   - Docker Desktop will automatically set up WSL2 if needed

2. **Start Docker Desktop**
   - Launch Docker Desktop and ensure it's running
   - You should see the Docker icon in your system tray

### Setup and Run
1. **Clone Repository**
   ```bash
   git clone https://github.com/Maxi580/LangflowEnvironment.git
   cd LangflowEnvironment
   ```
   
2. **Configure Environment**
   - Rename .env.example to .env
   - Adjust environment variables (API keys, ports, etc.)
   - Configure Gemini API key for image description or set to use local LLM

3. **Build Run**
  ```bash
  # Build and start all services
  docker compose up -d
    
  # View logs
  docker compose logs -f
    
  # Stop services
  docker compose down
  ```

##  Option B: Podman Setup

### Requirements

- **Python 3.8+**: For running podman-compose [https://www.python.org/downloads/](https://www.python.org/downloads/)
- **Podman**: Container engine alternative to Docker [https://podman.io/docs/installation](https://podman.io/docs/installation)

### Installation

1. **Install Podman**
   - Download from: [https://podman.io/docs/installation](https://podman.io/docs/installation)
   - For Windows download the **podman-5.6.0-setup.exe** Installer from the Podman GitHub Release Page [https://github.com/containers/podman/releases](https://github.com/containers/podman/releases)
2. **Initialize Podman Machine**
    ```bash
    # Initialize the Podman machine
    podman machine init
    
    # Start the machine
    podman machine start
    ```
3. **Install podman-compose**
    ```bash
    # Install podman-compose via pip
    pip install podman-compose
    ```

### Setup and Run

1. **Clone the Repository**
    ```bash
    git clone https://github.com/Maxi580/LangflowEnvironment.git
    cd LangflowEnvironment
    ```
2. **Configure Environment**
   - Rename .env.example to .env
   - Adjust environment variables (API keys, ports, etc.)
   - Configure Gemini API key for image description or set to use local LLM
   
3. **Build and Run**
   ```bash
    # Build and start all services
    python -m podman_compose up -d --build
    
    # View logs
    python -m podman_compose logs -f
    
    # Stop services
    python -m podman_compose down
    ```

## Post-Setup (Both Options)

### Wait for Services
- Container creation may take several minutes
- Services need additional time to install dependencies after containers start
- Check container logs if issues occur

### Default Credentials
- **Username**: admin
- **Password**: admin
- ⚠️ **Change these credentials** after first login for security

## Services Access URLs

When running locally, access services at these URLs:

| Service               | URL                             | Purpose                                   |
|-----------------------|---------------------------------|-------------------------------------------|
| Frontend              | http://localhost:3000/          | Main user interface                       |
| Langflow UI           | http://localhost:7860           | LLM workflow builder                      |
| Backend API           | http://localhost:8000/docs      | Backend API documentation                 |
| Ollama API            | http://localhost:11434          | Local LLM service API                     |
| Ollama Models         | http://localhost:11434/api/tags | Available LLM models                      |
| Qdrant Dashboard      | http://localhost:6333/dashboard | Vector database dashboard                 |
| Qdrant API            | http://localhost:6333           | Vector database API                       |
| Adminer (DB Admin)    | http://localhost:8080           | Database administration interface         |

## Useful Commands

### Docker Commands
```bash
# Build and start services
docker compose up -d --build

# View logs
docker compose logs -f
docker compose logs [service-name]

# Stop services
docker compose down

# Check running containers
docker ps

# Access container shell
docker exec -it [container-name] /bin/sh

# Clean rebuild
docker compose down -v
docker system prune -af --volumes
docker compose up -d --build
```

### Podman Commands
```bash
# Build and start services
python -m podman_compose up -d --build

# View logs
python -m podman_compose logs -f
python -m podman_compose logs [service-name]

# Stop services
python -m podman_compose down

# Check running containers
podman ps

# Check Podman machine status
podman machine list

# Access container shell
podman exec -it [container-name] /bin/sh

# Clean rebuild
python -m podman_compose down -v
podman system prune -af --volumes
python -m podman_compose up -d --build
```

## Common Issues

### Docker Issues
- **Docker Desktop not starting**: Restart Docker Desktop, check WSL2 installation, or try running as administrator
- **"docker: command not found"**: Ensure Docker Desktop is running and restart your terminal
- **Port conflicts**: Check what's using the port with `netstat -ano | findstr :3000`

### Podman Issues
- **Permission denied for react-scripts**: Fixed in current Dockerfile with proper permissions
- **Podman machine not starting**: Stop and restart with `podman machine stop` then `podman machine start`
- **"podman-compose: command not found"**: Use `python -m podman_compose` instead

### General Issues
- **Services not responding**: Wait a few minutes for containers to fully start up
- **Frontend showing blank page**: Check container logs for startup errors
- **Database connection errors**: Ensure PostgreSQL container is healthy before other services start
- **Clean rebuild needed**: Use the clean rebuild commands above to start fresh

   
