import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../../../shared/middleware/error-handler';
import { MAX_CAD_ATTACHMENT_BYTES } from '../types/document-attachment.types';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CAD_ATTACHMENT_BYTES, files: 1 },
});

export function uploadAttachmentMemory(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        next(new AppError(413, 'حجم الملف يتجاوز 50 ميجابايت'));
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
