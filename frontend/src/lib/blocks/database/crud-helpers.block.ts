import type { BlockContext, BlockResult } from '../types';

export default function generate(_ctx: BlockContext): BlockResult {

  return {
    'src/lib/crud.ts': `import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

type TableName = keyof Database['public']['Tables'];
type Row<T extends TableName> = Database['public']['Tables'][T]['Row'];
type Insert<T extends TableName> = Database['public']['Tables'][T]['Insert'];
type Update<T extends TableName> = Database['public']['Tables'][T]['Update'];

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  ascending?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Get a single record by ID
 */
export async function getById<T extends TableName>(
  table: T,
  id: string
): Promise<Row<T> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error(\`[CRUD] getById(\${table}, \${id}) error:\`, error.message);
    return null;
  }

  return data as Row<T>;
}

/**
 * Get all records with optional pagination
 */
export async function getAll<T extends TableName>(
  table: T,
  options: PaginationOptions = {}
): Promise<PaginatedResult<Row<T>>> {
  const {
    page = 1,
    pageSize = 20,
    orderBy = 'created_at',
    ascending = false,
  } = options;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();

  // Get total count
  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  // Get paginated data
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order(orderBy, { ascending })
    .range(from, to);

  if (error) {
    console.error(\`[CRUD] getAll(\${table}) error:\`, error.message);
    return { data: [], count: 0, page, pageSize, totalPages: 0 };
  }

  const totalCount = count ?? 0;

  return {
    data: (data ?? []) as Row<T>[],
    count: totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  };
}

/**
 * Create a new record
 */
export async function create<T extends TableName>(
  table: T,
  record: Insert<T>
): Promise<Row<T> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .insert(record as any)
    .select()
    .single();

  if (error) {
    console.error(\`[CRUD] create(\${table}) error:\`, error.message);
    return null;
  }

  return data as Row<T>;
}

/**
 * Update an existing record by ID
 */
export async function update<T extends TableName>(
  table: T,
  id: string,
  updates: Update<T>
): Promise<Row<T> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .update(updates as any)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(\`[CRUD] update(\${table}, \${id}) error:\`, error.message);
    return null;
  }

  return data as Row<T>;
}

/**
 * Delete a record by ID
 */
export async function deleteById<T extends TableName>(
  table: T,
  id: string
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id);

  if (error) {
    console.error(\`[CRUD] deleteById(\${table}, \${id}) error:\`, error.message);
    return false;
  }

  return true;
}

/**
 * Get records by a specific column value
 */
export async function getByColumn<T extends TableName>(
  table: T,
  column: string,
  value: string | number | boolean,
  options: PaginationOptions = {}
): Promise<PaginatedResult<Row<T>>> {
  const {
    page = 1,
    pageSize = 20,
    orderBy = 'created_at',
    ascending = false,
  } = options;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();

  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column, value);

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq(column, value)
    .order(orderBy, { ascending })
    .range(from, to);

  if (error) {
    console.error(\`[CRUD] getByColumn(\${table}, \${column}) error:\`, error.message);
    return { data: [], count: 0, page, pageSize, totalPages: 0 };
  }

  const totalCount = count ?? 0;

  return {
    data: (data ?? []) as Row<T>[],
    count: totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  };
}
`,
  };
}
