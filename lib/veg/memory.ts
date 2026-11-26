/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server";

export type Col = { table: string; field: string };
export type Pred =
  | { op: "eq"; col: Col; value: unknown }
  | { op: "eqcol"; col: Col; other: Col }
  | { op: "in"; col: Col; value: unknown[] }
  | { op: "null"; col: Col }
  | { op: "and"; preds: Pred[] };

export function col(table: string, field: string): Col {
  return { table, field };
}
export function eq(column: Col, value: unknown): Pred {
  if (value && typeof value === "object" && "table" in (value as Col) && "field" in (value as Col)) {
    return { op: "eqcol", col: column, other: value as Col };
  }
  return { op: "eq", col: column, value };
}
export function inArray(column: Col, value: unknown[]): Pred {
  return { op: "in", col: column, value };
}
export function isNull(column: Col): Pred {
  return { op: "null", col: column };
}
export function and(...preds: Pred[]): Pred {
  return { op: "and", preds };
}

type TableDef = { _name: string; fields: Record<string, string>; booleans?: string[] };

export function table<const F extends Record<string, string>>(name: string, fields: F, booleans: string[] = []) {
  const cols = {} as { [K in keyof F]: Col };
  for (const field of Object.keys(fields) as (keyof F)[]) cols[field] = col(name, String(field));
  return { _name: name, fields, booleans, ...cols, _table: true as const };
}

export type TableRef = ReturnType<typeof table>;

type Row = Record<string, unknown>;
type Op =
  | { type: "insert"; table: string; row: Row }
  | { type: "update"; table: string; id: string; patch: Row }
  | { type: "delete"; table: string; ids: string[] }
  | { type: "settings"; row: Row }
  | { type: "override"; cropId: string; family: string };

function toCamelRow(def: TableDef, raw: Record<string, unknown>): Row {
  const row: Row = {};
  for (const [field, column] of Object.entries(def.fields)) {
    let value = raw[column];
    if (def.booleans?.includes(field)) value = value ? 1 : 0;
    row[field] = value ?? null;
  }
  return row;
}

function toSnake(def: TableDef, row: Row, farmId: string | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [field, column] of Object.entries(def.fields)) {
    if (!(field in row)) continue;
    let value = row[field];
    if (def.booleans?.includes(field)) value = value === 1 || value === true;
    if (value === undefined) continue;
    out[column] = value;
  }
  if (farmId && def.fields.farmId) out[def.fields.farmId] = farmId;
  return out;
}

function match(row: Row, pred: Pred | undefined, joined?: { row: Row; table: string }): boolean {
  if (!pred) return true;
  if (pred.op === "and") return pred.preds.every((item) => match(row, item, joined));
  const source = pred.col.table === joined?.table ? joined.row : row;
  const value = source[pred.col.field];
  if (pred.op === "eqcol") {
    const left = pred.col.table === joined?.table ? joined.row : row;
    const right = pred.other.table === joined?.table ? joined?.row : row;
    return left[pred.col.field] === right?.[pred.other.field];
  }
  if (pred.op === "eq") return value === pred.value;
  if (pred.op === "null") return value == null;
  if (!Array.isArray(pred.value) || pred.value.length === 0) return false;
  return pred.value.includes(value);
}

class Query {
  constructor(private db: FarmMemory) {}
  private table = "";
  private pred?: Pred;
  private projection?: Record<string, any>;
  private joins: { table: string; on: Pred; kind: "inner" | "left" }[] = [];
  private ordering?: Col;

