/**
 * Jest test setup file
 * Runs before all tests
 */
import { config as loadEnv } from 'dotenv';

loadEnv();

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'mysql://test:test@localhost:3306/test_db';
process.env.REDIS_ENABLED = 'false';
process.env.KEYCLOAK_ENABLED = 'false';
process.env.MQTT_ENABLED = 'false';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
process.env.CORS_ORIGINS =
  process.env.CORS_ORIGINS || 'https://app.example.com,https://staging.example.com';

// Increase timeout for integration tests
jest.setTimeout(30000);

