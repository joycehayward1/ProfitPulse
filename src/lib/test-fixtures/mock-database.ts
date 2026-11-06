/**
 * A stand-in for `client.database` in page tests: every query step returns the
 * same chain, awaiting it resolves to the table's rows, and `.single()` /
 * `.maybeSingle()` resolve to the first row. Inserts and upserts are recorded.
 */
export function createMockDatabase(tables: Record<string, unknown[]>) {
  const writes: { table: string; op: "insert" | "upsert" | "update"; payload: unknown }[] = [];

  function chain(table: string) {
    const rows = tables[table] ?? [];
    const result = { data: rows, error: null };
    const self: Record<string, unknown> = {};
    for (const step of ["select", "eq", "neq", "gte", "lte", "in", "order", "limit", "range", "is"]) {
      self[step] = jest.fn(() => self);
    }
    for (const op of ["insert", "upsert", "update"] as const) {
      self[op] = jest.fn((payload: unknown) => {
        writes.push({ table, op, payload });
        return self;
      });
    }
    self.single = jest.fn(() => Promise.resolve({ data: rows[0] ?? null, error: null }));
    self.maybeSingle = jest.fn(() => Promise.resolve({ data: rows[0] ?? null, error: null }));
    self.then = (resolve: (v: typeof result) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    return self;
  }

  return { database: { from: jest.fn((table: string) => chain(table)) }, writes };
}
