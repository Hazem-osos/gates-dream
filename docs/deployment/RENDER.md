# نشر Gates على Render

المشروع على Render: [dashboard.render.com/project/prj-dbcckr4s728c73enkkk0](https://dashboard.render.com/project/prj-dbcckr4s728c73enkkk0)

الملف `render.yaml` في جذر المستودع يعرّف:

| خدمة | الدور |
|------|--------|
| **gates-redis** | Redis (BullMQ / كاش) |
| **gates-backend** | API + migrate على الإقلاع |
| **gates-workers** | نفس صورة الـ API مع `GATES_RUN_WORKERS=1` |
| **gates-web** | Next.js (standalone) + proxy `/api/v1` للـ backend |

## 1) ربط المستودع بالمشروع

1. ادخل على [مشروع Render](https://dashboard.render.com/project/prj-dbcckr4s728c73enkkk0).
2. **New** → **Blueprint** (أو **Sync** إن كان مربوطاً).
3. اختر مستودع GitHub/GitLab وفرع النشر (مثلاً `main`).
4. Render يقرأ `render.yaml` من الجذر وينشئ الخدمات.

بدون Blueprint: أنشئ كل خدمة يدوياً بنفس الأسماء والـ Docker paths من `render.yaml`.

## 2) قاعدة البيانات (MySQL)

Gates يستخدم **MySQL** (Prisma). Render يوفّر **Postgres** مُداراً فقط — لا يوجد MySQL مُدار على Render.

**خيارات عملية:**

| الخيار | ملاحظة |
|--------|--------|
| **أ) الإبقاء على Railway MySQL** | أسرع للنشر: ضع `DATABASE_URL` من Railway على `gates-backend` (شبكة عامة + SSL إن لزم). |
| **ب) MySQL على مزوّد آخر** | Aiven / PlanetScale / VPS — ثم نفس `DATABASE_URL`. |
| **ج) نسخ البيانات ثم التبديل** | Dump من Railway → استيراد على الهدف الجديد → تحديث `DATABASE_URL` على Render. |

### أخذ نسخة من Railway (على جهازك)

مع `railway` CLI مربوط بالمشروع:

```bash
# متغيرات MySQL من Railway
railway variables --service MySQL --json

# أو من gates-backend/.env بعد:
cd gates-backend && npm run railway:sync-db-url
```

Dump (يحتاج `mysqldump` واتصال TCP للـ MySQL — فعّل TCP proxy على Railway إن لزم):

```bash
cd gates-backend
source .env  # أو export DATABASE_URL=...
bash ../scripts/render/mysql-dump.sh ./backups/railway-$(date +%Y%m%d).sql
```

### استعادة على جهازك (محلي)

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS gates_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
bash scripts/render/mysql-restore.sh ./backups/railway-YYYYMMDD.sql gates_db
# gates-backend/.env:
# DATABASE_URL="mysql://root:PASSWORD@localhost:3306/gates_db?connection_limit=20&pool_timeout=10"
cd gates-backend && npx prisma migrate deploy
```

### استعادة على MySQL جديد (سحابة)

نفس `mysql-restore.sh` مع `DATABASE_URL` يشير للهدف، ثم ضع نفس الرابط في **Environment** لـ `gates-backend` على Render.

## 3) متغيرات إلزامية على Render

بعد أول Blueprint sync، افتح **gates-backend** → **Environment**:

| متغير | قيمة |
|--------|------|
| `DATABASE_URL` | رابط MySQL كامل (من Railway أو بعد النقل) |
| `FRONTEND_URL` | `https://gates-web-xxxx.onrender.com` (رابط الويب الفعلي بعد أول deploy) |
| `JWT_DEV_SECRET` | يُولَّد تلقائياً من Blueprint — أو سرّك الطويل |
| `ENCRYPTION_KEY` | 32+ حرف عشوائي (يُولَّد من Blueprint) |

`gates-workers` يرث `DATABASE_URL` و`JWT_DEV_SECRET` و`ENCRYPTION_KEY` من الـ backend عبر `render.yaml`.

**لا** تضبط `SEED_ON_BOOT` في الإنتاج إلا إذا كنت تعرف ما تفعل (`ALLOW_PROD_SEED` + `SEED_OWNER_PASSWORD`).

اختياري للهجرة من الواجهة: راجع `docs/migration/RAILWAY_MIGRATION_ENV.md` (نفس المتغيرات على workers + backend).

## 4) CORS

المتصفح يتكلم مع **gates-web** فقط؛ الـ API يُستدعى عبر proxy داخل Next. لو فتحت الـ API مباشرة من المتصفح، اضبط `FRONTEND_URL` على رابط الويب.

## 5) إعادة بناء الويب بعد تغيير الـ backend

`BACKEND_PROXY_TARGET` مضبوط في Blueprint على الشبكة الداخلية: `http://gates-backend:10000` (build + runtime).

إذا غيّرت اسم خدمة الـ backend، حدّث المتغير وأعد **Manual Deploy** لـ `gates-web`.

## 6) التحقق

- `https://<gates-web>/health` → OK  
- `https://<gates-backend>/health/live` → OK  
- تسجيل الدخول من `/auth/login`

## 7) CLI (اختياري)

```bash
brew install render
render login
render blueprint sync  # من جذر المستودع بعد الربط
```

## ملاحظة عن الفاتورة / warehouseId

إذا ظهر `Foreign key constraint violated: warehouseId` عند الحفظ، المخزن في الفاتورة أو في إعدادات المستند غير موجود في نفس الشركة — اختر مخزناً صالحاً من الشاشة أو صحّح المخزن الافتراضي في إعدادات الحركة / بروفايل المستند.
