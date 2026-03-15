FROM python:3.12-slim

# Create a non-root user
RUN addgroup --system appuser && adduser --system --group appuser

# Install system dependencies if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Set ownership
RUN chown -R appuser:appuser /app

# Allow dynamic port assignment for Cloud Run
ENV PORT=8080

EXPOSE $PORT

USER appuser

# Run the application
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
