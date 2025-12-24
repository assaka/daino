import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Trash2, GripVertical, ChevronDown, ChevronUp,
  Mail, Clock, GitBranch, Tag, LogOut, Filter
} from 'lucide-react';

const STEP_ICONS = {
  send_email: Mail,
  delay: Clock,
  condition: GitBranch,
  split: GitBranch,
  add_tag: Tag,
  remove_tag: Tag,
  wait_for_event: Clock,
  exit: LogOut
};

const STEP_LABELS = {
  send_email: 'Send Email',
  delay: 'Wait / Delay',
  condition: 'If/Then Condition',
  split: 'A/B Split',
  add_tag: 'Add Tag',
  remove_tag: 'Remove Tag',
  wait_for_event: 'Wait for Event',
  exit: 'Exit Workflow'
};

const DEFAULT_STEP_TYPES = [
  { id: 'send_email', name: 'Send Email', value: 'send_email', category: 'action' },
  { id: 'delay', name: 'Wait / Delay', value: 'delay', category: 'flow' },
  { id: 'condition', name: 'If/Then Condition', value: 'condition', category: 'flow' },
  { id: 'add_tag', name: 'Add Tag', value: 'add_tag', category: 'action' },
  { id: 'remove_tag', name: 'Remove Tag', value: 'remove_tag', category: 'action' },
  { id: 'exit', name: 'Exit Workflow', value: 'exit', category: 'flow' }
];

