import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

if (!process.env.NODE_ENV) {
  Reflect.set(process.env, 'NODE_ENV', 'development');
}

import { __testHooks, validateScopeFilterColumn } from '../app/lib/data';

function runCase(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runCase('invoice scope WHERE clause does not start with AND', () => {
  const where = __testHooks.renderInvoiceScopeWhereClause({
    userEmail: 'User@example.com',
    workspaceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    hasInvoicesWorkspaceId: true,
    qualified: true,
  });

  const afterWhere = where.replace(/^WHERE\s+/i, '');
  assert.equal(/^and\b/i.test(afterWhere), false);
  assert.match(where, /^WHERE\s+1=1\s+AND\s+/i);
});

runCase('scope column validator rejects unsafe predicates/operators', () => {
  const invalidColumns = [
    'invoices.workspace_id = $1',
    'invoices.workspace_id =',
    'customers.workspace_id;$1',
    'where invoices.workspace_id',
    'AND invoices.workspace_id',
    'or lower(user_email)',
    'invoices.workspace_id$1',
  ];

  for (const column of invalidColumns) {
    assert.throws(
      () => validateScopeFilterColumn(column),
      /Invalid scope filter column fragment/,
    );
  }
});

runCase('scope column validator accepts bare columns and expressions', () => {
  assert.equal(validateScopeFilterColumn('invoices.workspace_id'), 'invoices.workspace_id');
  assert.equal(validateScopeFilterColumn(' lower(customers.user_email) '), 'lower(customers.user_email)');
});

runCase('scope column validator hides details in production', () => {
  const previousEnv = process.env.NODE_ENV;
  Reflect.set(process.env, 'NODE_ENV', 'production');
  try {
    assert.throws(
      () => validateScopeFilterColumn('invoices.workspace_id = $1'),
      /Invalid query builder fragment/,
    );
  } finally {
    Reflect.set(process.env, 'NODE_ENV', previousEnv);
  }
});

runCase('scope filter builders do not use sql.unsafe in template interpolation', () => {
  const dataSource = readFileSync(path.join(process.cwd(), 'app/lib/data.ts'), 'utf8');
  assert.doesNotMatch(
    dataSource,
    /\$\{sql\.unsafe\((invoiceFilter|customerFilter)\.column\)\}/,
  );
});
