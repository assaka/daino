import React, { useState, useEffect } from "react";
import apiClient from "@/api/client";
import {
  RefreshCw,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Award
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

export default function SuperAdminAffiliateTiers() {
  const { toast } = useToast();
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    commission_type: 'percentage',
    commission_rate: 0.10,
    min_payout_amount: 50,
    is_default: false,
    is_active: true
  });

  useEffect(() => {
    loadTiers();
  }, []);

  const loadTiers = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/superadmin/affiliate-tiers');
      if (response?.success) {
        setTiers(response.data?.tiers || []);
      } else {
        throw new Error(response?.error || 'Failed to load tiers');
      }
    } catch (error) {
      toast({
        title: "Error loading tiers",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setSelectedTier(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      commission_type: 'percentage',
      commission_rate: 0.10,
      min_payout_amount: 50,
      is_default: false,
      is_active: true
    });
    setDialogOpen(true);
  };

  const openEditDialog = (tier) => {
    setSelectedTier(tier);
    setFormData({
      name: tier.name,
      code: tier.code,
      description: tier.description || '',
      commission_type: tier.commission_type,
      commission_rate: tier.commission_rate,
      min_payout_amount: tier.min_payout_amount,
      is_default: tier.is_default,
      is_active: tier.is_active
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (tier) => {
    setSelectedTier(tier);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let response;
      if (selectedTier) {
        response = await apiClient.put(`/superadmin/affiliate-tiers/${selectedTier.id}`, formData);
      } else {
        response = await apiClient.post('/superadmin/affiliate-tiers', formData);
      }

      if (response?.success) {
        toast({ title: selectedTier ? "Tier updated" : "Tier created" });
        setDialogOpen(false);
        loadTiers();
      } else {
        throw new Error(response?.error || 'Failed to save tier');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      const response = await apiClient.delete(`/superadmin/affiliate-tiers/${selectedTier.id}`);
      if (response?.success) {
        toast({ title: "Tier deleted" });
        setDeleteDialogOpen(false);
        loadTiers();
      } else {
        throw new Error(response?.error || 'Failed to delete tier');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const formatRate = (tier) => {
    if (tier.commission_type === 'percentage') {
      return `${(tier.commission_rate * 100).toFixed(0)}%`;
    }
    return `$${tier.commission_rate.toFixed(2)}`;
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Affiliate Tiers</h1>
          <p className="text-sm sm:text-base text-gray-500">Configure commission tiers for affiliates</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <Button variant="outline" onClick={loadTiers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Tier
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead className="hidden sm:table-cell">Min Payout</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : tiers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No tiers configured. Create your first tier.
                  </TableCell>
                </TableRow>
              ) : (
                tiers.map((tier) => (
                  <TableRow key={tier.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{tier.name}</span>
                        {tier.is_default && (
                          <Badge variant="secondary" className="text-xs">Default</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">{tier.code}</code>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-green-600">{formatRate(tier)}</span>
                      <span className="text-xs text-gray-400 ml-1">
                        ({tier.commission_type})
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      ${tier.min_payout_amount}
                    </TableCell>
                    <TableCell>
                      {tier.is_active ? (
                        <Badge className="bg-green-500">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(tier)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(tier)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedTier ? 'Edit Tier' : 'Create Tier'}</DialogTitle>
            <DialogDescription>
              {selectedTier ? 'Update the tier settings' : 'Add a new commission tier'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Gold"
              />
            </div>

            <div className="space-y-2">
              <Label>Code</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                placeholder="e.g., gold"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description of this tier..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Commission Type</Label>
                <Select
                  value={formData.commission_type}
                  onValueChange={(value) => setFormData({ ...formData, commission_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  {formData.commission_type === 'percentage' ? 'Rate (%)' : 'Amount ($)'}
                </Label>
                <Input
                  type="number"
                  step={formData.commission_type === 'percentage' ? '0.01' : '0.50'}
                  value={formData.commission_type === 'percentage'
                    ? (formData.commission_rate * 100)
                    : formData.commission_rate}
                  onChange={(e) => setFormData({
                    ...formData,
                    commission_rate: formData.commission_type === 'percentage'
                      ? parseFloat(e.target.value) / 100
                      : parseFloat(e.target.value)
                  })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Minimum Payout Amount ($)</Label>
              <Input
                type="number"
                value={formData.min_payout_amount}
                onChange={(e) => setFormData({ ...formData, min_payout_amount: parseFloat(e.target.value) })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Default Tier</Label>
              <Switch
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.name || !formData.code}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedTier ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tier</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedTier?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
