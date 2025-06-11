FROM ollama/ollama:latest

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY startup.sh /startup.sh
RUN chmod +x /startup.sh

EXPOSE 11434

RUN mkdir -p /root/.ollama

ENV OLLAMA_HOST=0.0.0.0
ENV OLLAMA_PORT=11434

ENTRYPOINT ["/startup.sh"]