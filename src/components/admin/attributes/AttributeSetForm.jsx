import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

export default function AttributeSetForm({ attributeSet, attributes, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    attribute_ids: [],
    is_default: false,
    sort_order: 0
  });
  const [allSelected, setAllSelected] = useState(false);

  useEffect(() => {
    if (attributeSet) {
      setFormData({
        id: attributeSet.id,
        name: attributeSet.name || '',
        description: attributeSet.description || '',
        attribute_ids: attributeSet.attribute_ids || [],
        is_default: attributeSet.is_default || false,
        sort_order: attributeSet.sort_order || 0
      });
    }
  }, [attributeSet]);

  useEffect(() => {
    const allAttributeIds = attributes.map(attr => attr.id);
    setAllSelected(allAttributeIds.length > 0 && allAttributeIds.every(id => formData.attribute_ids.includes(id)));
  }, [formData.attribute_ids, attributes]);

  const handleSelectAll = () => {
    if (allSelected) {
      setFormData(prev => ({ ...prev, attribute_ids: [] }));
    } else {
      setFormData(prev => ({ ...prev, attribute_ids: attributes.map(attr => attr.id) }));
    }
  };

  const handleAttributeChange = (attributeId, checked) => {
    setFormData(prev => ({
      ...prev,
      attribute_ids: checked 
        ? [...prev.attribute_ids, attributeId]
        : prev.attribute_ids.filter(id => id !== attributeId)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>
        <div>
          <Label htmlFor="sort_order">Sort Order</Label>
          <Input
            id="sort_order"
            type="number"
            value={formData.sort_order}
            onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          rows={3}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_default"
          checked={formData.is_default}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_default: checked }))}
        />
        <Label htmlFor="is_default">Set as default attribute set</Label>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <Label>Choose which attributes belong to this set</Label>
          {attributes.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto border rounded-lg p-4">
          {attributes.length === 0 ? (
            <div className="col-span-2 text-center text-gray-500 py-8">
              No Attributes created yet
            </div>
          ) : (
            attributes.map(attribute => (
              <div key={attribute.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`attr-${attribute.id}`}
                  checked={formData.attribute_ids.includes(attribute.id)}
                  onCheckedChange={(checked) => handleAttributeChange(attribute.id, checked)}
                />
                <Label htmlFor={`attr-${attribute.id}`} className="flex-1">
                  {attribute.name}
                  <Badge variant="outline" className="ml-2 text-xs">
                    {attribute.type}
                  </Badge>
                </Label>
              </div>
            ))
          )}
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Selected: {formData.attribute_ids.length} of {attributes.length} attributes
        </p>
      </div>

      <div className="flex justify-end space-x-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {attributeSet ? 'Update' : 'Create'} Attribute Set
        </Button>
      </div>
    </form>
  );
}