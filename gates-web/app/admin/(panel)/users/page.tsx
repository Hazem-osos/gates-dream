'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Card, PageHeader } from '@/components/platform-admin/ui';
import { UsersTable } from '@/components/platform-admin/UsersTable';
import { useCan } from '@/lib/platform-admin/hooks';
import { CreateUserDialog } from '@/components/platform-admin/Dialogs';

export default function PlatformUsersPage() {
  const [creating, setCreating] = useState(false);
  const can = useCan();
  return (
    <>
      <PageHeader
        title="المستخدمون"
        subtitle="كل مستخدمي كل الشركات: النشاط، الدخول، الإيقاف، كلمات المرور والحذف"
        actions={can('users.edit') ? <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>مستخدم جديد</Button> : undefined}
      />
      <Card>
        <UsersTable />
      </Card>
      {creating && <CreateUserDialog open onClose={() => setCreating(false)} />}
    </>
  );
}
