import mqtt from 'mqtt';
import { logger } from '../../../shared/logger';
import { prisma } from '../../../shared/database/prisma';

/**
 * Sensor Subscriber Service
 * Subscribes to MQTT topics for real-time sensor data (IoT)
 */

export interface SensorData {
  companyId: string;
  machineId: string;
  sensorType: string;
  value: number;
  unit: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SensorSubscription {
  topic: string;
  companyId: string;
  machineId: string;
  sensorType: string;
  handler: (data: SensorData) => void;
}

/**
 * Sensor Subscriber Service
 * Manages MQTT subscriptions for manufacturing IoT sensors
 */
export class SensorSubscriberService {
  private client: mqtt.MqttClient | null = null;
  private subscriptions: Map<string, SensorSubscription> = new Map();
  private isConnected = false;

  /**
   * Initialize MQTT client
   */
  initialize(): void {
    const mqttUrl = process.env.MQTT_URL || 'mqtt://localhost:1883';
    const options: mqtt.IClientOptions = {
      clientId: `gates-manufacturing-${Date.now()}`,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
    };

    if (process.env.MQTT_USERNAME && process.env.MQTT_PASSWORD) {
      options.username = process.env.MQTT_USERNAME;
      options.password = process.env.MQTT_PASSWORD;
    }

    this.client = mqtt.connect(mqttUrl, options);

    this.client.on('connect', () => {
      logger.info('MQTT client connected');
      this.isConnected = true;

      // Resubscribe to all topics
      this.subscriptions.forEach((subscription) => {
        this.subscribeToTopic(subscription.topic);
      });
    });

    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message.toString());
    });

    this.client.on('error', (error) => {
      logger.error({ error }, 'MQTT client error');
      this.isConnected = false;
    });

    this.client.on('close', () => {
      logger.warn('MQTT client disconnected');
      this.isConnected = false;
    });
  }

  /**
   * Subscribe to sensor topic.
   *
   * `companyId` never travels over the physical MQTT topic (devices publish to
   * `factory/{machineId}/{sensorType}` regardless of tenant) — it is tracked purely
   * app-side so incoming readings are attributed and persisted per tenant. The
   * subscription registry is keyed by `companyId:topic` rather than bare `topic` so two
   * different companies subscribing to the same machine/sensor pair don't silently
   * overwrite each other's handler.
   */
  subscribe(
    companyId: string,
    machineId: string,
    sensorType: string,
    handler: (data: SensorData) => void
  ): void {
    const topic = `factory/${machineId}/${sensorType}`;
    const subscriptionKey = `${companyId}:${topic}`;
    const subscription: SensorSubscription = {
      topic,
      companyId,
      machineId,
      sensorType,
      handler,
    };

    this.subscriptions.set(subscriptionKey, subscription);
    this.subscribeToTopic(topic);

    logger.info({ topic, companyId, machineId, sensorType }, 'Subscribed to sensor');
  }

  /**
   * Subscribe to MQTT topic
   */
  private subscribeToTopic(topic: string): void {
    if (!this.client || !this.isConnected) {
      return;
    }

    this.client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) {
        logger.error({ err, topic }, 'Error subscribing to topic');
      } else {
        logger.debug({ topic }, 'Subscribed to MQTT topic');
      }
    });
  }

  /**
   * Handle incoming MQTT message. A single physical topic can now have subscriptions
   * from more than one company (see `subscribe()`), so every matching subscription gets
   * its own stored/tagged reading rather than picking just one by topic.
   */
  private handleMessage(topic: string, message: string): void {
    try {
      const matchingSubscriptions = Array.from(this.subscriptions.values()).filter(
        (s) => s.topic === topic
      );

      if (matchingSubscriptions.length === 0) {
        logger.warn({ topic }, 'No subscription found for topic');
        return;
      }

      const data = JSON.parse(message);

      for (const subscription of matchingSubscriptions) {
        const sensorData: SensorData = {
          companyId: subscription.companyId,
          machineId: subscription.machineId,
          sensorType: subscription.sensorType,
          value: data.value || data,
          unit: data.unit || '',
          timestamp: new Date(data.timestamp || Date.now()),
          metadata: data.metadata,
        };

        // Store in time-series database (TSDB)
        // TSDB storage is implemented in storeSensorData() method below
        this.storeSensorData(sensorData);

        // Call handler
        subscription.handler(sensorData);

        logger.debug(
          { topic, companyId: sensorData.companyId, machineId: sensorData.machineId, value: sensorData.value },
          'Sensor data received'
        );
      }
    } catch (error) {
      logger.error({ error, topic, message }, 'Error handling sensor message');
    }
  }

  /**
   * Store sensor data in time-series database.
   *
   * Column names are camelCase (`companyId`, `machineId`, `sensorType`, `createdAt`) to
   * match the live table and the `SensorReading` Prisma model — this table has no `@map`
   * on any field, so Prisma's own column names are camelCase, not the snake_case this raw
   * SQL originally (and incorrectly) assumed.
   */
  private async storeSensorData(data: SensorData): Promise<void> {
    try {
      // Use raw SQL for time-series data insertion
      // This provides better performance for high-frequency sensor data
      await prisma.$executeRaw`
        INSERT INTO sensor_readings (
          id,
          companyId,
          machineId,
          sensorType,
          value,
          unit,
          timestamp,
          metadata,
          createdAt
        ) VALUES (
          UUID(),
          ${data.companyId},
          ${data.machineId},
          ${data.sensorType},
          ${data.value},
          ${data.unit || null},
          ${data.timestamp},
          ${data.metadata ? JSON.stringify(data.metadata) : null},
          NOW(3)
        )
      `;

      logger.debug(
        {
          companyId: data.companyId,
          machineId: data.machineId,
          sensorType: data.sensorType,
          value: data.value,
        },
        'Sensor data stored in TSDB'
      );
    } catch (error: any) {
      // If table doesn't exist, create it (for development)
      if (error.code === 'ER_NO_SUCH_TABLE' || error.message?.includes('doesn\'t exist')) {
        logger.warn('Sensor readings table not found, creating it...');
        await this.createSensorReadingsTable();
        // Retry insertion
        await this.storeSensorData(data);
      } else {
        logger.error(
          {
            error,
            machineId: data.machineId,
            sensorType: data.sensorType,
          },
          'Error storing sensor data'
        );
      }
    }
  }

  /**
   * Create sensor readings table if it doesn't exist
   * This is a fallback for development - production should use migrations
   */
  private async createSensorReadingsTable(): Promise<void> {
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS sensor_readings (
          id VARCHAR(36) PRIMARY KEY,
          companyId CHAR(36) NULL,
          machineId VARCHAR(255) NOT NULL,
          sensorType VARCHAR(255) NOT NULL,
          value DECIMAL(15, 4) NOT NULL,
          unit VARCHAR(50),
          timestamp DATETIME(3) NOT NULL,
          metadata JSON,
          createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
          INDEX idx_company_machine_sensor (companyId, machineId, sensorType),
          INDEX idx_timestamp (timestamp),
          INDEX idx_company_machine_timestamp (companyId, machineId, timestamp)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;
      logger.info('Sensor readings table created');
    } catch (error) {
      logger.error({ error }, 'Error creating sensor readings table');
      throw error;
    }
  }

  /**
   * Query sensor data from time-series database. `companyId` is mandatory and always
   * AND-ed into the raw SQL — this table is queried exclusively through raw SQL, so it
   * never goes through the Prisma tenant-scoping extension and must be filtered here.
   */
  async querySensorData(
    companyId: string,
    machineId: string,
    sensorType: string,
    fromDate: Date,
    toDate: Date,
    limit: number = 1000
  ): Promise<SensorData[]> {
    try {
      const results = await prisma.$queryRaw<Array<{
        id: string;
        companyId: string;
        machineId: string;
        sensorType: string;
        value: number;
        unit: string;
        timestamp: Date;
        metadata: string | null;
      }>>`
        SELECT 
          id,
          companyId,
          machineId,
          sensorType,
          value,
          unit,
          timestamp,
          metadata
        FROM sensor_readings
        WHERE companyId = ${companyId}
          AND machineId = ${machineId}
          AND sensorType = ${sensorType}
          AND timestamp >= ${fromDate}
          AND timestamp <= ${toDate}
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `;

      return results.map((row) => ({
        companyId: row.companyId,
        machineId: row.machineId,
        sensorType: row.sensorType,
        value: Number(row.value),
        unit: row.unit || '',
        timestamp: row.timestamp,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));
    } catch (error) {
      logger.error(
        { error, companyId, machineId, sensorType, fromDate, toDate },
        'Error querying sensor data'
      );
      throw error;
    }
  }

  /**
   * Get latest sensor reading (tenant-scoped — see `querySensorData`).
   */
  async getLatestReading(companyId: string, machineId: string, sensorType: string): Promise<SensorData | null> {
    try {
      const result = await prisma.$queryRaw<Array<{
        id: string;
        companyId: string;
        machineId: string;
        sensorType: string;
        value: number;
        unit: string;
        timestamp: Date;
        metadata: string | null;
      }>>`
        SELECT 
          id,
          companyId,
          machineId,
          sensorType,
          value,
          unit,
          timestamp,
          metadata
        FROM sensor_readings
        WHERE companyId = ${companyId}
          AND machineId = ${machineId}
          AND sensorType = ${sensorType}
        ORDER BY timestamp DESC
        LIMIT 1
      `;

      if (result.length === 0) {
        return null;
      }

      const row = result[0];
      return {
        companyId: row.companyId,
        machineId: row.machineId,
        sensorType: row.sensorType,
        value: Number(row.value),
        unit: row.unit || '',
        timestamp: row.timestamp,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      };
    } catch (error) {
      logger.error({ error, companyId, machineId, sensorType }, 'Error getting latest sensor reading');
      return null;
    }
  }

  /**
   * Aggregate sensor data (average, min, max, count)
   */
  async aggregateSensorData(
    companyId: string,
    machineId: string,
    sensorType: string,
    fromDate: Date,
    toDate: Date,
    interval: 'hour' | 'day' | 'week' | 'month' = 'hour'
  ): Promise<Array<{
    timestamp: Date;
    avg: number;
    min: number;
    max: number;
    count: number;
  }>> {
    try {
      // MySQL time grouping based on interval
      let dateFormat: string;
      switch (interval) {
        case 'hour':
          dateFormat = '%Y-%m-%d %H:00:00';
          break;
        case 'day':
          dateFormat = '%Y-%m-%d 00:00:00';
          break;
        case 'week':
          dateFormat = '%Y-%u';
          break;
        case 'month':
          dateFormat = '%Y-%m-01 00:00:00';
          break;
        default:
          dateFormat = '%Y-%m-%d %H:00:00';
      }

      const results = await prisma.$queryRaw<Array<{
        time_bucket: string;
        avg_value: number;
        min_value: number;
        max_value: number;
        count: number;
      }>>`
        SELECT 
          DATE_FORMAT(timestamp, ${dateFormat}) as time_bucket,
          AVG(value) as avg_value,
          MIN(value) as min_value,
          MAX(value) as max_value,
          COUNT(*) as count
        FROM sensor_readings
        WHERE companyId = ${companyId}
          AND machineId = ${machineId}
          AND sensorType = ${sensorType}
          AND timestamp >= ${fromDate}
          AND timestamp <= ${toDate}
        GROUP BY time_bucket
        ORDER BY time_bucket ASC
      `;

      return results.map((row) => ({
        timestamp: new Date(row.time_bucket),
        avg: Number(row.avg_value),
        min: Number(row.min_value),
        max: Number(row.max_value),
        count: Number(row.count),
      }));
    } catch (error) {
      logger.error(
        { error, companyId, machineId, sensorType, fromDate, toDate, interval },
        'Error aggregating sensor data'
      );
      throw error;
    }
  }

  /**
   * Unsubscribe from sensor
   */
  unsubscribe(companyId: string, machineId: string, sensorType: string): void {
    const topic = `factory/${machineId}/${sensorType}`;
    const subscriptionKey = `${companyId}:${topic}`;
    const subscription = this.subscriptions.get(subscriptionKey);

    if (subscription) {
      this.subscriptions.delete(subscriptionKey);
      // Only actually unsubscribe from the broker if no other company still needs this
      // physical topic.
      const stillNeeded = Array.from(this.subscriptions.values()).some((s) => s.topic === topic);
      if (!stillNeeded && this.client && this.isConnected) {
        this.client.unsubscribe(topic);
      }
      logger.info({ topic, companyId }, 'Unsubscribed from sensor');
    }
  }

  /**
   * Disconnect MQTT client
   */
  disconnect(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.isConnected = false;
      logger.info('MQTT client disconnected');
    }
  }

  /**
   * Check if connected
   */
  isReady(): boolean {
    return this.isConnected && this.client?.connected === true;
  }
}

export const sensorSubscriberService = new SensorSubscriberService();

// Wave 6 fix: this module-load side effect used to unconditionally connect
// an MQTT client (`!== 'false'` defaults to enabled when unset, the same
// permissive-default bug fixed in `env.ts`'s `MQTT_ENABLED` parsing), on top
// of `index.ts` calling `sensorSubscriberService.initialize()` again when
// `env.MQTT_ENABLED` is true — two independent MQTT connections, and one of
// them ignoring the app's actual `MQTT_ENABLED` setting entirely.
// Initialization now happens exactly once, from `index.ts`, gated on the
// validated `env.MQTT_ENABLED`.