export default function WorkflowCanvas({ steps = [], onChange, stepTypes = [] }) {
  const [expandedStep, setExpandedStep] = useState(null);
  const availableStepTypes = stepTypes.length > 0 ? stepTypes : DEFAULT_STEP_TYPES;

  const addStep = (afterIndex = -1) => {
    const newStep = {
      id: `step_${Date.now()}`,
      type: 'send_email',
      config: {}
    };

    const newSteps = [...steps];
    if (afterIndex === -1) {
      newSteps.push(newStep);
    } else {
      newSteps.splice(afterIndex + 1, 0, newStep);
    }

    onChange(newSteps);
    setExpandedStep(newStep.id);
  };

  const updateStep = (stepId, updates) => {
    const newSteps = steps.map(step =>
      step.id === stepId ? { ...step, ...updates } : step
    );
    onChange(newSteps);
  };

  const updateStepConfig = (stepId, configUpdates) => {
    const newSteps = steps.map(step =>
      step.id === stepId
        ? { ...step, config: { ...step.config, ...configUpdates } }
        : step
    );
    onChange(newSteps);
  };

  const removeStep = (stepId) => {
    const newSteps = steps.filter(step => step.id !== stepId);
    onChange(newSteps);
    if (expandedStep === stepId) {
      setExpandedStep(null);
    }
  };

  const moveStep = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= steps.length) return;

    const newSteps = [...steps];
    const [moved] = newSteps.splice(fromIndex, 1);
    newSteps.splice(toIndex, 0, moved);
    onChange(newSteps);
  };

  const renderStepConfig = (step, index) => {
    switch (step.type) {
      case 'send_email':
        return (
          <div className="space-y-3">
            <div>
              <Label>Email Template</Label>
              <Select
                value={step.config?.templateId || ''}
                onValueChange={(value) => updateStepConfig(step.id, { templateId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="welcome">Welcome Email</SelectItem>
                  <SelectItem value="abandoned_cart">Abandoned Cart Reminder</SelectItem>
                  <SelectItem value="order_confirmation">Order Confirmation</SelectItem>
                  <SelectItem value="review_request">Review Request</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject Line Override (optional)</Label>
              <Input
                value={step.config?.subject || ''}
                onChange={(e) => updateStepConfig(step.id, { subject: e.target.value })}
                placeholder="Leave empty to use template subject"
              />
            </div>
          </div>
        );

      case 'delay':
        return (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Duration</Label>
              <Input
                type="number"
                min="1"
                value={step.config?.duration || 1}
                onChange={(e) => updateStepConfig(step.id, { duration: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div>
              <Label>Unit</Label>
              <Select
                value={step.config?.unit || 'hours'}
                onValueChange={(value) => updateStepConfig(step.id, { unit: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                  <SelectItem value="weeks">Weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'condition':
        return (
          <div className="space-y-3">
            <div>
              <Label>Condition Type</Label>
              <Select
                value={step.config?.conditionType || 'property'}
                onValueChange={(value) => updateStepConfig(step.id, { conditionType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="property">Customer Property</SelectItem>
                  <SelectItem value="activity">Activity Based</SelectItem>
                  <SelectItem value="segment">In Segment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Property</Label>
              <Select
                value={step.config?.property || ''}
                onValueChange={(value) => updateStepConfig(step.id, { property: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select property..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total_orders">Total Orders</SelectItem>
                  <SelectItem value="total_spent">Total Spent</SelectItem>
                  <SelectItem value="email_opened">Opened Previous Email</SelectItem>
                  <SelectItem value="email_clicked">Clicked Previous Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Operator</Label>
                <Select
                  value={step.config?.operator || 'equals'}
                  onValueChange={(value) => updateStepConfig(step.id, { operator: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">Equals</SelectItem>
                    <SelectItem value="greater_than">Greater than</SelectItem>
                    <SelectItem value="less_than">Less than</SelectItem>
                    <SelectItem value="is_true">Is true</SelectItem>
                    <SelectItem value="is_false">Is false</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value</Label>
                <Input
                  value={step.config?.value || ''}
                  onChange={(e) => updateStepConfig(step.id, { value: e.target.value })}
                  placeholder="Enter value"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              If condition is TRUE: continue to next step. If FALSE: exit workflow.
            </p>
          </div>
        );

      case 'add_tag':
      case 'remove_tag':
        return (
          <div>
            <Label>Tag Name</Label>
            <Input
              value={step.config?.tag || ''}
              onChange={(e) => updateStepConfig(step.id, { tag: e.target.value })}
              placeholder="e.g., vip_customer"
            />
          </div>
        );

      case 'exit':
        return (
          <div>
            <Label>Exit Reason (optional)</Label>
            <Textarea
              value={step.config?.reason || ''}
              onChange={(e) => updateStepConfig(step.id, { reason: e.target.value })}
              placeholder="Why customers exit at this point..."
              rows={2}
            />
          </div>
        );

      default:
        return (
          <p className="text-sm text-gray-500 text-center py-4">
            No configuration needed for this step type
          </p>
        );
    }
  };

  const getStepIcon = (type) => {
    const Icon = STEP_ICONS[type] || Filter;
    return Icon;
  };

  return (
    <div className="space-y-2">
      {/* Start node */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <span>Trigger fires</span>
        <div className="flex-1 border-t border-dashed border-gray-300" />
      </div>

      {/* Steps */}
      {steps.map((step, index) => {
        const StepIcon = getStepIcon(step.type);
        const isExpanded = expandedStep === step.id;

        return (
          <div key={step.id}>
            {/* Connection line */}
            <div className="ml-4 h-4 border-l-2 border-dashed border-gray-300" />

            <div className={`border rounded-lg transition-all ${isExpanded ? 'border-indigo-300 bg-indigo-50' : 'bg-white'}`}>
              <div
                className="p-3 flex items-center gap-3 cursor-pointer"
                onClick={() => setExpandedStep(isExpanded ? null : step.id)}
              >
                <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />

                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                  <StepIcon className="w-4 h-4 text-indigo-600" />
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Step {index + 1}</span>
                    <span className="font-medium text-gray-900">
                      {STEP_LABELS[step.type] || step.type}
                    </span>
                  </div>
                  {step.config && Object.keys(step.config).length > 0 && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {step.type === 'delay' && step.config.duration && (
                        <span>Wait {step.config.duration} {step.config.unit || 'hours'}</span>
                      )}
                      {step.type === 'send_email' && step.config.templateId && (
                        <span>Template: {step.config.templateId}</span>
                      )}
                      {(step.type === 'add_tag' || step.type === 'remove_tag') && step.config.tag && (
                        <span>Tag: {step.config.tag}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); moveStep(index, index - 1); }}
                    disabled={index === 0}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); moveStep(index, index + 1); }}
                    disabled={index === steps.length - 1}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); removeStep(step.id); }}
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t p-4 space-y-4">
                  <div>
                    <Label>Step Type</Label>
                    <Select
                      value={step.type}
                      onValueChange={(value) => updateStep(step.id, { type: value, config: {} })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStepTypes.map(stepType => (
                          <SelectItem key={stepType.value} value={stepType.value}>
                            {stepType.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="border-t pt-4">
                    {renderStepConfig(step, index)}
                  </div>
                </div>
              )}
            </div>

            {/* Add step button after each step */}
            <div className="ml-4 flex items-center gap-2 my-1">
              <div className="h-4 border-l-2 border-dashed border-gray-300" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addStep(index)}
                className="h-6 text-xs text-gray-400 hover:text-indigo-600 p-0"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add step
              </Button>
            </div>
          </div>
        );
      })}

      {/* Add first step button */}
      {steps.length === 0 && (
        <Button
          type="button"
          variant="outline"
          onClick={() => addStep()}
          className="w-full border-dashed"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add First Step
        </Button>
      )}

      {/* End node */}
      {steps.length > 0 && (
        <>
          <div className="ml-4 h-4 border-l-2 border-dashed border-gray-300" />
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
            </div>
            <span>Workflow ends</span>
          </div>
        </>
      )}
    </div>
  );
}
