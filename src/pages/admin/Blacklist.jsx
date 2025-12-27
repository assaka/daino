import React, { useState, useEffect } from 'react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import NoStoreSelected from '@/components/admin/NoStoreSelected';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Search, Plus, Trash2, Globe, Mail, MonitorSmartphone } from 'lucide-react';
import { useAlertTypes } from '@/hooks/useAlert';
import FlashMessage from '@/components/storefront/FlashMessage';
import SaveButton from "@/components/ui/save-button.jsx";
import { PageLoader } from '@/components/ui/page-loader';

export default function Blacklist() {
    const { selectedStore, getSelectedStoreId } = useStoreSelection();
    const { showError, showSuccess, showConfirm, AlertComponent } = useAlertTypes();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('ips');
    const [flashMessage, setFlashMessage] = useState(null);

    // Settings state
    const [settings, setSettings] = useState({
        block_by_ip: false,
        block_by_email: true,
        block_by_country: false
    });
    const [savingSettings, setSavingSettings] = useState(false);

    // IPs state
    const [ips, setIps] = useState([]);
    const [ipSearch, setIpSearch] = useState('');
    const [isAddIPModalOpen, setIsAddIPModalOpen] = useState(false);
    const [newIP, setNewIP] = useState({ ip_address: '', reason: '' });

    // Countries state
    const [countries, setCountries] = useState([]);
    const [countrySearch, setCountrySearch] = useState('');
    const [isAddCountryModalOpen, setIsAddCountryModalOpen] = useState(false);
    const [newCountry, setNewCountry] = useState({ country_code: '', country_name: '', reason: '' });

    // Emails state
    const [emails, setEmails] = useState([]);
    const [emailSearch, setEmailSearch] = useState('');
    const [isAddEmailModalOpen, setIsAddEmailModalOpen] = useState(false);
    const [newEmail, setNewEmail] = useState({ email: '', reason: '' });

    useEffect(() => {
        if (selectedStore) {
            loadData();
        }
    }, [selectedStore]);

    const loadData = async () => {
        const storeId = getSelectedStoreId();
        if (!storeId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            await Promise.all([
                loadSettings(),
                loadIPs(),
                loadCountries(),
                loadEmails()
            ]);
        } catch (error) {
            console.error('Error loading blacklist data:', error);
            showError('Failed to load blacklist data');
        } finally {
            setLoading(false);
        }
    };

    const loadSettings = async () => {
        const storeId = getSelectedStoreId();
        const response = await fetch(`/api/blacklist/settings?store_id=${storeId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
            }
        });
        const data = await response.json();
        if (data.success) {
            setSettings(data.data);
        }
    };

    const loadIPs = async () => {
        const storeId = getSelectedStoreId();
        const response = await fetch(`/api/blacklist/ips?store_id=${storeId}&search=${ipSearch}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
            }
        });
        const data = await response.json();
        if (data.success) {
            setIps(data.data.ips || []);
        }
    };

    const loadCountries = async () => {
        const storeId = getSelectedStoreId();
        const response = await fetch(`/api/blacklist/countries?store_id=${storeId}&search=${countrySearch}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
            }
        });
        const data = await response.json();
        if (data.success) {
            setCountries(data.data.countries || []);
        }
    };

    const loadEmails = async () => {
        const storeId = getSelectedStoreId();
        const response = await fetch(`/api/blacklist/emails?store_id=${storeId}&search=${emailSearch}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
            }
        });
        const data = await response.json();
        if (data.success) {
            setEmails(data.data.emails || []);
        }
    };

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            const storeId = getSelectedStoreId();
            const response = await fetch(`/api/blacklist/settings?store_id=${storeId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
                },
                body: JSON.stringify(settings)
            });

            const data = await response.json();
            if (data.success) {
                setFlashMessage({ type: 'success', message: 'Blacklist settings updated successfully' });
            } else {
                showError(data.message || 'Failed to update settings');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            showError('Failed to save settings');
        } finally {
            setSavingSettings(false);
        }
    };

    const handleAddIP = async () => {
        if (!newIP.ip_address) {
            showError('IP address is required');
            return;
        }

        try {
            const storeId = getSelectedStoreId();
            const response = await fetch(`/api/blacklist/ips?store_id=${storeId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
                },
                body: JSON.stringify(newIP)
            });

            const data = await response.json();
            if (data.success) {
                setFlashMessage({ type: 'success', message: 'IP address blacklisted successfully' });
                setIsAddIPModalOpen(false);
                setNewIP({ ip_address: '', reason: '' });
                loadIPs();
            } else {
                showError(data.message || 'Failed to add IP');
            }
        } catch (error) {
            console.error('Error adding IP:', error);
            showError('Failed to add IP address');
        }
    };

    const handleDeleteIP = async (id) => {
        const confirmed = await showConfirm(
            'Are you sure you want to remove this IP from the blacklist?',
            'Remove IP from Blacklist'
        );
        if (!confirmed) {
            return;
        }

        try {
            const storeId = getSelectedStoreId();
            const response = await fetch(`/api/blacklist/ips/${id}?store_id=${storeId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                setFlashMessage({ type: 'success', message: 'IP removed from blacklist' });
                loadIPs();
            } else {
                showError(data.message || 'Failed to remove IP');
            }
        } catch (error) {
            console.error('Error deleting IP:', error);
            showError('Failed to remove IP');
        }
    };

    const handleAddCountry = async () => {
        if (!newCountry.country_code) {
            showError('Country code is required');
            return;
        }

        try {
            const storeId = getSelectedStoreId();
            const response = await fetch(`/api/blacklist/countries?store_id=${storeId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
                },
                body: JSON.stringify(newCountry)
            });

            const data = await response.json();
            if (data.success) {
                setFlashMessage({ type: 'success', message: 'Country blacklisted successfully' });
                setIsAddCountryModalOpen(false);
                setNewCountry({ country_code: '', country_name: '', reason: '' });
                loadCountries();
            } else {
                showError(data.message || 'Failed to add country');
            }
        } catch (error) {
            console.error('Error adding country:', error);
            showError('Failed to add country');
        }
    };

    const handleDeleteCountry = async (id) => {
        const confirmed = await showConfirm(
            'Are you sure you want to remove this country from the blacklist?',
            'Remove Country from Blacklist'
        );
        if (!confirmed) {
            return;
        }

        try {
            const storeId = getSelectedStoreId();
            const response = await fetch(`/api/blacklist/countries/${id}?store_id=${storeId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                setFlashMessage({ type: 'success', message: 'Country removed from blacklist' });
                loadCountries();
            } else {
                showError(data.message || 'Failed to remove country');
            }
        } catch (error) {
            console.error('Error deleting country:', error);
            showError('Failed to remove country');
        }
    };

    const handleAddEmail = async () => {
        if (!newEmail.email) {
            showError('Email address is required');
            return;
        }

        try {
            const storeId = getSelectedStoreId();
            const response = await fetch(`/api/blacklist/emails?store_id=${storeId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
                },
                body: JSON.stringify(newEmail)
            });

            const data = await response.json();
            if (data.success) {
                setFlashMessage({ type: 'success', message: 'Email blacklisted successfully' });
                setIsAddEmailModalOpen(false);
                setNewEmail({ email: '', reason: '' });
                loadEmails();
            } else {
                showError(data.message || 'Failed to add email');
            }
        } catch (error) {
            console.error('Error adding email:', error);
            showError('Failed to add email');
        }
    };

    const handleDeleteEmail = async (id) => {
        const confirmed = await showConfirm(
            'Are you sure you want to remove this email from the blacklist?',
            'Remove Email from Blacklist'
        );
        if (!confirmed) {
            return;
        }

        try {
            const storeId = getSelectedStoreId();

            // Use the new endpoint that handles both email deletion and customer updates
            const response = await fetch(`/api/blacklist/emails/${id}/false?store_id=${storeId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                setFlashMessage({
                    type: 'success',
                    message: `Email removed from blacklist. ${data.data.updated_customers} customer(s) updated.`
                });
                loadEmails();
            } else {
                showError(data.message || 'Failed to remove email');
            }
        } catch (error) {
            console.error('Error deleting email:', error);
            showError('Failed to remove email');
        }
    };

    if (loading) {
        return <PageLoader size="lg" />;
    }

    if (!selectedStore) {
        return <NoStoreSelected />;
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Blacklist Management</h1>
                    <p className="text-gray-600 mt-1">Block access by IP address, country, or email</p>
                </div>
                <Shield className="w-12 h-12 text-blue-600" />
            </div>

            {/* Settings Card */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Blacklist Settings</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                                <h4 className="font-medium flex items-center gap-2">
                                    <MonitorSmartphone className="w-4 h-4" />
                                    Block by IP Address
                                </h4>
                                <p className="text-sm text-gray-600">Prevent specific IP addresses from accessing checkout</p>
                            </div>
                            <Switch
                                checked={settings.block_by_ip}
                                onCheckedChange={(checked) => setSettings({ ...settings, block_by_ip: checked })}
                                disabled={savingSettings}
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                                <h4 className="font-medium flex items-center gap-2">
                                    <Mail className="w-4 h-4" />
                                    Block by Email Address
                                </h4>
                                <p className="text-sm text-gray-600">Prevent specific email addresses from placing orders</p>
                            </div>
                            <Switch
                                checked={settings.block_by_email}
                                onCheckedChange={(checked) => setSettings({ ...settings, block_by_email: checked })}
                                disabled={savingSettings}
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                                <h4 className="font-medium flex items-center gap-2">
                                    <Globe className="w-4 h-4" />
                                    Block by Country
                                </h4>
                                <p className="text-sm text-gray-600">Prevent orders from specific countries</p>
                            </div>
                            <Switch
                                checked={settings.block_by_country}
                                onCheckedChange={(checked) => setSettings({ ...settings, block_by_country: checked })}
                                disabled={savingSettings}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>
            <div className="flex justify-end mt-4 mb-8">
                <SaveButton
                    onClick={handleSaveSettings}
                    loading={savingSettings}
                    defaultText="Save Settings"
                />
            </div>

            {/* Tabs */}
            <Card>
                <CardContent className="p-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="ips">
                                <MonitorSmartphone className="w-4 h-4 mr-2" />
                                IP Addresses ({ips.length})
                            </TabsTrigger>
                            <TabsTrigger value="countries">
                                <Globe className="w-4 h-4 mr-2" />
                                Countries ({countries.length})
                            </TabsTrigger>
                            <TabsTrigger value="emails">
                                <Mail className="w-4 h-4 mr-2" />
                                Emails ({emails.length})
                            </TabsTrigger>
                        </TabsList>

                        {/* IP Addresses Tab */}
                        <TabsContent value="ips" className="space-y-4">
                            <div className="flex gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <Input
                                        placeholder="Search IP addresses..."
                                        value={ipSearch}
                                        onChange={(e) => setIpSearch(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                                <Button onClick={() => setIsAddIPModalOpen(true)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add IP
                                </Button>
                            </div>

                            <div className="border rounded-lg">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="text-left py-3 px-4 font-medium">IP Address</th>
                                            <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Reason</th>
                                            <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Date Added</th>
                                            <th className="text-left py-3 px-4 font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ips.map(ip => (
                                            <tr key={ip.id} className="border-t hover:bg-gray-50">
                                                <td className="py-3 px-4 font-mono">{ip.ip_address}</td>
                                                <td className="py-3 px-4 hidden md:table-cell">{ip.reason || '-'}</td>
                                                <td className="py-3 px-4 hidden md:table-cell">{new Date(ip.created_at).toLocaleDateString()}</td>
                                                <td className="py-3 px-4">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleDeleteIP(ip.id)}
                                                        className="text-red-600 hover:text-red-700"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {ips.length === 0 && (
                                    <div className="text-center py-12 text-gray-500">
                                        No IP addresses blacklisted
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* Countries Tab */}
                        <TabsContent value="countries" className="space-y-4">
                            <div className="flex gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <Input
                                        placeholder="Search countries..."
                                        value={countrySearch}
                                        onChange={(e) => setCountrySearch(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                                <Button onClick={() => setIsAddCountryModalOpen(true)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Country
                                </Button>
                            </div>

                            <div className="border rounded-lg">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="text-left py-3 px-4 font-medium">Country Code</th>
                                            <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Country Name</th>
                                            <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Reason</th>
                                            <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Date Added</th>
                                            <th className="text-left py-3 px-4 font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {countries.map(country => (
                                            <tr key={country.id} className="border-t hover:bg-gray-50">
                                                <td className="py-3 px-4 font-mono">{country.country_code}</td>
                                                <td className="py-3 px-4 hidden md:table-cell">{country.country_name || '-'}</td>
                                                <td className="py-3 px-4 hidden md:table-cell">{country.reason || '-'}</td>
                                                <td className="py-3 px-4 hidden md:table-cell">{new Date(country.created_at).toLocaleDateString()}</td>
                                                <td className="py-3 px-4">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleDeleteCountry(country.id)}
                                                        className="text-red-600 hover:text-red-700"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {countries.length === 0 && (
                                    <div className="text-center py-12 text-gray-500">
                                        No countries blacklisted
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* Emails Tab */}
                        <TabsContent value="emails" className="space-y-4">
                            <div className="flex gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <Input
                                        placeholder="Search email addresses..."
                                        value={emailSearch}
                                        onChange={(e) => setEmailSearch(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                                <Button onClick={() => setIsAddEmailModalOpen(true)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Email
                                </Button>
                            </div>

                            <div className="border rounded-lg">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="text-left py-3 px-4 font-medium">Email Address</th>
                                            <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Reason</th>
                                            <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Date Added</th>
                                            <th className="text-left py-3 px-4 font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {emails.map(email => (
                                            <tr key={email.id} className="border-t hover:bg-gray-50">
                                                <td className="py-3 px-4">{email.email}</td>
                                                <td className="py-3 px-4 hidden md:table-cell">{email.reason || '-'}</td>
                                                <td className="py-3 px-4 hidden md:table-cell">{new Date(email.created_at).toLocaleDateString()}</td>
                                                <td className="py-3 px-4">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleDeleteEmail(email.id)}
                                                        className="text-red-600 hover:text-red-700"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {emails.length === 0 && (
                                    <div className="text-center py-12 text-gray-500">
                                        No email addresses blacklisted
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Add IP Modal */}
            <Dialog open={isAddIPModalOpen} onOpenChange={setIsAddIPModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add IP Address to Blacklist</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="ip_address">IP Address *</Label>
                            <Input
                                id="ip_address"
                                placeholder="192.168.1.1"
                                value={newIP.ip_address}
                                onChange={(e) => setNewIP({ ...newIP, ip_address: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label htmlFor="ip_reason">Reason (optional)</Label>
                            <Textarea
                                id="ip_reason"
                                placeholder="Enter reason for blacklisting this IP..."
                                value={newIP.reason}
                                onChange={(e) => setNewIP({ ...newIP, reason: e.target.value })}
                                rows={3}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsAddIPModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleAddIP}>
                                Add to Blacklist
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add Country Modal */}
            <Dialog open={isAddCountryModalOpen} onOpenChange={setIsAddCountryModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Country to Blacklist</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="country_code">Country Code (ISO 2) *</Label>
                            <Input
                                id="country_code"
                                placeholder="US"
                                maxLength={2}
                                value={newCountry.country_code}
                                onChange={(e) => setNewCountry({ ...newCountry, country_code: e.target.value.toUpperCase() })}
                            />
                        </div>
                        <div>
                            <Label htmlFor="country_name">Country Name</Label>
                            <Input
                                id="country_name"
                                placeholder="United States"
                                value={newCountry.country_name}
                                onChange={(e) => setNewCountry({ ...newCountry, country_name: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label htmlFor="country_reason">Reason (optional)</Label>
                            <Textarea
                                id="country_reason"
                                placeholder="Enter reason for blacklisting this country..."
                                value={newCountry.reason}
                                onChange={(e) => setNewCountry({ ...newCountry, reason: e.target.value })}
                                rows={3}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsAddCountryModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleAddCountry}>
                                Add to Blacklist
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add Email Modal */}
            <Dialog open={isAddEmailModalOpen} onOpenChange={setIsAddEmailModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Email to Blacklist</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="email">Email Address *</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="user@example.com"
                                value={newEmail.email}
                                onChange={(e) => setNewEmail({ ...newEmail, email: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label htmlFor="email_reason">Reason (optional)</Label>
                            <Textarea
                                id="email_reason"
                                placeholder="Enter reason for blacklisting this email..."
                                value={newEmail.reason}
                                onChange={(e) => setNewEmail({ ...newEmail, reason: e.target.value })}
                                rows={3}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsAddEmailModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleAddEmail}>
                                Add to Blacklist
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertComponent />
            <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
        </div>
    );
}
