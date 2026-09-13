import { prisma } from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

/**
 * Geospatial Service
 * Handles geospatial queries using MySQL-compatible Haversine formula
 * Note: Assumes properties table has latitude and longitude columns (DECIMAL)
 */

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface Property {
  id: string;
  name: string;
  location: GeoPoint;
  address: string;
  area: number; // in square meters
  price: number;
  companyId: string;
}

export interface NearbyPropertiesQuery {
  center: GeoPoint;
  radius: number; // in meters
  limit?: number;
  companyId?: string; // Required for MySQL (application-level filtering)
}

/**
 * Geospatial Service
 * Provides geospatial queries using Haversine formula (MySQL-compatible)
 */
export class GeospatialService {
  /**
   * Check if geospatial features are available
   * For MySQL, we always use Haversine formula
   */
  async checkGeospatialSupport(): Promise<boolean> {
    // MySQL always supports Haversine (application-level calculation)
    return true;
  }

  /**
   * Find properties within radius
   * Uses Haversine formula for MySQL compatibility
   * Note: Requires properties table with latitude and longitude columns
   */
  async findNearbyProperties(
    query: NearbyPropertiesQuery
  ): Promise<Property[]> {
    try {
      if (!query.companyId) {
        throw new Error('Company ID is required for tenant isolation');
      }

      // Haversine formula SQL for MySQL
      // Formula: a = sin²(Δφ/2) + cos φ1 ⋅ cos φ2 ⋅ sin²(Δλ/2)
      // c = 2 ⋅ atan2( √a, √(1−a) )
      // d = R ⋅ c
      // Where R = 6371000 meters (Earth radius)
      const centerLat = query.center.latitude;
      const centerLon = query.center.longitude;
      const radiusMeters = query.radius;
      const limit = query.limit || 50;

      // MySQL query using Haversine formula
      // Note: Assumes properties table has latitude and longitude DECIMAL columns
      const results = await prisma.$queryRaw<Array<{
        id: string;
        name: string;
        address: string;
        area: number;
        price: number;
        company_id: string;
        latitude: number;
        longitude: number;
        distance: number;
      }>>`
        SELECT 
          p.id,
          p.name,
          p.address,
          p.area,
          p.price,
          p.company_id,
          p.latitude,
          p.longitude,
          (
            6371000 * acos(
              cos(radians(${centerLat})) *
              cos(radians(p.latitude)) *
              cos(radians(p.longitude) - radians(${centerLon})) +
              sin(radians(${centerLat})) *
              sin(radians(p.latitude))
            )
          ) AS distance
        FROM properties p
        WHERE p.company_id = ${query.companyId}
          AND p.latitude IS NOT NULL
          AND p.longitude IS NOT NULL
        HAVING distance <= ${radiusMeters}
        ORDER BY distance ASC
        LIMIT ${limit}
      `;

      logger.info(
        {
          center: query.center,
          radius: query.radius,
          count: results.length,
          companyId: query.companyId,
        },
        'Nearby properties found'
      );

      return results.map((row) => ({
        id: row.id,
        name: row.name,
        location: {
          latitude: parseFloat(row.latitude.toString()),
          longitude: parseFloat(row.longitude.toString()),
        },
        address: row.address,
        area: row.area,
        price: row.price,
        companyId: row.company_id,
      }));
    } catch (error) {
      logger.error({ error, query }, 'Error finding nearby properties');
      throw error;
    }
  }

  /**
   * Find properties within bounding box
   * Uses simple latitude/longitude range check (MySQL-compatible)
   */
  async findPropertiesInBounds(
    northEast: GeoPoint,
    southWest: GeoPoint,
    companyId: string
  ): Promise<Property[]> {
    try {
      // Simple bounding box query using latitude/longitude ranges
      const results = await prisma.$queryRaw<Array<{
        id: string;
        name: string;
        address: string;
        area: number;
        price: number;
        company_id: string;
        latitude: number;
        longitude: number;
      }>>`
        SELECT 
          p.id,
          p.name,
          p.address,
          p.area,
          p.price,
          p.company_id,
          p.latitude,
          p.longitude
        FROM properties p
        WHERE p.company_id = ${companyId}
          AND p.latitude IS NOT NULL
          AND p.longitude IS NOT NULL
          AND p.latitude >= ${southWest.latitude}
          AND p.latitude <= ${northEast.latitude}
          AND p.longitude >= ${southWest.longitude}
          AND p.longitude <= ${northEast.longitude}
      `;

      return results.map((row) => ({
        id: row.id,
        name: row.name,
        location: {
          latitude: parseFloat(row.latitude.toString()),
          longitude: parseFloat(row.longitude.toString()),
        },
        address: row.address,
        area: row.area,
        price: row.price,
        companyId: row.company_id,
      }));
    } catch (error) {
      logger.error({ error }, 'Error finding properties in bounds');
      throw error;
    }
  }

  /**
   * Calculate distance between two points (in meters)
   * Uses Haversine formula (MySQL-compatible)
   */
  async calculateDistance(point1: GeoPoint, point2: GeoPoint): Promise<number> {
    // Always use Haversine formula for MySQL compatibility
    return this.haversineDistance(point1, point2);
  }

  /**
   * Haversine formula for distance calculation
   * This is the primary method for MySQL (no PostGIS needed)
   */
  private haversineDistance(point1: GeoPoint, point2: GeoPoint): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRadians(point2.latitude - point1.latitude);
    const dLon = this.toRadians(point2.longitude - point1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(point1.latitude)) *
        Math.cos(this.toRadians(point2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Legacy method name for backward compatibility
   * @deprecated Use checkGeospatialSupport() instead
   */
  async checkPostGIS(): Promise<boolean> {
    // Always return true for MySQL (uses Haversine)
    return true;
  }
}

export const geospatialService = new GeospatialService();