  from(ref: { _name: string }) {
    this.table = ref._name;
    return this;
  }
  where(pred: Pred) {
    this.pred = pred;
    return this;
  }
  innerJoin(ref: { _name: string }, on: Pred) {
    this.joins.push({ table: ref._name, on, kind: "inner" });
    return this;
  }
  leftJoin(ref: { _name: string }, on: Pred) {
    this.joins.push({ table: ref._name, on, kind: "left" });
    return this;
  }
  orderBy(column: Col) {
    this.ordering = column;
    return this;
  }
  all(): any[] {
    let bags: Record<string, Row | null>[] = this.db
      .rows(this.table)
      .filter((row) => match(row, this.pred))
      .map((row) => ({ [this.table]: row }));
    for (const join of this.joins) {
      const next: Record<string, Row | null>[] = [];
      for (const bag of bags) {
        const primary = bag[this.table] as Row;
        const matches = this.db.rows(join.table).filter((candidate) => this.joinMatch(primary, bag, candidate, join));
        if (matches.length === 0) {
          if (join.kind === "left") next.push({ ...bag, [join.table]: null });
          continue;
        }
        for (const matchRow of matches) next.push({ ...bag, [join.table]: matchRow });
      }
      bags = next;
    }
    if (this.ordering) {
      const field = this.ordering.field;
      const table = this.ordering.table;
      bags.sort((a, b) => Number(a[table]?.[field] ?? 0) - Number(b[table]?.[field] ?? 0));
    }
    return bags.map((bag) => this.project(bag));
  }
  get(): any {
    return this.all()[0];
  }
  private joinMatch(primary: Row, bag: Record<string, Row | null>, candidate: Row, join: { table: string; on: Pred }): boolean {
    const pred = join.on;
    const check = (item: Pred): boolean => {
      if (item.op === "and") return item.preds.every(check);
      if (item.op === "eqcol") {
        const leftBag = item.col.table === join.table ? candidate : bag[item.col.table];
        const rightBag = item.other.table === join.table ? candidate : bag[item.other.table];
        return leftBag?.[item.col.field] === rightBag?.[item.other.field];
      }
      return match(primary, item, { row: candidate, table: join.table });
    };
    return check(pred);
  }
  private project(bag: Record<string, Row | null>): Row {
    const row = bag[this.table] as Row;
    if (!this.projection) return row;
    const out: Row = {};
    for (const [key, value] of Object.entries(this.projection)) {
      if (value && typeof value === "object" && "_table" in value) {
        out[key] = bag[(value as { _name: string })._name] ?? null;
      } else {
        const column = value as Col;
        out[key] = bag[column.table]?.[column.field] ?? null;
      }
    }
    return out;
  }
  select(projection?: Record<string, any>) {
    this.projection = projection;
    return this;
  }
}

export class FarmMemory {
  farmId: string;
  private data = new Map<string, Row[]>();
  private ops: Op[] = [];
  private defs: Map<string, TableDef>;

  constructor(farmId: string, defs: TableDef[]) {
    this.farmId = farmId;
    this.defs = new Map(defs.map((def) => [def._name, def]));
  }

  static async open(): Promise<FarmMemory | { error: string }> {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { error: "Sign in first." };
    const { data: farms } = await supabase.from("farms").select("id").eq("user_id", userData.user.id).order("created_at");
    let farmId = farms?.[0]?.id as string | undefined;
    if (!farmId) {
      const created = await supabase
        .from("farms")
        .insert({ user_id: userData.user.id, name: "Home garden", season_year: new Date().getFullYear() })
        .select("id")
        .single();
      if (created.error || !created.data) return { error: created.error?.message ?? "Could not start a garden." };
      farmId = created.data.id as string;
    }
    const db = new FarmMemory(farmId, DEFS);
    const loads = await Promise.all(
      DEFS.map(async (def) => {
        let query = supabase.from(def._name).select("*");
        if (def.fields.farmId && def._name !== "veg_crops" && def._name !== "veg_companions") {
          query = query.eq("farm_id", farmId);
        }
        if (def._name === "veg_crops" || def._name === "veg_companions") {
          query = query.or(`farm_id.is.null,farm_id.eq.${farmId}`);
        }
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return { name: def._name, rows: (data ?? []).map((row) => toCamelRow(def, row as Record<string, unknown>)) };
      }),
    );
    for (const load of loads) {
      if (load.name === "veg_farm_settings") {
        db.data.set(load.name, load.rows.map((row) => ({ ...row, id: "default" })));
      } else db.data.set(load.name, load.rows);
    }
    const overrides = await supabase.from("veg_crop_overrides").select("crop_id, rotation_family").eq("farm_id", farmId);
    for (const override of overrides.data ?? []) {
      const crop = db.rows("veg_crops").find((row) => row.id === override.crop_id);
      if (crop) crop.rotationFamily = override.rotation_family;
    }
    return db;
  }

  rows(name: string): Row[] {
    return this.data.get(name) ?? [];
  }

  select(projection?: Record<string, any>) {
    const query = new Query(this);
    if (projection) query.select(projection);
    return query;
  }

  selectDistinct(projection?: Record<string, any>) {
    return this.select(projection);
  }

  insert(ref: { _name: string }) {
    return {
      values: (row: Row) => ({
        run: () => {
          const stored = { ...row };
          this.rows(ref._name).push(stored);
          if (ref._name === "veg_farm_settings") this.ops.push({ type: "settings", row: stored });
          else this.ops.push({ type: "insert", table: ref._name, row: stored });
        },
        onConflictDoUpdate: ({ set }: { target: Col; set: Row }) => ({
          run: () => {
            const existing = this.rows(ref._name)[0];
            if (existing) Object.assign(existing, set);
            else this.rows(ref._name).push({ ...row, ...set, id: "default" });
            this.ops.push({ type: "settings", row: { ...(existing ?? row), ...set } });
          },
        }),
      }),
    };
  }

