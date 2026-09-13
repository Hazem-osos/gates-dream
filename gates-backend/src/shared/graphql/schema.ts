import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLList,
  GraphQLInt,
  GraphQLFloat,
} from 'graphql';
import { prisma } from '../database/prisma';
import { logger } from '../logger';

/**
 * GraphQL Schema
 * Used for complex dashboards and reporting queries
 */

// Example: Account Balance Type
const AccountBalanceType = new GraphQLObjectType({
  name: 'AccountBalance',
  fields: {
    id: { type: GraphQLString },
    accountCode: { type: GraphQLString },
    accountName: { type: GraphQLString },
    debit: { type: GraphQLString },
    credit: { type: GraphQLString },
    balance: { type: GraphQLString },
  },
});

// Example: Dashboard Stats Type
const DashboardStatsType = new GraphQLObjectType({
  name: 'DashboardStats',
  fields: {
    totalSales: { type: GraphQLString },
    totalPurchases: { type: GraphQLString },
    accountBalance: { type: GraphQLString },
    activeUsers: { type: GraphQLInt },
  },
});

// Root Query Type
const RootQueryType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    // Example: Get account balances
    accountBalances: {
      type: new GraphQLList(AccountBalanceType),
      args: {
        companyId: { type: GraphQLString },
        toDate: { type: GraphQLString },
      },
      resolve: async (_parent, args, context) => {
        try {
          const companyId = args.companyId || context.companyId;
          if (!companyId) {
            throw new Error('Company ID is required');
          }

          const toDate = args.toDate ? new Date(args.toDate) : new Date();

          // Get all active accounts
          const accounts = await prisma.account.findMany({
            where: {
              companyId,
              isActive: true,
              deletedAt: null,
            },
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          });

          // M16 fix (Item 35): was one journalEntryLine.findMany per account
          // (N+1); a single grouped aggregate replaces it regardless of
          // account count.
          const sums = accounts.length
            ? await prisma.journalEntryLine.groupBy({
                by: ['accountId'],
                where: {
                  accountId: { in: accounts.map((a) => a.id) },
                  journalEntry: {
                    companyId,
                    date: { lte: toDate },
                    isPosted: true,
                    isCancelled: false,
                  },
                },
                _sum: { debit: true, credit: true },
              })
            : [];
          const sumByAccountId = new Map(sums.map((s) => [s.accountId, s._sum]));

          const accountBalances = accounts.map((account) => {
            const sum = sumByAccountId.get(account.id);
            const totalDebit = sum?.debit ? Number(sum.debit) : 0;
            const totalCredit = sum?.credit ? Number(sum.credit) : 0;
            const balance = totalDebit - totalCredit;

            return {
              id: account.id,
              accountCode: account.code || '',
              accountName: account.arabicName,
              debit: totalDebit.toFixed(2),
              credit: totalCredit.toFixed(2),
              balance: balance.toFixed(2),
            };
          });

          return accountBalances;
        } catch (error) {
          logger.error({ error, args, context }, 'Error in accountBalances GraphQL query');
          throw error;
        }
      },
    },

    // Example: Get dashboard stats
    dashboardStats: {
      type: DashboardStatsType,
      args: {
        companyId: { type: GraphQLString },
        fromDate: { type: GraphQLString },
        toDate: { type: GraphQLString },
      },
      resolve: async (_parent, args, context) => {
        try {
          const companyId = args.companyId || context.companyId;
          if (!companyId) {
            throw new Error('Company ID is required');
          }

          const toDate = args.toDate ? new Date(args.toDate) : new Date();
          const fromDate = args.fromDate ? new Date(args.fromDate) : new Date(toDate.getFullYear(), toDate.getMonth(), 1);

          // Calculate total sales (sales invoices)
          const salesInvoices = await prisma.invoice.findMany({
            where: {
              companyId,
              invoiceType: 'sales',
              date: { gte: fromDate, lte: toDate },
              isPosted: true,
              isCancelled: false,
            },
          });
          const totalSales = salesInvoices.reduce(
            (sum, inv) => sum + Number(inv.totalAmount || 0),
            0
          );

          // Calculate total purchases (purchase invoices)
          const purchaseInvoices = await prisma.invoice.findMany({
            where: {
              companyId,
              invoiceType: 'purchase',
              date: { gte: fromDate, lte: toDate },
              isPosted: true,
              isCancelled: false,
            },
          });
          const totalPurchases = purchaseInvoices.reduce(
            (sum, inv) => sum + Number(inv.totalAmount || 0),
            0
          );

          // Calculate account balance (sum of all account balances)
          // M16 fix (Item 35): was one sequential journalEntryLine.findMany
          // per account inside a `for` loop (worse than a `Promise.all`
          // N+1 — fully serial); a single grouped aggregate replaces it.
          const accountIds = await prisma.account.findMany({
            where: {
              companyId,
              isActive: true,
              deletedAt: null,
            },
            select: { id: true },
          });

          const balanceSums = accountIds.length
            ? await prisma.journalEntryLine.groupBy({
                by: ['accountId'],
                where: {
                  accountId: { in: accountIds.map((a) => a.id) },
                  journalEntry: {
                    companyId,
                    date: { lte: toDate },
                    isPosted: true,
                    isCancelled: false,
                  },
                },
                _sum: { debit: true, credit: true },
              })
            : [];

          let totalAccountBalance = 0;
          for (const sum of balanceSums) {
            const totalDebit = sum._sum.debit ? Number(sum._sum.debit) : 0;
            const totalCredit = sum._sum.credit ? Number(sum._sum.credit) : 0;
            totalAccountBalance += totalDebit - totalCredit;
          }

          // Get active users count
          const activeUsers = await prisma.user.count({
            where: {
              companyId,
              isActive: true,
            },
          });

          return {
            totalSales: totalSales.toFixed(2),
            totalPurchases: totalPurchases.toFixed(2),
            accountBalance: totalAccountBalance.toFixed(2),
            activeUsers,
          };
        } catch (error) {
          logger.error({ error, args, context }, 'Error in dashboardStats GraphQL query');
          throw error;
        }
      },
    },
  },
});

// GraphQL Schema
export const graphqlSchema = new GraphQLSchema({
  query: RootQueryType,
});
