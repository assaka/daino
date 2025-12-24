import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical } from 'lucide-react';

const OPERATORS = {
  string: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'ends_with', label: 'ends with' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' }
  ],
  number: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'greater_than', label: 'greater than' },
    { value: 'less_than', label: 'less than' },
    { value: 'greater_than_or_equal', label: 'greater than or equal' },
    { value: 'less_than_or_equal', label: 'less than or equal' },
    { value: 'between', label: 'between' }
  ],
  date: [
    { value: 'equals', label: 'equals' },
    { value: 'before', label: 'before' },
    { value: 'after', label: 'after' },
    { value: 'between', label: 'between' },
    { value: 'in_last_days', label: 'in the last X days' },
    { value: 'not_in_last_days', label: 'not in the last X days' }
  ],
  boolean: [
    { value: 'equals', label: 'is' }
  ],
  select: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'in', label: 'is one of' },
    { value: 'not_in', label: 'is not one of' }
  ]
};

const DEFAULT_FIELDS = [
  { id: 'email', label: 'Email', type: 'string' },
  { id: 'first_name', label: 'First Name', type: 'string' },
  { id: 'last_name', label: 'Last Name', type: 'string' },
  { id: 'total_orders', label: 'Total Orders', type: 'number' },
  { id: 'total_spent', label: 'Total Spent', type: 'number' },
  { id: 'created_at', label: 'Customer Since', type: 'date' },
  { id: 'last_order_date', label: 'Last Order Date', type: 'date' },
  { id: 'is_active', label: 'Is Active', type: 'boolean' },
  { id: 'customer_type', label: 'Customer Type', type: 'select', options: ['registered', 'guest'] },
  { id: 'city', label: 'City', type: 'string' },
  { id: 'country', label: 'Country', type: 'string' },
  { id: 'rfm_segment', label: 'RFM Segment', type: 'select', options: [
    'champions', 'loyal_customers', 'potential_loyalists', 'new_customers',
    'promising', 'need_attention', 'about_to_sleep', 'at_risk',
    'cant_lose', 'hibernating', 'lost'
  ]}
];

