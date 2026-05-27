// Prisma is optional on Vercel — the app uses Supabase for primary data.
// This module safely handles environments where Prisma/SQLite is unavailable.

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient | null {
  try {
    // On Vercel (serverless), SQLite is not available.
    // Only create PrismaClient if we have a DATABASE_URL pointing to a real DB.
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl || dbUrl.includes('file:')) {
      if (process.env.VERCEL) {
        console.warn('[Aether] Skipping Prisma on Vercel — app uses Supabase for data.')
        return null
      }
    }

    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    })
  } catch (e) {
    console.warn('[Aether] Prisma client could not be initialized. Using Supabase for data.')
    return null
  }
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production' && db) globalForPrisma.prisma = db
