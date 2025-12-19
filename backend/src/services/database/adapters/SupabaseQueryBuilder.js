/**
 * SupabaseQueryBuilder - Wraps Supabase query methods with generic interface
 *
 * This wrapper allows routes to use a generic query API that could be swapped
 * for other database query builders (Knex, Prisma, etc.) in the future.
 */

class SupabaseQueryBuilder {
  constructor(supabaseQuery) {
    this.query = supabaseQuery;
  }

  // SELECT
  select(columns = '*', options = {}) {
    this.query = this.query.select(columns, options);
    return this;
  }

  // FILTERING
  eq(column, value) {
    this.query = this.query.eq(column, value);
    return this;
  }

  neq(column, value) {
    this.query = this.query.neq(column, value);
    return this;
  }

  gt(column, value) {
    this.query = this.query.gt(column, value);
    return this;
  }

  gte(column, value) {
    this.query = this.query.gte(column, value);
    return this;
  }

  lt(column, value) {
    this.query = this.query.lt(column, value);
    return this;
  }

  lte(column, value) {
    this.query = this.query.lte(column, value);
    return this;
  }

  like(column, pattern) {
    this.query = this.query.like(column, pattern);
    return this;
  }

  ilike(column, pattern) {
    this.query = this.query.ilike(column, pattern);
    return this;
  }

  in(column, values) {
    this.query = this.query.in(column, values);
    return this;
  }

  is(column, value) {
    this.query = this.query.is(column, value);
    return this;
  }

  not(column, operator, value) {
    this.query = this.query.not(column, operator, value);
    return this;
  }

  or(filters) {
    this.query = this.query.or(filters);
    return this;
  }

  // JSONB contains (for array fields like category_ids)
  contains(column, value) {
    this.query = this.query.contains(column, value);
    return this;
  }

  // JSONB containedBy
  containedBy(column, value) {
    this.query = this.query.containedBy(column, value);
    return this;
  }

  // COMPATIBILITY: Support Knex-style where() method
  where(conditions) {
    // Convert { col1: val1, col2: val2 } to chained .eq() calls
    for (const [column, value] of Object.entries(conditions)) {
      this.query = this.query.eq(column, value);
    }
    return this;
  }

  // COMPATIBILITY: Support Knex-style first() method
  async first() {
    const { data, error } = await this.query.maybeSingle();
    return data; // Return data directly like Knex does
  }

  // ORDERING
  order(column, options = { ascending: true }) {
    this.query = this.query.order(column, options);
    return this;
  }

  // PAGINATION
  range(from, to) {
    this.query = this.query.range(from, to);
    return this;
  }

  limit(count) {
    this.query = this.query.limit(count);
    return this;
  }

  // INSERT
  insert(data, options = {}) {
    this.query = this.query.insert(data, options);
    return this;
  }

  // UPDATE
  update(data, options = {}) {
    this.query = this.query.update(data, options);
    return this;
  }

  // UPSERT
  upsert(data, options = {}) {
    this.query = this.query.upsert(data, options);
    return this;
  }

  // DELETE
  delete(options = {}) {
    this.query = this.query.delete(options);
    return this;
  }

  // EXECUTION
  async single() {
    const { data, error, count } = await this.query.single();
    return { data, error, count };
  }

  async maybeSingle() {
    const { data, error, count } = await this.query.maybeSingle();
    return { data, error, count };
  }

  // Execute query and return results
  async execute() {
    const { data, error, count } = await this.query;
    return { data, error, count };
  }

  // Alias for execute (for compatibility)
  async then(resolve, reject) {
    try {
      const result = await this.query;
      resolve(result);
    } catch (error) {
      reject(error);
    }
  }
}

module.exports = SupabaseQueryBuilder;
