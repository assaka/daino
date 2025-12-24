/**
 * Segment Service
 *
 * Handles customer segmentation with dynamic filter engine.
 * Supports various filter conditions for building customer segments.
 */

const CustomerSegment = require('../models/CustomerSegment');
const CustomerRfmScore = require('../models/CustomerRfmScore');
const ConnectionManager = require('./database/ConnectionManager');

class SegmentService {
  /**
   * Filter operators supported by the segment builder
   */
  static OPERATORS = {
    // Comparison
    EQUALS: 'equals',
    NOT_EQUALS: 'not_equals',
    GREATER_THAN: 'greater_than',
    LESS_THAN: 'less_than',
    GREATER_OR_EQUAL: 'greater_or_equal',
    LESS_OR_EQUAL: 'less_or_equal',

    // String
    CONTAINS: 'contains',
    NOT_CONTAINS: 'not_contains',
    STARTS_WITH: 'starts_with',
    ENDS_WITH: 'ends_with',

    // Date
    BEFORE: 'before',
    AFTER: 'after',
    BETWEEN: 'between',
    IN_LAST_DAYS: 'in_last_days',
    NOT_IN_LAST_DAYS: 'not_in_last_days',

    // Array/Set
    IN: 'in',
    NOT_IN: 'not_in',
    IS_EMPTY: 'is_empty',
    IS_NOT_EMPTY: 'is_not_empty',

    // Boolean
    IS_TRUE: 'is_true',
    IS_FALSE: 'is_false',

    // Null check
    IS_SET: 'is_set',
    IS_NOT_SET: 'is_not_set'
  };

  /**
   * Available filter fields for customer segmentation
   */
  static FILTER_FIELDS = {
    // Customer properties
    email: { type: 'string', table: 'customers' },
    first_name: { type: 'string', table: 'customers' },
    last_name: { type: 'string', table: 'customers' },
    phone: { type: 'string', table: 'customers' },
    total_spent: { type: 'number', table: 'customers' },
    total_orders: { type: 'number', table: 'customers' },
    last_order_date: { type: 'date', table: 'customers' },
    created_at: { type: 'date', table: 'customers' },
    is_active: { type: 'boolean', table: 'customers' },
    customer_type: { type: 'string', table: 'customers' },
    tags: { type: 'array', table: 'customers' },

    // RFM properties
    rfm_segment: { type: 'string', table: 'customer_rfm_scores' },
    rfm_score: { type: 'string', table: 'customer_rfm_scores' },
    recency_score: { type: 'number', table: 'customer_rfm_scores' },
    frequency_score: { type: 'number', table: 'customer_rfm_scores' },
    monetary_score: { type: 'number', table: 'customer_rfm_scores' },

    // Order history (computed)
    avg_order_value: { type: 'number', computed: true },
    days_since_last_order: { type: 'number', computed: true }
  };

  /**
   * Create a new segment
   */
  static async createSegment(storeId, segmentData) {
    return await CustomerSegment.create(storeId, segmentData);
  }

  /**
   * Update a segment
   */
  static async updateSegment(storeId, segmentId, updateData) {
    return await CustomerSegment.update(storeId, segmentId, updateData);
  }

  /**
   * Get segment by ID
   */
  static async getSegment(storeId, segmentId) {
    return await CustomerSegment.findById(storeId, segmentId);
  }

  /**
   * Get all segments for a store
   */
  static async getAllSegments(storeId, options = {}) {
    return await CustomerSegment.findAll(storeId, options);
  }

  /**
   * Delete a segment
   */
  static async deleteSegment(storeId, segmentId) {
    return await CustomerSegment.delete(storeId, segmentId);
  }

  /**
   * Preview segment - evaluate filters and return matching customer count
   */
  static async previewSegment(storeId, filters) {
    const customers = await this.evaluateFilters(storeId, filters);
    return {
      count: customers.length,
      sample: customers.slice(0, 10) // Return first 10 for preview
    };
  }

