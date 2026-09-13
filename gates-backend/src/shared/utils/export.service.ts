import { Response } from 'express';
import { logger } from '../logger';

export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf';
  filename?: string;
  columns?: string[];
  headers?: Record<string, string>;
}

/**
 * Export data to CSV format
 */
export function exportToCSV(
  res: Response,
  data: any[],
  options: ExportOptions
): void {
  try {
    const filename = options.filename || `export_${Date.now()}.csv`;
    const columns = options.columns || Object.keys(data[0] || {});
    const headers = options.headers || {};

    // Generate CSV header
    const csvHeaders = columns.map((col) => headers[col] || col).join(',');
    
    // Generate CSV rows
    const csvRows = data.map((row) => {
      return columns
        .map((col) => {
          const value = row[col];
          // Escape commas and quotes in CSV
          if (value === null || value === undefined) return '';
          const stringValue = String(value).replace(/"/g, '""');
          return `"${stringValue}"`;
        })
        .join(',');
    });

    const csvContent = [csvHeaders, ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\ufeff' + csvContent); // BOM for Excel compatibility
  } catch (error) {
    logger.error({ error }, 'Error exporting to CSV');
    throw error;
  }
}

/**
 * Export data to Excel format (CSV with Excel MIME type)
 * Note: For full Excel support, consider using a library like 'exceljs'
 */
export function exportToExcel(
  res: Response,
  data: any[],
  options: ExportOptions
): void {
  try {
    // For now, use CSV format with Excel MIME type
    // Full Excel support would require 'exceljs' library
    const filename = (options.filename || `export_${Date.now()}`).replace(/\.xlsx?$/, '') + '.csv';
    
    exportToCSV(res, data, { ...options, filename });
    
    // Override content type for Excel
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  } catch (error) {
    logger.error({ error }, 'Error exporting to Excel');
    throw error;
  }
}

/**
 * Export data to PDF format
 * Note: For full PDF support, consider using a library like 'pdfkit' or 'puppeteer'
 */
export function exportToPDF(
  res: Response,
  data: any[],
  options: ExportOptions
): void {
  try {
    // Basic PDF export - convert to HTML table and suggest PDF conversion
    // Full PDF support would require 'pdfkit' or 'puppeteer' library
    const filename = (options.filename || `export_${Date.now()}`).replace(/\.pdf$/, '') + '.html';
    const columns = options.columns || Object.keys(data[0] || {});
    const headers = options.headers || {};

    // Generate HTML table
    const tableHeaders = columns.map((col) => `<th>${headers[col] || col}</th>`).join('');
    const tableRows = data.map((row) => {
      const cells = columns.map((col) => {
        const value = row[col] ?? '';
        return `<td>${String(value).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Export</title>
          <style>
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <h1>Export Data</h1>
          <table>
            <thead><tr>${tableHeaders}</tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
          <p><small>Note: For full PDF support, install 'pdfkit' or 'puppeteer' library</small></p>
        </body>
      </html>
    `;

    logger.warn('PDF export using HTML fallback. Consider installing pdfkit or puppeteer for full PDF support.');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(html);
  } catch (error) {
    logger.error({ error }, 'Error exporting to PDF');
    throw error;
  }
}

/**
 * Main export function that routes to appropriate format
 */
export function exportData(
  res: Response,
  data: any[],
  options: ExportOptions
): void {
  switch (options.format) {
    case 'csv':
      exportToCSV(res, data, options);
      break;
    case 'excel':
      exportToExcel(res, data, options);
      break;
    case 'pdf':
      exportToPDF(res, data, options);
      break;
    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }
}

