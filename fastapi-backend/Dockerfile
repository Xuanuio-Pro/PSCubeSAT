FROM docker:cli AS docker-cli
FROM python:3.12-slim

WORKDIR /app

# Compiler orchestration uses the official CLI, never host PlatformIO.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker

# Cài Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8000

# Khởi động server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--proxy-headers"]