export default function SegmentBuilder({ filters, onChange, availableFields = [] }) {
  const fields = availableFields.length > 0 ? availableFields : DEFAULT_FIELDS;

  const addCondition = () => {
    const newCondition = {
      id: `condition_${Date.now()}`,
      field: fields[0]?.id || 'email',
      operator: 'equals',
      value: ''
    };

    onChange({
      ...filters,
      conditions: [...(filters.conditions || []), newCondition]
    });
  };

  const updateCondition = (index, updates) => {
    const newConditions = [...(filters.conditions || [])];
    newConditions[index] = { ...newConditions[index], ...updates };

    // Reset value when field or operator changes
    if (updates.field || updates.operator) {
      if (updates.operator === 'is_empty' || updates.operator === 'is_not_empty') {
        newConditions[index].value = '';
      } else if (updates.operator === 'between') {
        newConditions[index].value = { min: '', max: '' };
      } else if (updates.field) {
        const field = fields.find(f => f.id === updates.field);
        if (field?.type === 'boolean') {
          newConditions[index].value = true;
        } else if (updates.field !== filters.conditions[index]?.field) {
          newConditions[index].value = '';
        }
      }
    }

    onChange({ ...filters, conditions: newConditions });
  };

  const removeCondition = (index) => {
    const newConditions = (filters.conditions || []).filter((_, i) => i !== index);
    onChange({ ...filters, conditions: newConditions });
  };

  const toggleLogic = () => {
    onChange({
      ...filters,
      logic: filters.logic === 'AND' ? 'OR' : 'AND'
    });
  };

  const getFieldType = (fieldId) => {
    const field = fields.find(f => f.id === fieldId);
    return field?.type || 'string';
  };

  const getFieldOptions = (fieldId) => {
    const field = fields.find(f => f.id === fieldId);
    return field?.options || [];
  };

  const getOperators = (fieldType) => {
    return OPERATORS[fieldType] || OPERATORS.string;
  };

  const renderValueInput = (condition, index) => {
    const fieldType = getFieldType(condition.field);
    const fieldOptions = getFieldOptions(condition.field);

    // No value needed for empty/not empty operators
    if (condition.operator === 'is_empty' || condition.operator === 'is_not_empty') {
      return null;
    }

    // Between operator needs two inputs
    if (condition.operator === 'between') {
      return (
        <div className="flex items-center gap-2">
          <Input
            type={fieldType === 'date' ? 'date' : 'number'}
            value={condition.value?.min || ''}
            onChange={(e) => updateCondition(index, {
              value: { ...condition.value, min: e.target.value }
            })}
            placeholder="Min"
            className="w-28"
          />
          <span className="text-gray-500">and</span>
          <Input
            type={fieldType === 'date' ? 'date' : 'number'}
            value={condition.value?.max || ''}
            onChange={(e) => updateCondition(index, {
              value: { ...condition.value, max: e.target.value }
            })}
            placeholder="Max"
            className="w-28"
          />
        </div>
      );
    }

    // In/not in operators need multi-select
    if ((condition.operator === 'in' || condition.operator === 'not_in') && fieldOptions.length > 0) {
      return (
        <Select
          value={Array.isArray(condition.value) ? condition.value[0] : condition.value}
          onValueChange={(value) => updateCondition(index, { value: [value] })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {fieldOptions.map(opt => (
              <SelectItem key={opt} value={opt}>
                {opt.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Boolean field
    if (fieldType === 'boolean') {
      return (
        <Select
          value={String(condition.value)}
          onValueChange={(value) => updateCondition(index, { value: value === 'true' })}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">True</SelectItem>
            <SelectItem value="false">False</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    // Select field with options
    if (fieldType === 'select' && fieldOptions.length > 0) {
      return (
        <Select
          value={condition.value || ''}
          onValueChange={(value) => updateCondition(index, { value })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {fieldOptions.map(opt => (
              <SelectItem key={opt} value={opt}>
                {opt.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Days input for in_last_days operators
    if (condition.operator === 'in_last_days' || condition.operator === 'not_in_last_days') {
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={condition.value || ''}
            onChange={(e) => updateCondition(index, { value: e.target.value })}
            placeholder="30"
            className="w-20"
            min="1"
          />
          <span className="text-gray-500">days</span>
        </div>
      );
    }

    // Date input
    if (fieldType === 'date') {
      return (
        <Input
          type="date"
          value={condition.value || ''}
          onChange={(e) => updateCondition(index, { value: e.target.value })}
          className="w-40"
        />
      );
    }

    // Number input
    if (fieldType === 'number') {
      return (
        <Input
          type="number"
          value={condition.value || ''}
          onChange={(e) => updateCondition(index, { value: e.target.value })}
          placeholder="0"
          className="w-32"
        />
      );
    }

    // Default: text input
    return (
      <Input
        type="text"
        value={condition.value || ''}
        onChange={(e) => updateCondition(index, { value: e.target.value })}
        placeholder="Enter value..."
        className="w-40"
      />
    );
  };

  const conditions = filters.conditions || [];

  return (
    <div className="space-y-4">
      {conditions.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Match</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleLogic}
            className="font-medium"
          >
            {filters.logic || 'AND'}
          </Button>
          <span className="text-sm text-gray-600">of the following conditions</span>
        </div>
      )}

      <div className="space-y-3">
        {conditions.map((condition, index) => (
          <div key={condition.id || index} className="flex items-center gap-2 bg-white p-3 rounded border">
            <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />

            <Select
              value={condition.field}
              onValueChange={(value) => updateCondition(index, { field: value })}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fields.map(field => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={condition.operator}
              onValueChange={(value) => updateCondition(index, { operator: value })}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getOperators(getFieldType(condition.field)).map(op => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {renderValueInput(condition, index)}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeCondition(index)}
              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 ml-auto"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addCondition}
        className="w-full border-dashed"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Condition
      </Button>

      {conditions.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">
          Add conditions to filter customers for this segment
        </p>
      )}
    </div>
  );
}
