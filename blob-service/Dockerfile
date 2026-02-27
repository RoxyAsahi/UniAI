FROM python:3.10-slim-buster

WORKDIR /app

COPY requirements.txt .

RUN apt-get update && \
    apt-get install -y git && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
CMD ["python", "run.py"]
