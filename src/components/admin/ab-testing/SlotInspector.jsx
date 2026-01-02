import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Copy, Check, Search, Eye, Code } from 'lucide-react';
import FlashMessage from '@/components/storefront/FlashMessage';

/**
 * Slot Inspector - Shows all available slots on a page
 * Helps users discover slot IDs for A/B testing
 */
export default function SlotInspector({ storeId, onSelectSlot }) {
  const [selectedPageType, setSelectedPageType] = useState('product');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedText, setCopiedText] = useState(null);
  const [flashMessage, setFlashMessage] = useState(null);

  const pageTypes = [
    { value: 'home', label: 'Homepage' },
    { value: 'product', label: 'Product Page' },
    { value: 'category', label: 'Category Page' },
    { value: 'cart', label: 'Cart Page' },
    { value: 'checkout', label: 'Checkout Page' },
    { value: 'header', label: 'Header' },
    { value: 'footer', label: 'Footer' },
  ];

  // Fetch published slot configuration for selected page
  const { data: configData, isLoading } = useQuery({
    queryKey: ['slot-config', storeId, selectedPageType],
    queryFn: async () => {
      const response = await apiClient.get(
        `slot-configurations/published/${storeId}/${selectedPageType}`
      );
      return response.data;
    },
    enabled: !!storeId && !!selectedPageType,
  });

  const slots = configData?.configuration?.slots || {};

  // Convert slots object to array and filter by search
  const slotArray = Object.entries(slots)
    .map(([id, slot]) => ({
      id,
      ...slot,
    }))
    .filter(slot => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        slot.id.toLowerCase().includes(search) ||
        slot.type?.toLowerCase().includes(search) ||
        slot.component?.toLowerCase().includes(search) ||
        slot.content?.toLowerCase().includes(search)
      );
    });

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setFlashMessage({ type: 'success', message: 'Copied to clipboard!' });
    setTimeout(() => setCopiedText(null), 2000);
  };

  const copySlotOverrideTemplate = (slot) => {
    const template = {
      [slot.id]: {
        content: slot.content || 'New content',
        styles: slot.styles || {},
        className: slot.className || '',
        component: slot.component || null,
      }
    };
    navigator.clipboard.writeText(JSON.stringify(template, null, 2));
    setFlashMessage({ type: 'success', message: 'Slot override template copied!' });
  };

  const getSlotTypeColor = (type) => {
    const colors = {
      button: 'bg-blue-100 text-blue-800',
      text: 'bg-gray-100 text-gray-800',
      image: 'bg-purple-100 text-purple-800',
      component: 'bg-green-100 text-green-800',
      container: 'bg-orange-100 text-orange-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-4">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Slot Inspector
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Discover available slot IDs for A/B testing. Click any slot to use it in your test.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Page Type Selector */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Page Type</label>
              <Select value={selectedPageType} onValueChange={setSelectedPageType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageTypes.map((page) => (
                    <SelectItem key={page.value} value={page.value}>
                      {page.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Search Slots</label>
              <Input
                placeholder="Search by ID, type, or content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Slot Count */}
          <div className="text-sm text-muted-foreground">
            Found {slotArray.length} slots on {pageTypes.find(p => p.value === selectedPageType)?.label}
          </div>

          {/* Slots Table */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading slots...</div>
          ) : slotArray.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No slots found. This page might not have a published configuration yet.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Slot ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Component</TableHead>
                    <TableHead>Content Preview</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slotArray.map((slot) => (
                    <TableRow key={slot.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {slot.id}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(slot.id)}
                          >
                            {copiedText === slot.id ? (
                              <Check className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getSlotTypeColor(slot.type)}>
                          {slot.type || 'unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {slot.component ? (
                          <code className="text-xs">{slot.component}</code>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate text-sm text-muted-foreground">
                          {slot.content || slot.props?.text || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copySlotOverrideTemplate(slot)}
                          >
                            <Code className="w-4 h-4 mr-1" />
                            Copy Template
                          </Button>
                          {onSelectSlot && (
                            <Button
                              size="sm"
                              onClick={() => onSelectSlot(slot)}
                            >
                              Use in Test
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Help Text */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <h4 className="font-semibold text-sm mb-2">💡 How to use:</h4>
              <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                <li>Find the slot you want to test (e.g., "add_to_cart_button")</li>
                <li>Click "Copy Template" to get the override JSON</li>
                <li>In your A/B test variant, paste into the "Advanced Configuration" section</li>
                <li>Modify the content, styles, or properties</li>
                <li>Save and start the test - changes apply automatically!</li>
              </ol>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
