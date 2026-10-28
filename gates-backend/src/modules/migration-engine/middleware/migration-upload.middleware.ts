import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  assertAllowedBackupFilename,
  ensureCompanyPackageDir,
} from '../services/migration-package.storage';
import { migrationPackageMaxBytes } from '../migration-engine-config';

function storageForCompany(companyId: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      void ensureCompanyPackageDir(companyId)
        .then((dir) => cb(null, dir))
        .catch((e) => cb(e as Error, ''));
    },
    filename: (_req, file, cb) => {
      try {
        const ext = assertAllowedBackupFilename(file.originalname);
        cb(null, `upload-${randomUUID()}${ext}.part`);
      } catch (e) {
        cb(e as Error, '');
      }
    },
  });
}

export function migrationPackageUpload(req: Request, res: Response, next: NextFunction) {
  const companyId = (req as { companyId?: string }).companyId;
  if (!companyId) {
    return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  }
  const upload = multer({
    storage: storageForCompany(companyId),
    limits: { fileSize: migrationPackageMaxBytes(), files: 1 },
    fileFilter: (_req, file, cb) => {
      try {
        assertAllowedBackupFilename(file.originalname || 'x.bak');
        cb(null, true);
      } catch (e) {
        cb(e as Error);
      }
    },
  }).single('file');

  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return void res.status(400).json({ status: 'error', message: err.message });
    }
    if (err) {
      return void res.status(400).json({
        status: 'error',
        message: err instanceof Error ? err.message : 'Upload failed',
      });
    }
    if (!req.file) {
      return void res.status(400).json({ status: 'error', message: 'لم يُرفع أي ملف' });
    }
    req.file.originalname = path.basename(req.file.originalname || req.file.filename);
    next();
  });
}