  /**
   * Calculate segment members based on filters
   */
  static async calculateSegmentMembers(storeId, segmentId) {
    const segment = await CustomerSegment.findById(storeId, segmentId);
    if (!segment) {
      throw new Error('Segment not found');
    }

    if (segment.segment_type === 'static') {
      // Static segments don't need recalculation
      return { count: segment.member_count };
    }

    // Dynamic segment - evaluate filters
    const customers = await this.evaluateFilters(storeId, segment.filters);

    // Clear existing members and add new ones
    await CustomerSegment.clearMembers(storeId, segmentId);

    if (customers.length > 0) {
      const customerIds = customers.map(c => c.id);
      await CustomerSegment.bulkAddMembers(storeId, segmentId, customerIds);
    }

    // Update member count
    await CustomerSegment.updateMemberCount(storeId, segmentId, customers.length);

    return { count: customers.length };
  }

  /**
   * Evaluate filters and return matching customers
   */
  static async evaluateFilters(storeId, filters) {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Build the base query
    let query = tenantDb
      .from('customers')
      .select(`
        customers.id,
        customers.email,
        customers.first_name,
        customers.last_name,
        customers.total_spent,
        customers.total_orders,
        customers.last_order_date,
        customers.created_at,
        customers.is_active,
        customers.customer_type,
        customers.tags
      `)
      .eq('customers.store_id', storeId);

    // Check if we need to join RFM table
    const needsRfmJoin = this.filtersNeedRfmJoin(filters);
    if (needsRfmJoin) {
      // Note: Supabase requires actual table joins or separate queries
      // For now, we'll handle RFM filters separately
    }

    // Apply filters
    query = this.applyFilters(query, filters);

    const { data, error } = await query;

    if (error) {
      console.error('[SegmentService] Error evaluating filters:', error);
      throw error;
    }

    let customers = data || [];

    // Apply RFM filters if needed (post-filter since Supabase join is limited)
    if (needsRfmJoin) {
      customers = await this.applyRfmFilters(storeId, customers, filters);
    }

    // Apply computed filters
    customers = this.applyComputedFilters(customers, filters);

    return customers;
  }

  /**
   * Check if filters need RFM table join
   */
  static filtersNeedRfmJoin(filters) {
    if (!filters || !filters.conditions) return false;

    const rfmFields = ['rfm_segment', 'rfm_score', 'recency_score', 'frequency_score', 'monetary_score'];

    return filters.conditions.some(condition => {
      if (rfmFields.includes(condition.field)) return true;
      if (condition.conditions) return this.filtersNeedRfmJoin(condition);
      return false;
    });
  }

  /**
   * Apply filters to query
   */
  static applyFilters(query, filters) {
    if (!filters || !filters.conditions || filters.conditions.length === 0) {
      return query;
    }

    const logic = filters.logic || 'AND';

    for (const condition of filters.conditions) {
      // Handle nested groups
      if (condition.conditions) {
        // Nested group - would need to use Supabase's .or() or complex logic
        // For now, skip nested groups and handle at app level
        continue;
      }

      const field = condition.field;
      const fieldInfo = this.FILTER_FIELDS[field];

      // Skip computed fields and RFM fields (handled separately)
      if (!fieldInfo || fieldInfo.computed || fieldInfo.table === 'customer_rfm_scores') {
        continue;
      }

      query = this.applyCondition(query, condition, fieldInfo);
    }

    return query;
  }

