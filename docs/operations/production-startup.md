# Production startup and migration order

Production uses one backend replica. Run migration as a separate one-shot job from the same backend image and production environment:

```sh
bun run db:migrate
```

Start backend only after that job exits successfully:

```sh
bun run start
```

The backend image does not migrate on startup. This prevents concurrent replicas from racing migrations and makes migration failure block traffic admission. Local development may keep explicit `NODE_ENV=development` defaults in `.env`; production must provide real secrets and HTTPS public URLs. PostgreSQL stays private to the compose network with no host port mapping.

Deployment order: configure secrets and URLs, run migration job, verify `/health` and `/ready`, start one backend replica, then start frontend and route HTTPS traffic only to ready backend instances.
