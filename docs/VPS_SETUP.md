# VPS Setup

This runbook prepares a fresh Ubuntu VPS for the first production deployment of the active marketplace stack.

## Recommended server

- Recommended: `8 vCPU`, `16 GB RAM`, `200 GB NVMe`
- Minimum: `4 vCPU`, `8 GB RAM`, `100 GB`
- OS: Ubuntu `22.04 LTS` or `24.04 LTS`

## Required software

- Docker Engine
- Docker Compose plugin
- Git
- UFW firewall

## 1. Create the deploy user

```bash
sudo adduser deploy
sudo usermod -aG sudo deploy
```

Add the user to the Docker group after Docker installation:

```bash
sudo usermod -aG docker deploy
```

## 2. Add SSH key access

```bash
sudo mkdir -p /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo nano /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
```

## 3. Disable password login when safe

Only do this after key login is confirmed:

```bash
sudo nano /etc/ssh/sshd_config
```

Recommended settings:

- `PasswordAuthentication no`
- `PubkeyAuthentication yes`
- `PermitRootLogin no`

Reload SSH:

```bash
sudo systemctl reload ssh
```

## 4. Configure firewall

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Do not expose these ports publicly:

- PostgreSQL `5432`
- Redis `6379`
- MinIO `9000`
- MinIO console `9001`
- backend `3001`
- ai-service `8000`

## 5. Install Docker and Compose plugin

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin git
sudo systemctl enable docker
sudo systemctl start docker
docker version
docker compose version
```

## 6. Create the application directory

```bash
sudo mkdir -p /opt/trawberry-ai-commerce
sudo chown -R deploy:deploy /opt/trawberry-ai-commerce
```

## 7. Clone the repository

```bash
cd /opt
git clone https://github.com/TruongTuanDev/trawberry-ai-commerce.git
cd /opt/trawberry-ai-commerce
```

## 8. Prepare production env

```bash
cp infra/.env.production.example infra/.env.production
nano infra/.env.production
```

Fill in:

- domain URLs
- JWT secrets
- database credentials
- MinIO credentials
- storage bucket values
- bootstrap admin credentials if used

Do not commit `infra/.env.production`.

## 9. DNS preparation

Create these records:

- `@` -> `VPS_IP`
- `www` -> `VPS_IP` optional
- `api` -> `VPS_IP`
- `storage` -> `VPS_IP` if MinIO public access is used

Verify propagation:

```bash
nslookup yourdomain.ru
nslookup api.yourdomain.ru
nslookup storage.yourdomain.ru
```

## 10. HTTPS preparation

The current repo nginx config is HTTP-only. Public production still needs HTTPS termination before live traffic.

Primary documented path:

- Nginx container for app routing
- Certbot on host for certificate issuance
- mount or copy certificate files into the containerized nginx setup as part of operator setup

Alternatives:

- Caddy for automatic TLS
- Cloudflare proxy plus origin certificate

## 11. First production deploy

Validate the compose file first:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production config
```

If using GHCR private images:

```bash
echo TOKEN | docker login ghcr.io -u USER --password-stdin
```

Start the stack:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production up -d
```

Initialize Prisma:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production exec backend-nest npm run prisma:generate
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production exec backend-nest npm run prisma:db:push
```

Run smoke checks:

```bash
./infra/scripts/smoke-production.sh infra/.env.production
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production ps
```

## 12. GitHub Actions deploy setup

GitHub UI path:

1. Repository
2. `Settings`
3. `Secrets and variables`
4. `Actions`
5. `New repository secret` or `New repository variable`

Required secrets:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- `VPS_APP_DIR`

Optional secrets:

- `VPS_PORT`
- `VPS_KNOWN_HOSTS`
- `GHCR_PAT`

Recommended variable:

- `DEPLOY_NEXT_PUBLIC_API_URL=https://api.yourdomain.ru`

If GitHub account restrictions still block checkout or runner execution, deployment workflows cannot run until GitHub restores account access.

## 13. Operator command set

Status:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production ps
```

Logs:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production logs -f backend-nest
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production logs -f frontend-next
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production logs -f ai-service
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production logs -f nginx
```

Restart one service:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production restart backend-nest
```

Manual update:

```bash
git pull
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production pull
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production up -d
```

Backup:

```bash
./infra/scripts/backup-postgres.sh infra/.env.production
```

Restore:

```bash
./infra/scripts/restore-postgres.sh infra/.env.production backups/file.sql
```

Rollback:

- set previous image SHA tags in `infra/.env.deploy`
- run `docker compose ... up -d`
- if schema changed incompatibly, restore the database from backup during a maintenance window
