export type AutomationRuleRecord = {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  eventType: string;
  enabled: boolean;
  conditions: unknown;
  actions: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type AutomationRuleN8nView = {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  eventType: string;
  conditions: unknown;
  actions: unknown;
};

export type AutomationRuleDb = {
  automationRule: {
    // Args are intentionally loose so the real Prisma delegate and in-memory
    // test doubles are both assignable without pulling the generated client
    // into unit tests.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findMany: (args?: any) => Promise<AutomationRuleRecord[]>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findFirst: (args?: any) => Promise<AutomationRuleRecord | null>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: (args: any) => Promise<AutomationRuleRecord>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: (args: any) => Promise<AutomationRuleRecord>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete: (args: any) => Promise<AutomationRuleRecord>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    count: (args?: any) => Promise<number>;
  };
};
