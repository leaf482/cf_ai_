# Contents Ranking - System Automation Makefile
# Docker-first: all services run in containers.

.PHONY: up down restart logs status clean help deps up-host

help:
	@echo "Contents Ranking - Available targets:"
	@echo "  make up       - Start all services (Docker)"
	@echo "  make down     - Stop and remove all containers"
	@echo "  make restart  - down + up"
	@echo "  make logs     - Follow all container logs"
	@echo "  make status   - Show container status"
	@echo "  make clean    - Remove volumes and unused images"
	@echo "  make deps     - Install deps for host-mode development"
	@echo "  make up-host  - Host-mode (optional, advanced)"
	@echo ""
	@echo "Docker-first: make up = docker compose up -d --build"

up:
	@echo "==> Starting all services (Docker)..."
	@docker compose up -d --build --scale go-worker=3
	@echo "==> Done. Dashboard: http://localhost:3002"
	@echo "==> Wait ~30s for Kafka/Redis to be ready."

down:
	@echo "==> Stopping and removing all containers..."
	@docker compose down
	@echo "==> Done."

restart: down up
	@echo "==> Restart complete."

logs:
	@echo "==> Following logs (Ctrl+C to exit)..."
	@docker compose logs -f

status:
	@echo "==> Container status:"
	@docker compose ps -a

clean:
	@echo "==> Stopping containers..."
	@-docker compose down -v
	@echo "==> Removing unused volumes..."
	@docker volume prune -f
	@echo "==> Removing dangling images..."
	@docker image prune -f
	@echo "==> Clean complete."

deps:
	@echo "==> Installing dependencies for host-mode development..."
	@go mod download
	@cd simulation-service && npm install
	@cd dashboard && npm install
	@echo "==> Done."

# Optional: run API, simulation, dashboard on host (requires Docker for Kafka, Redis, workers)
up-host:
	@echo "==> Starting Docker (Kafka, Redis, Workers)..."
	@docker compose up -d --scale go-worker=3 kafka redis go-worker prometheus grafana kafka-exporter redis-exporter
	@echo "==> Run manually: go run cmd/api/main.go, cd simulation-service && npm run start:dev, cd dashboard && npm run dev"
