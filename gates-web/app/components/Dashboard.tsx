import React from 'react';

const stats = [
  { label: 'إجمالي المبيعات', value: '250,000 ر.س', icon: '💰', color: 'bg-[#0E79AA]' },
  { label: 'الفواتير الجديدة', value: '32', icon: '🧾', color: 'bg-[#9747FF]' },
  { label: 'المهام النشطة', value: '7', icon: '📋', color: 'bg-[#CB5B53]' },
  { label: 'الإشعارات', value: '5', icon: '🔔', color: 'bg-[#FFD600] text-[#0E79AA]' },
];

const quickAccess = [
  { label: 'الحسابات', icon: '📊', color: 'bg-[#0E79AA] text-white' },
  { label: 'المخازن', icon: '📦', color: 'bg-[#9747FF] text-white' },
  { label: 'المبيعات', icon: '🛒', color: 'bg-[#CB5B53] text-white' },
  { label: 'التقارير', icon: '📈', color: 'bg-[#FFD600] text-[#0E79AA]' },
  { label: 'الإعدادات', icon: '⚙️', color: 'bg-[#E6F0F7] text-[#0E79AA]' },
];

const tasks = [
  { title: 'مراجعة تقارير الحسابات', time: 'اليوم - 3:00 م', icon: '📝' },
  { title: 'إرسال فاتورة للعميل', time: 'غداً - 10:00 ص', icon: '📤' },
  { title: 'تحديث بيانات المخزون', time: 'غداً - 1:00 م', icon: '📦' },
];

export default function Dashboard() {
  return (
    <div className="p-6 bg-[#F9FAFB] min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div className="flex flex-col gap-2 w-full">
          <h1 className="text-3xl font-bold text-[#0E79AA] mb-1">مرحباً بك في نظام Gate Soft ERP 👋</h1>
          <p className="text-black text-lg">لوحة التحكم الرئيسية الخاصة بك</p>
        </div>
      </div>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-xl shadow p-6 flex items-center gap-4">
            <span className={`w-14 h-14 flex items-center justify-center text-3xl rounded-lg shadow ${stat.color}`}>{stat.icon}</span>
            <div>
              <div className="text-2xl font-bold text-[#0E79AA]">{stat.value}</div>
              <div className="text-black text-sm mt-1">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>
      {/* Charts & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Area/Line Chart Placeholder */}
        <div className="bg-white rounded-xl shadow p-6 col-span-2 flex flex-col">
          <div className="font-bold text-[#0E79AA] mb-2">نظرة عامة على المبيعات</div>
          <div className="flex-1 flex items-center justify-center text-black text-5xl">📈</div>
          <div className="text-center text-black mt-2">(رسم بياني تفاعلي للمبيعات هنا)</div>
        </div>
        {/* Pie Chart Placeholder */}
        <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
          <div className="font-bold text-[#0E79AA] mb-2">توزيع الحسابات</div>
          <div className="flex-1 flex items-center justify-center text-black text-5xl">🥧</div>
          <div className="text-center text-black mt-2">(رسم بياني دائري هنا)</div>
        </div>
      </div>
      {/* Tasks & Reminders */}
      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <div className="font-bold text-[#0E79AA] mb-4 text-lg flex items-center gap-2">⏰ المهام والتذكيرات</div>
        <ul className="divide-y divide-gray-100">
          {tasks.map((task, i) => (
            <li key={i} className="py-3 flex items-center gap-3">
              <span className="text-2xl">{task.icon}</span>
              <span className="flex-1 text-black font-medium">{task.title}</span>
              <span className="text-xs text-[#0E79AA]">{task.time}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* Quick Access Shortcuts */}
      <div className="mb-8">
        <div className="font-bold text-[#0E79AA] mb-4 text-lg flex items-center gap-2">🚀 وصول سريع</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {quickAccess.map((item, i) => (
            <button key={i} className={`flex flex-col items-center justify-center gap-2 p-5 rounded-xl shadow hover:scale-105 transition font-bold text-lg ${item.color}`} style={{ minHeight: 110 }}>
              <span className="text-3xl">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
      {/* Help & Resources Section */}
      <div className="bg-[#0E79AA] rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center text-center mt-8">
        <div className="text-3xl mb-2 text-white">💡</div>
        <h2 className="text-2xl font-bold text-white mb-2">نصائح سريعة & موارد مساعدة</h2>
        <p className="text-white mb-4">اكتشف أفضل الطرق لاستخدام النظام، أو تواصل مع الدعم الفني لأي استفسار أو مشكلة تواجهك.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button className="bg-white text-[#0E79AA] font-bold px-6 py-2 rounded-lg shadow hover:bg-[#E6F0F7] transition">دليل المستخدم</button>
          <button className="bg-[#FFD600] text-[#0E79AA] font-bold px-6 py-2 rounded-lg shadow hover:bg-yellow-300 transition">تواصل مع الدعم</button>
        </div>
      </div>
    </div>
  );
} 