  /**
   * Apply a single condition to query
   */
  static applyCondition(query, condition, fieldInfo) {
    const { field, operator, value } = condition;
    const column = `customers.${field}`;

    switch (operator) {
      case this.OPERATORS.EQUALS:
        return query.eq(column, value);

      case this.OPERATORS.NOT_EQUALS:
        return query.neq(column, value);

      case this.OPERATORS.GREATER_THAN:
        return query.gt(column, value);

      case this.OPERATORS.LESS_THAN:
        return query.lt(column, value);

      case this.OPERATORS.GREATER_OR_EQUAL:
        return query.gte(column, value);

      case this.OPERATORS.LESS_OR_EQUAL:
        return query.lte(column, value);

      case this.OPERATORS.CONTAINS:
        return query.ilike(column, `%${value}%`);

      case this.OPERATORS.NOT_CONTAINS:
        return query.not(column, 'ilike', `%${value}%`);

      case this.OPERATORS.STARTS_WITH:
        return query.ilike(column, `${value}%`);

      case this.OPERATORS.ENDS_WITH:
        return query.ilike(column, `%${value}`);

      case this.OPERATORS.IN:
        return query.in(column, Array.isArray(value) ? value : [value]);

      case this.OPERATORS.NOT_IN:
        return query.not(column, 'in', `(${Array.isArray(value) ? value.join(',') : value})`);

      case this.OPERATORS.BEFORE:
        return query.lt(column, value);

      case this.OPERATORS.AFTER:
        return query.gt(column, value);

      case this.OPERATORS.BETWEEN:
        if (Array.isArray(value) && value.length === 2) {
          return query.gte(column, value[0]).lte(column, value[1]);
        }
        return query;

      case this.OPERATORS.IN_LAST_DAYS:
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - parseInt(value));
        return query.gte(column, sinceDate.toISOString());

      case this.OPERATORS.NOT_IN_LAST_DAYS:
        const beforeDate = new Date();
        beforeDate.setDate(beforeDate.getDate() - parseInt(value));
        return query.lt(column, beforeDate.toISOString());

      case this.OPERATORS.IS_TRUE:
        return query.eq(column, true);

      case this.OPERATORS.IS_FALSE:
        return query.eq(column, false);

      case this.OPERATORS.IS_SET:
        return query.not(column, 'is', null);

      case this.OPERATORS.IS_NOT_SET:
        return query.is(column, null);

      case this.OPERATORS.IS_EMPTY:
        if (fieldInfo.type === 'array') {
          return query.eq(column, '[]');
        }
        return query.or(`${column}.is.null,${column}.eq.`);

      case this.OPERATORS.IS_NOT_EMPTY:
        if (fieldInfo.type === 'array') {
          return query.neq(column, '[]');
        }
        return query.not(column, 'is', null).neq(column, '');

      default:
        return query;
    }
  }

  /**
   * Apply RFM filters (post-query filtering)
   */
  static async applyRfmFilters(storeId, customers, filters) {
    if (customers.length === 0) return customers;

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);
    const customerIds = customers.map(c => c.id);

    // Get RFM scores for these customers
    const { data: rfmScores } = await tenantDb
      .from('customer_rfm_scores')
      .select('*')
      .eq('store_id', storeId)
      .in('customer_id', customerIds);

    const rfmByCustomer = new Map((rfmScores || []).map(r => [r.customer_id, r]));

    // Filter customers based on RFM conditions
    return customers.filter(customer => {
      const rfm = rfmByCustomer.get(customer.id);

      for (const condition of filters.conditions || []) {
        const fieldInfo = this.FILTER_FIELDS[condition.field];
        if (!fieldInfo || fieldInfo.table !== 'customer_rfm_scores') continue;

        const value = rfm ? rfm[condition.field] : null;
        if (!this.evaluateCondition(value, condition.operator, condition.value, fieldInfo.type)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Apply computed filters (post-query filtering)
   */
  static applyComputedFilters(customers, filters) {
    if (!filters || !filters.conditions) return customers;

    const computedConditions = filters.conditions.filter(c => {
      const fieldInfo = this.FILTER_FIELDS[c.field];
      return fieldInfo && fieldInfo.computed;
    });

    if (computedConditions.length === 0) return customers;

    return customers.filter(customer => {
      for (const condition of computedConditions) {
        let value;

        switch (condition.field) {
          case 'avg_order_value':
            value = customer.total_orders > 0
              ? customer.total_spent / customer.total_orders
              : 0;
            break;

          case 'days_since_last_order':
            if (!customer.last_order_date) {
              value = null;
            } else {
              const lastOrder = new Date(customer.last_order_date);
              const now = new Date();
              value = Math.floor((now - lastOrder) / (1000 * 60 * 60 * 24));
            }
            break;

          default:
            continue;
        }

        const fieldInfo = this.FILTER_FIELDS[condition.field];
        if (!this.evaluateCondition(value, condition.operator, condition.value, fieldInfo.type)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Evaluate a single condition
   */
  static evaluateCondition(value, operator, targetValue, type) {
    switch (operator) {
      case this.OPERATORS.EQUALS:
        return value === targetValue;

      case this.OPERATORS.NOT_EQUALS:
        return value !== targetValue;

      case this.OPERATORS.GREATER_THAN:
        return value > targetValue;

      case this.OPERATORS.LESS_THAN:
        return value < targetValue;

      case this.OPERATORS.GREATER_OR_EQUAL:
        return value >= targetValue;

      case this.OPERATORS.LESS_OR_EQUAL:
        return value <= targetValue;

      case this.OPERATORS.CONTAINS:
        return typeof value === 'string' && value.toLowerCase().includes(targetValue.toLowerCase());

      case this.OPERATORS.IN:
        return Array.isArray(targetValue) ? targetValue.includes(value) : value === targetValue;

      case this.OPERATORS.IS_SET:
        return value !== null && value !== undefined;

      case this.OPERATORS.IS_NOT_SET:
        return value === null || value === undefined;

      case this.OPERATORS.IS_TRUE:
        return value === true;

      case this.OPERATORS.IS_FALSE:
        return value === false;

      default:
        return true;
    }
  }

  /**
   * Get segment members
   */
  static async getSegmentMembers(storeId, segmentId, options = {}) {
    return await CustomerSegment.getMembers(storeId, segmentId, options);
  }

  /**
   * Add customer to static segment
   */
  static async addToSegment(storeId, segmentId, customerId) {
    const segment = await CustomerSegment.findById(storeId, segmentId);
    if (!segment) {
      throw new Error('Segment not found');
    }
    if (segment.segment_type !== 'static') {
      throw new Error('Cannot manually add to dynamic segment');
    }

    await CustomerSegment.addMember(storeId, segmentId, customerId);

    // Update count
    const members = await CustomerSegment.getMembers(storeId, segmentId, { limit: 1 });
    // This is a simplified count update - in production, use a proper count query
  }

  /**
   * Remove customer from static segment
   */
  static async removeFromSegment(storeId, segmentId, customerId) {
    const segment = await CustomerSegment.findById(storeId, segmentId);
    if (!segment) {
      throw new Error('Segment not found');
    }
    if (segment.segment_type !== 'static') {
      throw new Error('Cannot manually remove from dynamic segment');
    }

    await CustomerSegment.removeMember(storeId, segmentId, customerId);
  }

  /**
   * Get customers in segment for email campaign
   */
  static async getSegmentCustomersForCampaign(storeId, segmentId) {
    const segment = await CustomerSegment.findById(storeId, segmentId);
    if (!segment) {
      throw new Error('Segment not found');
    }

    if (segment.segment_type === 'static') {
      // Get from membership table
      const members = await CustomerSegment.getMembers(storeId, segmentId);
      return members.map(m => m.customers).filter(Boolean);
    } else {
      // Re-evaluate dynamic segment
      return await this.evaluateFilters(storeId, segment.filters);
    }
  }

  /**
   * Create predefined segments
   */
  static async createPredefinedSegments(storeId) {
    const predefinedSegments = [
      {
        name: 'Champions',
        description: 'Best customers with high RFM scores',
        segmentType: 'dynamic',
        filters: {
          logic: 'AND',
          conditions: [
            { field: 'rfm_segment', operator: 'equals', value: 'champions' }
          ]
        }
      },
      {
        name: 'At Risk',
        description: 'Good customers who haven\'t purchased recently',
        segmentType: 'dynamic',
        filters: {
          logic: 'AND',
          conditions: [
            { field: 'rfm_segment', operator: 'equals', value: 'at_risk' }
          ]
        }
      },
      {
        name: 'New Customers',
        description: 'Customers who signed up in the last 30 days',
        segmentType: 'dynamic',
        filters: {
          logic: 'AND',
          conditions: [
            { field: 'created_at', operator: 'in_last_days', value: 30 }
          ]
        }
      },
      {
        name: 'High Spenders',
        description: 'Customers with total spent over $500',
        segmentType: 'dynamic',
        filters: {
          logic: 'AND',
          conditions: [
            { field: 'total_spent', operator: 'greater_than', value: 500 }
          ]
        }
      },
      {
        name: 'Inactive Customers',
        description: 'Customers who haven\'t ordered in 90+ days',
        segmentType: 'dynamic',
        filters: {
          logic: 'AND',
          conditions: [
            { field: 'days_since_last_order', operator: 'greater_than', value: 90 },
            { field: 'total_orders', operator: 'greater_than', value: 0 }
          ]
        }
      }
    ];

    const created = [];
    for (const segmentData of predefinedSegments) {
      try {
        const segment = await CustomerSegment.create(storeId, segmentData);
        created.push(segment);
      } catch (error) {
        console.error(`[SegmentService] Error creating predefined segment ${segmentData.name}:`, error.message);
      }
    }

    return created;
  }

  /**
   * Get available filter fields for segment builder
   */
  static getAvailableFields() {
    return Object.entries(this.FILTER_FIELDS).map(([key, info]) => ({
      field: key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      type: info.type,
      computed: info.computed || false
    }));
  }

  /**
   * Get available operators for a field type
   */
  static getOperatorsForFieldType(type) {
    const operators = [];

    // Common operators
    operators.push(
      { value: this.OPERATORS.IS_SET, label: 'Is set' },
      { value: this.OPERATORS.IS_NOT_SET, label: 'Is not set' }
    );

    switch (type) {
      case 'string':
        operators.push(
          { value: this.OPERATORS.EQUALS, label: 'Equals' },
          { value: this.OPERATORS.NOT_EQUALS, label: 'Does not equal' },
          { value: this.OPERATORS.CONTAINS, label: 'Contains' },
          { value: this.OPERATORS.NOT_CONTAINS, label: 'Does not contain' },
          { value: this.OPERATORS.STARTS_WITH, label: 'Starts with' },
          { value: this.OPERATORS.ENDS_WITH, label: 'Ends with' },
          { value: this.OPERATORS.IN, label: 'Is one of' },
          { value: this.OPERATORS.NOT_IN, label: 'Is not one of' }
        );
        break;

      case 'number':
        operators.push(
          { value: this.OPERATORS.EQUALS, label: 'Equals' },
          { value: this.OPERATORS.NOT_EQUALS, label: 'Does not equal' },
          { value: this.OPERATORS.GREATER_THAN, label: 'Greater than' },
          { value: this.OPERATORS.LESS_THAN, label: 'Less than' },
          { value: this.OPERATORS.GREATER_OR_EQUAL, label: 'Greater than or equal' },
          { value: this.OPERATORS.LESS_OR_EQUAL, label: 'Less than or equal' },
          { value: this.OPERATORS.BETWEEN, label: 'Between' }
        );
        break;

      case 'date':
        operators.push(
          { value: this.OPERATORS.EQUALS, label: 'Equals' },
          { value: this.OPERATORS.BEFORE, label: 'Before' },
          { value: this.OPERATORS.AFTER, label: 'After' },
          { value: this.OPERATORS.BETWEEN, label: 'Between' },
          { value: this.OPERATORS.IN_LAST_DAYS, label: 'In the last X days' },
          { value: this.OPERATORS.NOT_IN_LAST_DAYS, label: 'Not in the last X days' }
        );
        break;

      case 'boolean':
        operators.push(
          { value: this.OPERATORS.IS_TRUE, label: 'Is true' },
          { value: this.OPERATORS.IS_FALSE, label: 'Is false' }
        );
        break;

      case 'array':
        operators.push(
          { value: this.OPERATORS.CONTAINS, label: 'Contains' },
          { value: this.OPERATORS.NOT_CONTAINS, label: 'Does not contain' },
          { value: this.OPERATORS.IS_EMPTY, label: 'Is empty' },
          { value: this.OPERATORS.IS_NOT_EMPTY, label: 'Is not empty' }
        );
        break;
    }

    return operators;
  }
}

module.exports = SegmentService;
