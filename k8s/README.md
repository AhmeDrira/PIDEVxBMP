# Kubernetes Manifests for PIDEVxBMP

Ce dossier contient les manifests Kubernetes sans aucun secret versionne.

## Fichiers

- `namespace.yaml` : namespace `pidev-prod`
- `storage.yaml` : PV/PVC NFS pour les uploads
- `backend-deployment.yaml` : deployment backend
- `backend-service.yaml` : service backend
- `frontend-deployment.yaml` : deployment frontend
- `frontend-service.yaml` : service frontend
- `ingress.yaml` : routage HTTP vers frontend/backend

## Secrets

Les secrets ne sont pas stockes dans le repository.
Ils doivent etre crees directement dans le cluster avec `kubectl` ou via Jenkins.

Exemples :

```bash
kubectl create namespace pidev-prod
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/storage.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml
kubectl apply -f k8s/ingress.yaml
```

Le secret `backend-secrets` et le secret Docker Registry `dockerhub-creds` doivent exister dans le namespace `pidev-prod` avant le deploiement.
