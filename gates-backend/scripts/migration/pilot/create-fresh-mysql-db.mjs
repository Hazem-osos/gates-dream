#!/usr/bin/env node
import { config } from 'dotenv';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

const dbName = process.argv[2] ?? 'gates_migration_pilot_fresh';
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL required');

const u = new URL(url);
const args = ['-h', u.hostname, '-P', u.port || '3306', '-u', decodeURIComponent(u.username)];
if (u.password) args.push(`-p${decodeURIComponent(u.password)}`);
const sql = `DROP DATABASE IF EXISTS \`${dbName}\`; CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`;
execFileSync('mysql', [...args, '-e', sql], { stdio: 'inherit' });
const pilotUrl = new URL(url);
pilotUrl.pathname = `/${dbName}`;
console.log(pilotUrl.toString());
