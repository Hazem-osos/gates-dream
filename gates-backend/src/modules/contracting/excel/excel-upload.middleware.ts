import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../../../shared/middleware/error-handler';
import { EXCEL_MAX_BYTES } from './types';

const ALLOWED = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
  'application/octet-stream',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: EXCEL_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const extOk = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv');
    if (!extOk) {
      cb(new AppError(400, 'صيغة الملف غير مدعومة. ارفع ملف .xlsx أو .csv'));
      return;
    }
    if (file.mimetype && !ALLOWED.has(file.mimetype) && !extOk) {
      cb(new AppError(400, 'نوع الملف غير مسموح'));
      return;
    }
    cb(null, true);
  },
});

export function uploadExcelMemory(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        next(new AppError(413, 'حجم الملف يتجاوز 15 ميجابايت'));
        return;
      }
      next(new AppError(400, 'تعذر رفع الملف'));
      return;
    }
    if (err) {
      next(err);
      return;
    }
    if (!req.file?.buffer?.length) {
      next(new AppError(400, 'لم يتم رفع ملف Excel'));
      return;
    }
    next();
  });
}
