#!/usr/bin/env bash

#===============================================================================
# WELTHERRBLICK - Deploy to host-node-01
#===============================================================================

set -e

# Configuration
REMOTE_HOST="achildrenmile@host-node-01"
REMOTE_DIR="/home/achildrenmile/apps/weltherrblick"
CONTAINER_NAME="weltherrblick"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

# Get project root (directory where this script lives)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Sync files to remote
sync() {
    log_info "Syncing files to ${REMOTE_HOST}:${REMOTE_DIR}..."
    ssh "${REMOTE_HOST}" "mkdir -p ${REMOTE_DIR}"
    rsync -avz --delete \
        --exclude='node_modules' \
        --exclude='dist' \
        --exclude='.git' \
        --exclude='.claude' \
        --exclude='.env' \
        "${SCRIPT_DIR}/" "${REMOTE_HOST}:${REMOTE_DIR}/"
    log_success "Files synced."
}

# Build on remote
build() {
    log_info "Building Docker image on ${REMOTE_HOST}..."
    ssh "${REMOTE_HOST}" "cd ${REMOTE_DIR} && docker compose build"
    log_success "Docker image built."
}

# Start on remote
start() {
    log_info "Starting container..."
    ssh "${REMOTE_HOST}" "cd ${REMOTE_DIR} && docker compose up -d"
    log_success "Container started."
}

# Stop on remote
stop() {
    log_info "Stopping container..."
    ssh "${REMOTE_HOST}" "cd ${REMOTE_DIR} && docker compose stop"
    log_success "Container stopped."
}

# Restart on remote
restart() {
    log_info "Restarting container..."
    ssh "${REMOTE_HOST}" "cd ${REMOTE_DIR} && docker compose restart"
    log_success "Container restarted."
}

# Show status
status() {
    echo ""
    log_info "Container status on ${REMOTE_HOST}:"
    echo "----------------------------------------"
    ssh "${REMOTE_HOST}" "docker ps --filter 'name=${CONTAINER_NAME}' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
    echo ""
}

# Show logs
logs() {
    ssh "${REMOTE_HOST}" "cd ${REMOTE_DIR} && docker compose logs -f"
}

# Full deploy: sync, build, start
deploy() {
    echo ""
    echo "=========================================="
    echo "  WELTHERRBLICK - Deploy to host-node-01"
    echo "=========================================="
    echo ""

    sync
    build
    start
    status

    echo "=========================================="
    log_success "Deployment completed! https://weltherrblick.oeradio.at"
    echo "=========================================="
}

# Help
show_help() {
    echo ""
    echo "WELTHERRBLICK - Deployment Script"
    echo ""
    echo "Usage: ./deploy.sh [command]"
    echo ""
    echo "Commands:"
    echo "  deploy    Full deployment (default) - sync, build, start"
    echo "  sync      Sync files to remote only"
    echo "  build     Build Docker image on remote"
    echo "  start     Start the container"
    echo "  stop      Stop the container"
    echo "  restart   Restart the container"
    echo "  status    Show container status"
    echo "  logs      Show container logs (follow mode)"
    echo "  help      Show this help message"
    echo ""
}

case "${1:-deploy}" in
    deploy)  deploy ;;
    sync)    sync ;;
    build)   sync && build ;;
    start)   start && status ;;
    stop)    stop ;;
    restart) restart && status ;;
    status)  status ;;
    logs)    logs ;;
    help|--help|-h) show_help ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
