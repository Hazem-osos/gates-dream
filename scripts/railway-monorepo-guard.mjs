console.error(`
Railway build rejected at monorepo root.

Set the service Root Directory to gates-backend or gates-web in Railway,
or deploy from CLI:

  cd gates-backend && npm run railway:deploy:workers
  cd gates-backend && npm run railway:deploy:backend
  cd gates-web && railway up --service gates-web --path-as-root .
`);
process.exit(1);
