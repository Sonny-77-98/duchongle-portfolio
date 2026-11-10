# duchongle.com — portfolio

My portfolio site, which links to my projects on their own subdomains (e.g. `lifecouture.duchongle.com`).
It's a static [Astro](https://astro.build) site, served by unprivileged nginx on a k3s cluster
running on Proxmox VMs. Cloudflare sits in front through a Cloudflare Tunnel.

```
Visitor ─HTTPS─> Cloudflare (DNS, TLS, cache, WAF)
                    │  Cloudflare Tunnel (outbound only — no open ports)
                    ▼
        k3s cluster on Proxmox VMs
          cloudflared (2 pods) ─> Traefik (bundled with k3s) ─┬─> portfolio      (duchongle.com)
                                                               ├─> lifecouture    (lifecouture.duchongle.com)
                                                               └─> next project   (*.duchongle.com)
```

## Editing content

| What | Where |
|---|---|
| Name, tagline, links, skills | `src/data/profile.ts` |
| Projects (one entry per card) | `src/data/projects.ts` |
| Screenshots, résumé PDF | `public/img/`, `public/` |
| Look and feel | `src/styles/global.css` |

## Local development

Requires Node ≥ 22.22 (`nvm install 24 && nvm use`).

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # outputs dist/
```

Test the production container:

```bash
docker build -t portfolio .
docker run --rm -p 8080:8080 portfolio   # http://localhost:8080
```

---

## Cluster setup (one-time)

### 1. k3s on Proxmox

Create 3 VMs (Ubuntu/Debian cloud image, ~2 vCPU / 4 GB RAM each), ideally one per Proxmox
node so a single host failure doesn't take the cluster down. Give them static IPs.

```bash
# first server (embedded etcd so you can add more servers later for HA)
curl -sfL https://get.k3s.io | sh -s - server --cluster-init
sudo cat /var/lib/rancher/k3s/server/node-token     # join token

# other servers (HA control plane) or agents
curl -sfL https://get.k3s.io | K3S_URL=https://<first-server-ip>:6443 K3S_TOKEN=<token> sh -s - server
#   ...or `sh -s - agent` for worker-only nodes
```

Copy `/etc/rancher/k3s/k3s.yaml` to your workstation as `~/.kube/config` (replace `127.0.0.1`
with the server IP) and check `kubectl get nodes`.

### 2. Cloudflare Tunnel (shared by every site)

Follow the steps at the top of [`deploy/cluster/cloudflared.yaml`](deploy/cluster/cloudflared.yaml), then:

```bash
kubectl apply -f deploy/cluster/traefik-config.yaml   # real visitor IPs reach apps
kubectl apply -f deploy/cluster/cloudflared.yaml
```

In Cloudflare:
- **SSL/TLS → Overview:** Full. The tunnel is encrypted end to end, so there's no origin certificate to manage.
- **Rules → Redirect Rules:** `www.duchongle.com/*` → `https://duchongle.com/${1}` (301).
- **SSL/TLS → Edge Certificates:** turn on *Always Use HTTPS*.
- Because the tunnel only dials out, you don't need any port forwarding on your router. Remove any old 80/443 forwards.

### 3. Container registry

CI pushes `ghcr.io/sonny-77-98/duchongle-portfolio`. After the first push, go to GitHub → your
profile → **Packages** → duchongle-portfolio → **Package settings** and set visibility to
**Public** so k3s can pull it without credentials.

### 4. Automated deploys (self-hosted runner)

The k3s API isn't reachable from GitHub's hosted runners, so deployments run on a runner inside your LAN:

1. Create a small VM or LXC on Proxmox. Install `kubectl` and copy a kubeconfig into it.
2. Repo → Settings → Actions → Runners → **New self-hosted runner**. Follow the steps and add the label `k3s`.
3. Repo → Settings → Secrets and variables → Actions → **Variables**: `DEPLOY_ENABLED = true`.

After that, every push to `main` builds the image, pushes it, and rolls it out (`.github/workflows/deploy.yml`).

Manual deploy from your workstation:

```bash
kubectl apply -k deploy/k8s
kubectl -n portfolio set image deployment/portfolio web=ghcr.io/sonny-77-98/duchongle-portfolio:<commit-sha>
kubectl -n portfolio rollout status deployment/portfolio
```

---

## Adding another project to the cluster

1. Containerize it and push the image to GHCR (copy this repo's workflow).
2. Give it a Deployment + Service + Ingress with `host: <name>.duchongle.com` (copy `deploy/k8s/`).
3. Add a public hostname `<name>.duchongle.com → http://traefik.kube-system.svc.cluster.local:80` in the tunnel.
4. Add a card to `src/data/projects.ts` in this repo.

Databases such as lifecouture's MySQL should run as a StatefulSet with a persistent volume, or as a
dedicated Proxmox VM/LXC that the app reaches over the LAN. Keep credentials in Kubernetes Secrets,
never in git.
