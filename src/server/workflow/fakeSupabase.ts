/**
 * In-memory Supabase stand-in used by workflow unit tests.
 *
 * It models only the PostgREST surface the workflow service actually uses:
 * from().select()/insert()/update()/delete(), eq()/in()/order()/limit(),
 * maybeSingle()/single() and rpc(). Updates are applied with filter
 * semantics, which is what makes optimistic-concurrency behaviour testable
 * (a conditional update that matches zero rows returns an empty data array).
 */

export type Row = Record<string, any>;

type Filter = { col: string; value: any; kind: 'eq' | 'in' | 'neq' };

class FakeQuery {
  private table: string;
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: Row | Row[] | null = null;
  private filters: Filter[] = [];
  private mode: 'many' | 'maybe' | 'one' | null = null;
  private returning: string | null = null;
  private orderBy: { col: string; ascending: boolean } | null = null;
  private limitN: number | null = null;

  constructor(private db: FakeSupabase, table: string) {
    this.table = table;
  }

  select(cols?: string) {
    if (this.op === 'select') {
      this.returning = cols ?? '*';
      return this;
    }
    this.returning = cols ?? '*';
    if (this.op === 'insert' || this.op === 'update' || this.op === 'delete') return this;
    return this;
  }

  insert(payload: Row | Row[]) {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: Row) {
    this.op = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  eq(col: string, value: any) {
    this.filters.push({ col, value, kind: 'eq' });
    return this;
  }

  neq(col: string, value: any) {
    this.filters.push({ col, value, kind: 'neq' });
    return this;
  }

  in(col: string, values: any[]) {
    this.filters.push({ col, value: values, kind: 'in' });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = { col, ascending: opts?.ascending !== false };
    return this;
  }

  limit(n: number) {
    this.limitN = n;
    return this;
  }

  maybeSingle() {
    this.mode = 'maybe';
    return this;
  }

  single() {
    this.mode = 'one';
    return this;
  }

  then(resolve: any, reject?: any) {
    return Promise.resolve(this.execute()).then(resolve, reject);
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => {
      if (f.kind === 'eq') return row[f.col] === f.value;
      if (f.kind === 'neq') return row[f.col] !== f.value;
      return (f.value as any[]).includes(row[f.col]);
    });
  }

  private execute(): { data: any; error: any } {
    const table = this.db.table(this.table);
    this.db.log.push({ op: this.op, table: this.table });

    const injected = this.db.takeFailure(this.op as 'insert' | 'update', this.table);
    if (injected) return { data: null, error: { message: injected.message } };

    if (this.op === 'insert') {
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload!]).map((r) => {
        const stored = { id: this.db.nextId(this.table), created_at: new Date().toISOString(), ...r };
        table.push(stored);
        return { ...stored };
      });
      if (this.mode === 'one') {
        if (rows.length !== 1) return { data: null, error: { message: 'multiple rows returned' } };
        return { data: rows[0], error: null };
      }
      if (this.mode === 'maybe') return { data: rows[0] ?? null, error: null };
      return { data: this.returning ? rows : null, error: null };
    }

    if (this.op === 'update') this.db.beforeUpdate?.(this.table);

    const matched = table.filter((r) => this.matches(r));

    if (this.op === 'update') {
      const updated = matched.map((row) => {
        Object.assign(row, this.payload as Row, { updated_at: new Date().toISOString() });
        return { ...row };
      });
      if (this.returning) return { data: updated, error: null };
      return { data: null, error: null };
    }

    if (this.op === 'delete') {
      for (const row of matched) {
        const idx = table.indexOf(row);
        if (idx >= 0) table.splice(idx, 1);
      }
      return { data: this.returning ? matched : null, error: null };
    }

    let rows = matched.map((r) => ({ ...r }));
    if (this.orderBy) {
      const { col, ascending } = this.orderBy;
      rows = rows.slice().sort((a, b) => {
        const av = a[col];
        const bv = b[col];
        if (av === bv) return 0;
        const cmp = av > bv ? 1 : -1;
        return ascending ? cmp : -cmp;
      });
    }
    if (this.limitN !== null) rows = rows.slice(0, this.limitN);

    if (this.mode === 'maybe') return { data: rows[0] ?? null, error: null };
    if (this.mode === 'one') {
      if (rows.length !== 1) return { data: null, error: { message: `expected 1 row, got ${rows.length}` } };
      return { data: rows[0], error: null };
    }
    return { data: rows, error: null };
  }
}

export interface FakeOperation {
  op: 'select' | 'insert' | 'update' | 'delete';
  table: string;
}

export class FakeSupabase {
  private tables = new Map<string, Row[]>();
  private ids = new Map<string, number>();
  rpcResults = new Map<string, any>();
  /** Every statement executed, in order — used to prove history is append-only. */
  log: FakeOperation[] = [];
  /** Runs before an update is applied; lets a test simulate a concurrent writer. */
  beforeUpdate: ((table: string) => void) | null = null;
  private failures: Array<{ op: 'insert' | 'update'; table: string; message: string }> = [];

  table(name: string): Row[] {
    let rows = this.tables.get(name);
    if (!rows) {
      rows = [];
      this.tables.set(name, rows);
    }
    return rows;
  }

  seed(name: string, rows: Row[]) {
    this.table(name).push(...rows.map((r) => ({ ...r })));
  }

  rows(name: string): Row[] {
    return this.table(name);
  }

  reset() {
    this.tables.clear();
    this.ids.clear();
    this.rpcResults.clear();
    this.log = [];
    this.beforeUpdate = null;
    this.failures = [];
  }

  /** Makes the next matching statement fail once, like a database error would. */
  failOnce(op: 'insert' | 'update', table: string, message: string) {
    this.failures.push({ op, table, message });
  }

  takeFailure(op: 'insert' | 'update', table: string) {
    const idx = this.failures.findIndex((f) => f.op === op && f.table === table);
    if (idx < 0) return null;
    return this.failures.splice(idx, 1)[0];
  }

  nextId(table: string): string {
    const n = (this.ids.get(table) ?? 0) + 1;
    this.ids.set(table, n);
    return `${table}-${n}`;
  }

  client() {
    return {
      from: (table: string) => new FakeQuery(this, table),
      rpc: async (name: string, args?: Record<string, unknown>) => {
        if (this.rpcResults.has(name)) return this.rpcResults.get(name);
        return { data: null, error: null, args };
      },
    };
  }
}

export const fakeDb = new FakeSupabase();
