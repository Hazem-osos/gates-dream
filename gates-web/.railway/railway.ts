import { defineRailway, mysql, preserve, project, redis, service, volume } from "railway/iac";

export default defineRailway(() => {
  const MySQL = mysql("MySQL", { region: "europe-west4-drams3a" });
  MySQL.deploy = { startCommand: "docker-entrypoint.sh mysqld --innodb-use-native-aio=0 --disable-log-bin --performance_schema=0 --innodb-buffer-pool-size=1G --container-aware=ON --table-open-cache=16000 --table-open-cache-instances=4 --max-connections=80 --temptable-max-ram=256M --innodb-read-io-threads=4 --innodb-write-io-threads=4 --innodb-buffer-pool-instances=1 --innodb-page-cleaners=1 --innodb-purge-threads=1" };
  const Redis = redis("Redis", { region: "europe-west4-drams3a" });
  Redis.deploy = { startCommand: "/bin/sh -c \"rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH\"" };
  const redisVolume = volume("redis-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "europe-west4-drams3a", sizeMB: 5000 });
  const mysqlVolume = volume("mysql-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "europe-west4-drams3a", sizeMB: 5000 });
  const gatesWorkers = service("gates-workers", {
    replicas: { "europe-west4-drams3a": 1 },
    env: { ALLOW_PROD_SEED: preserve(), API_AUTH_MODE: preserve(), API_RATE_LIMIT_MAX: preserve(), AUTOMATION_INTERNAL_API_KEY: preserve(), CORS_ALLOW_RAILWAY: preserve(), DATABASE_URL: preserve(), ENCRYPTION_KEY: preserve(), FRONTEND_URL: preserve(), GATES_RUN_WORKERS: preserve(), JWT_DEV_SECRET: preserve(), KEYCLOAK_ENABLED: preserve(), MQTT_ENABLED: preserve(), N8N_EVENT_INTAKE_URL: preserve(), NODE_ENV: preserve(), OPENAI_API_KEY: preserve(), OPENAI_MODEL: preserve(), RAILPACK_BUILD_CMD: preserve(), RAILPACK_INSTALL_CMD: preserve(), RAILPACK_START_CMD: preserve(), REDIS_ENABLED: preserve(), REDIS_URL: preserve(), SEED_ON_BOOT: preserve() },
  });
  const gatesWeb = service("gates-web", {
    start: "npm run railway:start",
    healthcheck: "/health",
    healthcheckTimeout: 600,
    replicas: { "europe-west4-drams3a": 1 },
    env: { BACKEND_INTERNAL_URL: preserve(), BACKEND_PROXY_TARGET: preserve(), NEXT_PUBLIC_AUTH_LOGIN_PATH: preserve(), NEXT_PUBLIC_AUTH_MODE: preserve(), NEXT_PUBLIC_AUTH_REGISTER_PATH: preserve(), NODE_ENV: preserve() },
  });
  const gatesBackend = service("gates-backend", {
    start: "npm run railway:start",
    healthcheck: "/health/live",
    healthcheckTimeout: 600,
    replicas: { "europe-west4-drams3a": 1 },
    env: { ALLOW_PROD_SEED: preserve(), API_AUTH_MODE: preserve(), API_RATE_LIMIT_MAX: preserve(), AUTOMATION_INTERNAL_API_KEY: preserve(), CORS_ALLOW_RAILWAY: preserve(), DATABASE_URL: preserve(), ENCRYPTION_KEY: preserve(), FRONTEND_URL: preserve(), JWT_DEV_SECRET: preserve(), KEYCLOAK_ENABLED: preserve(), META_WEBHOOK_VERIFY_TOKEN: preserve(), MQTT_ENABLED: preserve(), NODE_ENV: preserve(), OPENAI_API_KEY: preserve(), OPENAI_MODEL: preserve(), PORT: preserve(), REDIS_ENABLED: preserve(), REDIS_URL: preserve(), SEED_ON_BOOT: preserve() },
  });

  return project("invigorating-exploration", {
    resources: [gatesWorkers, gatesWeb, MySQL, Redis, gatesBackend, redisVolume, mysqlVolume],
  });
});
