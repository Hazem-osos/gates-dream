# توثيق قاعدة ERP (SQL Server)

هذا المجلد يشرح **قاعدة سطح المكتب (Microsoft SQL Server)** التي يتصل بها تطبيق الموبايل — **وليس** قاعدة MySQL التي يديرها Prisma.

| الملف | المحتوى |
|--------|---------|
| **[SQL_SERVER_ERP_GUIDE.md](./SQL_SERVER_ERP_GUIDE.md)** | الدليل الرئيسي: أين الاتصال، الفرق عن Prisma، الجداول التي يستخدمها الموبايل، العلاقات، الإجراءات المخزنة |
| **[ERP_TABLES_INDEX.md](./ERP_TABLES_INDEX.md)** | فهرس **570** جدولاً (اسم + عدد الأعمدة فقط — سريع) |
| **[ERP_FULL_TABLES_CATALOG.md](./ERP_FULL_TABLES_CATALOG.md)** | **كل جدول (570):** ماذا يفعل + العلاقات + الأعمدة + هل الموبايل يستخدمه |
| **[erp_schema.txt](./erp_schema.txt)** | قائمة كاملة `Table.Column (type)` — مرجع عند أخطاء «عمود غير صالح» |
| **[erp_procedures.txt](./erp_procedures.txt)** | أسماء الإجراءات المخزنة المعروفة على ERP |
| **[migrate-to-railway.md](./migrate-to-railway.md)** | نقل `.bak` ERP إلى SQL Server على Railway |

**تحديث الملفات من سطح المكتب:** إذا تغيّر الـ schema على ERP، انسخ dump جديد إلى `erp_schema.txt` / `erp_procedures.txt` (انظر `AGENTS.md`).