  update(ref: { _name: string }) {
    return {
      set: (patch: Row) => ({
        where: (pred: Pred) => ({
          run: () => {
            for (const row of this.rows(ref._name).filter((item) => match(item, pred))) {
              Object.assign(row, patch);
              if (ref._name === "veg_crops" && row.farmId == null && "rotationFamily" in patch) {
                this.ops.push({ type: "override", cropId: String(row.id), family: String(patch.rotationFamily) });
              } else if (ref._name === "veg_farm_settings") {
                this.ops.push({ type: "settings", row });
              } else if (row.farmId != null || ref._name !== "veg_crops") {
                this.ops.push({ type: "update", table: ref._name, id: String(row.id), patch });
              }
            }
          },
        }),
      }),
    };
  }

  delete(ref: { _name: string }) {
    return {
      where: (pred: Pred) => ({
        run: () => {
          const all = this.rows(ref._name);
          const gone = all.filter((row) => match(row, pred));
          this.data.set(ref._name, all.filter((row) => !match(row, pred)));
          const ids = gone.map((row) => String(row.id)).filter((id) => id && id !== "undefined");
          if (ref._name === "veg_planting_beds") {
            this.ops.push({ type: "delete", table: ref._name, ids: gone.map((row) => `${row.plantingId}:${row.bedId}`) });
          } else if (ids.length) this.ops.push({ type: "delete", table: ref._name, ids });
        },
      }),
    };
  }

  transaction<T>(fn: (tx: FarmMemory) => T): T {
    return fn(this);
  }

  async flush(supabase: Awaited<ReturnType<typeof createClient>>) {
    for (const op of this.ops) {
      if (op.type === "insert") {
        const def = this.defs.get(op.table)!;
        const payload = toSnake(def, op.row, this.farmId);
        if (op.table === "veg_crops" || op.table === "veg_companions") payload.farm_id = this.farmId;
        const { error } = await supabase.from(op.table).insert(payload);
        if (error) throw new Error(error.message);
      } else if (op.type === "update") {
        const def = this.defs.get(op.table)!;
        const payload = toSnake(def, op.patch, null);
        delete payload.id;
        delete payload.farm_id;
        const { error } = await supabase.from(op.table).update(payload).eq("id", op.id).eq("farm_id", this.farmId);
        if (error) throw new Error(error.message);
      } else if (op.type === "delete") {
        if (op.table === "veg_planting_beds") {
          for (const key of op.ids) {
            const [plantingId, bedId] = key.split(":");
            await supabase.from(op.table).delete().eq("planting_id", plantingId).eq("bed_id", bedId);
          }
        } else {
          const { error } = await supabase.from(op.table).delete().in("id", op.ids).eq("farm_id", this.farmId);
          if (error) throw new Error(error.message);
        }
      } else if (op.type === "settings") {
        const def = this.defs.get("veg_farm_settings")!;
        const payload = toSnake(def, op.row, this.farmId);
        payload.farm_id = this.farmId;
        delete payload.id;
        const { error } = await supabase.from("veg_farm_settings").upsert(payload);
        if (error) throw new Error(error.message);
      } else if (op.type === "override") {
        const { error } = await supabase.from("veg_crop_overrides").upsert({
          farm_id: this.farmId,
          crop_id: op.cropId,
          rotation_family: op.family,
        });
        if (error) throw new Error(error.message);
      }
    }
  }
}

const DEFS: TableDef[] = [];

let active: FarmMemory | null = null;

export function getDb(): FarmMemory {
  if (!active) throw new Error("Open a veg farm before saving.");
  return active;
}

export async function readFarm<T>(fn: () => T, empty: T): Promise<T> {
  const opened = await FarmMemory.open();
  if ("error" in opened) return empty;
  active = opened;
  try {
    return fn();
  } finally {
    active = null;
  }
}

export async function usingFarm<T>(fn: () => T): Promise<T> {
  const opened = await FarmMemory.open();
  if ("error" in opened) return { ok: false, error: opened.error } as T;
  const supabase = await createClient();
  active = opened;
  try {
    const result = fn();
    await opened.flush(supabase);
    return result;
  } finally {
    active = null;
  }
}

export function rememberDefs(defs: { _name: string; fields: Record<string, string>; booleans?: string[] }[]) {
  DEFS.splice(0, DEFS.length, ...defs);
}
