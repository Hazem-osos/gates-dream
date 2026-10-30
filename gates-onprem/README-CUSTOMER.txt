Gates ERP — On-premise server (Windows)
=======================================

REQUIREMENTS
  - Windows 10/11 or Windows Server 2016+ (64-bit)
  - MySQL 8.x server the program can reach, with a NEW, EMPTY database for the first install
  - Copy this whole folder to a writable location, e.g.  C:\GatesERP   (not "Program Files")

FIRST START
  1. Double-click GatesERP.exe.
  2. It shows this machine's code (also saved in machine-code.txt). Send it to Gates.
  3. Put the license file you receive next to GatesERP.exe, named:  gates.lic
  4. Start GatesERP.exe again and paste the MySQL connection string:
        mysql://USER:PASSWORD@HOST:3306/DATABASE
  5. On an empty database it creates the tables, then asks for the company name and the
     first administrator account.
  6. The program opens in the browser. Other computers on the network open the address
     shown in the window (http://SERVER-NAME:3000).

DAILY USE
  - Keep the GatesERP window open; closing it stops the program for everyone.
  - Logs: data\logs\backend.log and data\logs\web.log
  - Change the database:  GatesERP.exe --change-db

LICENSE
  - The license works on this machine only. Moving to another server needs a new license.
  - The number of active users is limited by the license.
  - Do not edit gates.lic — any change makes it invalid.

-----------------------------------------------------------------------
برنامج Gates ERP — نسخة السيرفر المحلي (ويندوز)

المتطلبات
  - ويندوز 10/11 أو ويندوز سيرفر 2016 فأحدث (64 بت)
  - سيرفر MySQL 8 وقاعدة بيانات جديدة فارغة لأول تثبيت
  - انسخ المجلد كاملاً إلى مكان قابل للكتابة مثل  C:\GatesERP

أول تشغيل
  1. شغّل GatesERP.exe
  2. سيظهر "كود الجهاز" (ومحفوظ أيضاً في machine-code.txt). أرسله إلى Gates.
  3. ضع ملف الترخيص الذي يصلك بجوار البرنامج باسم  gates.lic
  4. شغّل البرنامج مرة أخرى وأدخل رابط قاعدة البيانات:
        mysql://USER:PASSWORD@HOST:3306/DATABASE
  5. سيُنشئ الجداول ثم يطلب اسم الشركة وحساب مدير النظام الأول.
  6. يفتح البرنامج في المتصفح، وباقي الأجهزة تفتح العنوان الظاهر في النافذة.

الترخيص
  - الترخيص يعمل على هذا الجهاز فقط.
  - عدد المستخدمين النشطين محدود حسب الترخيص.
  - لا تعدّل ملف gates.lic؛ أي تعديل يُبطله.
