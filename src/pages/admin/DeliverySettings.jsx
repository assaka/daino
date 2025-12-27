
import React, { useState, useEffect } from "react";
import { DeliverySettings as DeliverySettingsEntity } from "@/api/entities";
import { Store } from "@/api/entities";
import { User } from "@/api/entities"; // New import for user authentication
import { useStoreSelection } from "@/contexts/StoreSelectionContext.jsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, Settings, Plus, Trash2 } from "lucide-react";
import FlashMessage from "@/components/storefront/FlashMessage";
import SaveButton from '@/components/ui/save-button';
import { PageLoader } from "@/components/ui/page-loader";

export default function DeliverySettings() { // Renamed the function component from DeliverySettingsPage
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const [deliverySettings, setDeliverySettings] = useState(null); // Changed state variable name, initialized to null
  const [store, setStore] = useState(null); // Tracks the current user's store, initialized to null
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [flashMessage, setFlashMessage] = useState(null);
  const [newBlockedDate, setNewBlockedDate] = useState('');

  useEffect(() => {
    if (selectedStore) {
      loadDeliverySettings(); // Call the refactored data loading function
    }
  }, [selectedStore]);

  const loadDeliverySettings = async () => {
    try {
      setLoading(true);
      
      const storeId = getSelectedStoreId();
      if (!storeId) {
        console.warn("No store selected");
        setLoading(false);
        return;
      }

      setStore(selectedStore);
      // Filter delivery settings by this specific store's ID
      const existingSettings = await DeliverySettingsEntity.filter({ store_id: storeId });
      
      if (existingSettings && existingSettings.length > 0) {
        setDeliverySettings(existingSettings[0]);
      } else {
        // If no settings exist for this store, create and set default ones
        const defaultSettings = {
          store_id: storeId,
          enable_delivery_date: true,
          enable_comments: true,
          offset_days: 1,
          max_advance_days: 30,
          blocked_dates: [],
          blocked_weekdays: [],
          out_of_office_start: null,
          out_of_office_end: null,
          delivery_time_slots: [
            { start_time: '09:00', end_time: '12:00', is_active: true },
            { start_time: '13:00', end_time: '17:00', is_active: true }
          ]
        };
        setDeliverySettings(defaultSettings);
      }
    } catch (error) {
      console.error("Error loading delivery settings:", error);
      setFlashMessage({ type: 'error', message: 'Failed to load settings.' });
      setStore(null);
      setDeliverySettings(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => { // Renamed from handleSubmit
    e.preventDefault();
    if (!store || !deliverySettings) {
      setFlashMessage({ type: 'error', message: 'Cannot save: No store or settings data available.' });
      return;
    }

    setSaving(true);
    setSaveSuccess(false);
    try {
      // Ensure store_id is correctly set on the settings object before saving
      // Clean up empty date strings
      const settingsToSave = { 
        ...deliverySettings, 
        store_id: store.id,
        out_of_office_start: deliverySettings.out_of_office_start || null,
        out_of_office_end: deliverySettings.out_of_office_end || null
      };

      let result;
      if (deliverySettings.id) {
        // If deliverySettings already has an ID, it means it exists in the DB, so update
        result = await DeliverySettingsEntity.update(deliverySettings.id, settingsToSave);
      } else {
        // Otherwise, it's a new set of settings for this store, so create
        result = await DeliverySettingsEntity.create(settingsToSave);
        // Update state with the created record (to get the new ID)
        if (result) {
          setDeliverySettings({ ...settingsToSave, id: result.id || result[0]?.id });
        }
      }

      // Clear any potential cache
      try {
        localStorage.removeItem('storeProviderCache');
        sessionStorage.removeItem('storeProviderCache');
      } catch (e) {
        console.warn('Failed to clear cache:', e);
      }

      setFlashMessage({ type: 'success', message: 'Delivery settings saved successfully!' });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error("Error saving delivery settings:", error);
      setFlashMessage({ type: 'error', message: 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleWeekdayToggle = (day) => {
    setDeliverySettings(prev => ({ // Updated to use setDeliverySettings
      ...prev,
      blocked_weekdays: prev.blocked_weekdays.includes(day)
        ? prev.blocked_weekdays.filter(d => d !== day)
        : [...prev.blocked_weekdays, day]
    }));
  };

  const addBlockedDate = () => {
    if (newBlockedDate && deliverySettings && !deliverySettings.blocked_dates.includes(newBlockedDate)) { // Added check for deliverySettings
      setDeliverySettings(prev => ({ // Updated to use setDeliverySettings
        ...prev,
        blocked_dates: [...prev.blocked_dates, newBlockedDate]
      }));
      setNewBlockedDate('');
    }
  };

  const removeBlockedDate = (date) => {
    setDeliverySettings(prev => ({ // Updated to use setDeliverySettings
      ...prev,
      blocked_dates: prev.blocked_dates.filter(d => d !== date)
    }));
  };

  const addTimeSlot = () => {
    setDeliverySettings(prev => ({ // Updated to use setDeliverySettings
      ...prev,
      delivery_time_slots: [
        ...prev.delivery_time_slots,
        { start_time: '09:00', end_time: '17:00', is_active: true }
      ]
    }));
  };

  const updateTimeSlot = (index, field, value) => {
    setDeliverySettings(prev => ({ // Updated to use setDeliverySettings
      ...prev,
      delivery_time_slots: prev.delivery_time_slots.map((slot, i) =>
        i === index ? { ...slot, [field]: value } : slot
      )
    }));
  };

  const removeTimeSlot = (index) => {
    setDeliverySettings(prev => ({ // Updated to use setDeliverySettings
      ...prev,
      delivery_time_slots: prev.delivery_time_slots.filter((_, i) => i !== index)
    }));
  };

  const weekdays = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' }
  ];

  if (loading) {
    return <PageLoader size="lg" />;
  }

  // Display a message if no store is found after loading completes
  if (!store && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
        <div className="text-center text-gray-700">
            <p className="text-lg font-semibold mb-2">No Store Found</p>
            <p>It seems your account is not associated with any store. Please ensure your store is set up correctly.</p>
            <p className="mt-2">If you believe this is an error, please contact support.</p>
        </div>
      </div>
    );
  }

  // If store is found but deliverySettings are still null (shouldn't happen with current logic, but as a safeguard)
  if (!deliverySettings && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
        <div className="text-center text-gray-700">
            <p className="text-lg font-semibold mb-2">Error Loading Settings</p>
            <p>There was an issue loading your delivery settings. Please try again or contact support.</p>
        </div>
      </div>
    );
  }

  // Render the form once settings and store are loaded
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Delivery Settings for {store?.name || 'Your Store'}</h1>
            <p className="text-gray-600 mt-1">Configure delivery date options for your customers</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-8"> {/* Updated to handleSave */}
          {/* General Settings */}
          <Card className="material-elevation-1 border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                General Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Enable Delivery Date Selection</Label>
                  <p className="text-sm text-gray-500">Allow customers to choose their preferred delivery date</p>
                </div>
                <Switch
                  checked={deliverySettings.enable_delivery_date} // Updated to deliverySettings
                  onCheckedChange={(checked) => setDeliverySettings(prev => ({ ...prev, enable_delivery_date: checked }))} // Updated to setDeliverySettings
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Enable Delivery Comments</Label>
                  <p className="text-sm text-gray-500">Allow customers to add special delivery instructions</p>
                </div>
                <Switch
                  checked={deliverySettings.enable_comments} // Updated to deliverySettings
                  onCheckedChange={(checked) => setDeliverySettings(prev => ({ ...prev, enable_comments: checked }))} // Updated to setDeliverySettings
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="offset_days">Minimum Days Offset</Label>
                  <Input
                    id="offset_days"
                    type="number"
                    min="0"
                    value={deliverySettings.offset_days} // Updated to deliverySettings
                    onChange={(e) => setDeliverySettings(prev => ({ ...prev, offset_days: parseInt(e.target.value) }))} // Updated to setDeliverySettings
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum days from order date for delivery</p>
                </div>
                <div>
                  <Label htmlFor="max_advance_days">Maximum Advance Days</Label>
                  <Input
                    id="max_advance_days"
                    type="number"
                    min="1"
                    value={deliverySettings.max_advance_days} // Updated to deliverySettings
                    onChange={(e) => setDeliverySettings(prev => ({ ...prev, max_advance_days: parseInt(e.target.value) }))} // Updated to setDeliverySettings
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum days in advance for scheduling</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Blocked Days */}
          <Card className="material-elevation-1 border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Blocked Days
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-base font-medium mb-3 block">Blocked Weekdays</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {weekdays.map(day => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`weekday-${day.value}`}
                        checked={deliverySettings.blocked_weekdays.includes(day.value)} // Updated to deliverySettings
                        onChange={() => handleWeekdayToggle(day.value)}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor={`weekday-${day.value}`} className="text-sm">
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-base font-medium mb-3 block">Specific Blocked Dates</Label>
                <div className="flex gap-2 mb-3">
                  <Input
                    type="date"
                    value={newBlockedDate}
                    onChange={(e) => setNewBlockedDate(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="button" onClick={addBlockedDate} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {deliverySettings.blocked_dates.map((date, index) => ( // Updated to deliverySettings
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <span>{new Date(date).toLocaleDateString()}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeBlockedDate(date)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Out of Office */}
          <Card className="material-elevation-1 border-0">
            <CardHeader>
              <CardTitle>Out of Office Period</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="out_of_office_start">Start Date</Label>
                  <Input
                    id="out_of_office_start"
                    type="date"
                    value={deliverySettings.out_of_office_start} // Updated to deliverySettings
                    onChange={(e) => setDeliverySettings(prev => ({ ...prev, out_of_office_start: e.target.value }))} // Updated to setDeliverySettings
                  />
                </div>
                <div>
                  <Label htmlFor="out_of_office_end">End Date</Label>
                  <Input
                    id="out_of_office_end"
                    type="date"
                    value={deliverySettings.out_of_office_end} // Updated to deliverySettings
                    onChange={(e) => setDeliverySettings(prev => ({ ...prev, out_of_office_end: e.target.value }))} // Updated to setDeliverySettings
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time Slots */}
          <Card className="material-elevation-1 border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Delivery Time Slots
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {deliverySettings.delivery_time_slots.map((slot, index) => ( // Updated to deliverySettings
                <div key={index} className="flex items-center justify-between gap-4 p-4 border rounded-lg">
                  <div className="sm:flex space-y-2 sm:space-y-0 sm:space-x-4">
                    <div className="sm:flex items-center space-x-4">
                      <Input
                        type="time"
                        value={slot.start_time}
                        onChange={(e) => updateTimeSlot(index, 'start_time', e.target.value)}
                        className="w-32"
                      />
                      <span>to</span>
                    </div>
                    <Input
                      type="time"
                      value={slot.end_time}
                      onChange={(e) => updateTimeSlot(index, 'end_time', e.target.value)}
                      className="w-32"
                    />
                  </div>
                  <div className="flex">
                    <Switch
                      checked={slot.is_active}
                      onCheckedChange={(checked) => updateTimeSlot(index, 'is_active', checked)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTimeSlot(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addTimeSlot}>
                <Plus className="w-4 h-4 mr-2" />
                Add Time Slot
              </Button>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <SaveButton
              onClick={handleSave}
              loading={saving}
              success={saveSuccess}
              defaultText="Save Settings"
            />
          </div>
        </form>
      </div>
    </div>
  );
}
