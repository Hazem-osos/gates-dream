import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../../../shared/middleware/error-handler';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});

export function uploadAiDocumentMemory(req: Request, res: Response, next: NextFunction): void {
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
      next(new AppError(400, 'لم يتم رفع ملف'));
      return;
    }
    next();
  });
}
