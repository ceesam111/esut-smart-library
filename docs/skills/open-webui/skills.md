# Open WebUI Deployment Skill

Use this note when removing or rebuilding Open WebUI on a Coolify VPS.

## What To Capture Before Removal

- Coolify resource name.
- Image tag or compose file.
- Domains and proxy routes.
- Admin credentials ownership.
- Environment variables.
- Model/API provider keys.
- Database or local SQLite path.
- Docker volumes, especially `/app/backend/data` or equivalent.
- Any connected Ollama/OpenAI-compatible endpoints.

## Safe Removal Steps

1. Confirm Open WebUI is not used by production workflows.
2. Export environment variables and provider configuration.
3. Back up the Open WebUI data volume.
4. Back up the database if it uses Postgres or another external DB.
5. Stop the resource in Coolify.
6. Check that no other app depends on its network, Ollama endpoint, or API keys.
7. Delete the resource in Coolify.
8. Delete unused volumes only after backup verification.
9. Remove unused proxy routes/domains.
10. Prune unused Docker images/build cache conservatively.

## Rebuild Checklist

1. Deploy Open WebUI from the pinned image/version.
2. Restore data volume or database.
3. Reapply provider API settings.
4. Attach domain and SSL.
5. Confirm admin login.
6. Confirm chat completion with the configured provider.
7. Confirm uploads, embeddings, or RAG features if previously enabled.

## Mistakes To Avoid

- Do not lose the data volume; it can contain users, settings, and chat history.
- Do not expose provider API keys in public build args.
- Do not expose Open WebUI publicly without authentication.
- Do not assume removing Open WebUI removes Ollama or model caches.
