FROM python:3.12-slim

WORKDIR /app

# Cài system dependencies (PlatformIO + Docker CLI cần)
RUN apt-get update && apt-get install -y \
    git curl python3-pip \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

# Cài Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose port
EXPOSE 8000

# Khởi động server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
