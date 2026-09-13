import { healthChecker } from '../../shared/health/health-checker';
import prisma from '../../shared/database/prisma';

// Mock dependencies
jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
  },
}));

jest.mock('../../shared/cache/redis', () => ({
  redisClient: {
    getClient: jest.fn(() => ({
      ping: jest.fn(),
    })),
    isReady: jest.fn(() => true),
  },
}));

jest.mock('axios', () => ({
  default: {
    get: jest.fn(),
  },
}));

describe('HealthChecker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkDatabase', () => {
    it('should return healthy when database is accessible', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

      const result = await healthChecker['checkDatabase']();

      expect(result.status).toBe('healthy');
      expect(result.responseTime).toBeDefined();
    });

    it('should return unhealthy when database is not accessible', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      const result = await healthChecker['checkDatabase']();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBeDefined();
    });
  });

  describe('livenessCheck', () => {
    it('should return true when database is accessible', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

      const result = await healthChecker.livenessCheck();

      expect(result).toBe(true);
    });

    it('should return false when database is not accessible', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      const result = await healthChecker.livenessCheck();

      expect(result).toBe(false);
    });
  });
});

