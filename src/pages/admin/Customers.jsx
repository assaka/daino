import React, { useState, useEffect } from 'react';
import { Customer } from '@/api/entities';
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import NoStoreSelected from '@/components/admin/NoStoreSelected';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import SaveButton from '@/components/ui/save-button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Users, Search, Download, Edit, Trash2, UserPlus, Eye, Ban, CheckCircle, Shield } from 'lucide-react';
import { useAlertTypes } from '@/hooks/useAlert';
import FlashMessage from '@/components/storefront/FlashMessage';
import { PageLoader } from '@/components/ui/page-loader';

export default function Customers() {
    const { selectedStore, getSelectedStoreId } = useStoreSelection();
    const { showError, showSuccess, showConfirm, AlertComponent } = useAlertTypes();
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [flashMessage, setFlashMessage] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewOnly, setIsViewOnly] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [isBlacklisted, setIsBlacklisted] = useState(false);
    const [blacklistReason, setBlacklistReason] = useState('');
    const [isBlacklistModalOpen, setIsBlacklistModalOpen] = useState(false);
    const [blacklistingCustomer, setBlacklistingCustomer] = useState(null);

    useEffect(() => {
        if (selectedStore) {
            loadData();
        }
    }, [selectedStore]);

    // Listen for store changes
    useEffect(() => {
        const handleStoreChange = () => {
            if (selectedStore) {
                loadData();
            }
        };

        window.addEventListener('storeSelectionChanged', handleStoreChange);
        return () => window.removeEventListener('storeSelectionChanged', handleStoreChange);
    }, [selectedStore]);

    const loadData = async () => {
        const storeId = getSelectedStoreId();
        if (!storeId) {
            console.warn("No store selected");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const customerData = await Customer.filter({ store_id: storeId }, '-last_order_date');

            setCustomers(customerData || []);
        } catch (error) {
            console.error("❌ Error loading customers:", error);
            console.error("❌ Error details:", {
                message: error.message,
                status: error.status,
                data: error.data
            });
            setCustomers([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredCustomers = customers.filter(customer =>
        (customer.first_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (customer.last_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (customer.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (customer.phone?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    const handleOpenBlacklistModal = async (customer) => {
        setBlacklistingCustomer(customer);
        setIsBlacklisted(customer.is_blacklisted || false);
        setBlacklistReason(customer.blacklist_reason || '');

        // For guest customers, check if their email is in the blacklist_emails table
        if (customer.customer_type === 'guest' && customer.email) {
            try {
                const storeId = getSelectedStoreId();
                const response = await fetch(`/api/blacklist/emails?store_id=${storeId}&search=${customer.email}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
                    }
                });
                const data = await response.json();
                const emailEntry = data.data?.emails?.find(e => e.email === customer.email);
                if (emailEntry) {
                    setIsBlacklisted(true);
                    setBlacklistReason(emailEntry.reason || '');
                }
            } catch (error) {
                console.error('Error checking blacklist status:', error);
            }
        }

        setIsBlacklistModalOpen(true);
    };

    const handleEditCustomer = async (customer) => {
        setEditingCustomer(customer);
        setIsViewOnly(customer.customer_type === 'guest'); // View-only for guest customers
        setIsBlacklisted(customer.is_blacklisted || false);
        setBlacklistReason(customer.blacklist_reason || '');

        // For guest customers, check if their email is in the blacklist_emails table
        if (customer.customer_type === 'guest' && customer.email) {
            try {
                const storeId = getSelectedStoreId();
                const response = await fetch(`/api/blacklist/emails?store_id=${storeId}&search=${customer.email}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
                    }
                });
                const data = await response.json();
                const emailEntry = data.data?.emails?.find(e => e.email === customer.email);
                if (emailEntry) {
                    setIsBlacklisted(true);
                    setBlacklistReason(emailEntry.reason || '');
                }
            } catch (error) {
                console.error('Error checking blacklist status:', error);
            }
        }

        setIsEditModalOpen(true);
    };

    const handleDeleteCustomer = async (customerId) => {
        const confirmed = await showConfirm(
            'Are you sure you want to delete this customer? This action cannot be undone.',
            'Delete Customer'
        );
        if (!confirmed) {
            return;
        }

        try {
            await Customer.delete(customerId);
            setCustomers(customers.filter(c => c.id !== customerId));
            setFlashMessage({ type: 'success', message: 'Customer deleted successfully' });
        } catch (error) {
            console.error('Error deleting customer:', error);
            showError('Failed to delete customer. Please try again.');
        }
    };

    const handleToggleBlacklistFromModal = async () => {
        const customer = blacklistingCustomer || editingCustomer;
        if (!customer) return;

        const willBlacklist = !isBlacklisted;

        setSaving(true);
        try {
            const storeId = getSelectedStoreId();

            // Update customer blacklist status
            const response = await fetch(`/api/customers/${customer.id}/blacklist?store_id=${storeId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
                },
                body: JSON.stringify({
                    is_blacklisted: willBlacklist,
                    blacklist_reason: willBlacklist ? blacklistReason : null
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update blacklist status');
            }

            const result = await response.json();
            const updatedCustomer = result.data;

            // Remove email from blacklist_emails table when unblacklisting
            if (!willBlacklist && customer.email) {
                try {
                    // Find and delete the email from blacklist_emails
                    const emailListResponse = await fetch(`/api/blacklist/emails?store_id=${storeId}&search=${customer.email}`, {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
                        }
                    });

                    if (emailListResponse.ok) {
                        const emailData = await emailListResponse.json();
                        const emailEntry = emailData.data?.emails?.find(e => e.email === customer.email);

                        if (emailEntry) {
                            await fetch(`/api/blacklist/emails/${emailEntry.id}?store_id=${storeId}`, {
                                method: 'DELETE',
                                headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
                                }
                            });
                        }
                    }
                } catch (emailError) {
                    console.warn('Could not remove email from blacklist:', emailError);
                }
            }

            // Update local state with backend data (source of truth)
            setIsBlacklisted(updatedCustomer.is_blacklisted);
            setCustomers(customers.map(c =>
                c.id === customer.id
                    ? { ...c, ...updatedCustomer }
                    : c
            ));

            // Show success message
            setFlashMessage({
                type: 'success',
                message: willBlacklist ? 'Customer blacklisted successfully' : 'Customer removed from blacklist'
            });

            // Close modal if opened from table
            if (blacklistingCustomer) {
                setIsBlacklistModalOpen(false);
                setBlacklistingCustomer(null);
            }

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error) {
            console.error('Error toggling blacklist status:', error);
            showError('Failed to update blacklist status. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleGuestBlacklist = async () => {
        const customer = blacklistingCustomer || editingCustomer;
        if (!customer || !customer.email) return;

        const storeId = getSelectedStoreId();

        // Check if email is already blacklisted
        try {
            const checkResponse = await fetch(`/api/blacklist/emails?store_id=${storeId}&search=${customer.email}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
                }
            });

            const checkData = await checkResponse.json();
            const existingEntry = checkData.data?.emails?.find(e => e.email === customer.email);

            if (existingEntry) {
                // Email is already blacklisted, remove it
                setSaving(true);
                const deleteResponse = await fetch(`/api/blacklist/emails/${existingEntry.id}?store_id=${storeId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
                    }
                });

                if (deleteResponse.ok) {
                    setIsBlacklisted(false);
                    setCustomers(customers.map(c =>
                        c.email === customer.email
                            ? { ...c, is_blacklisted: false }
                            : c
                    ));
                    setFlashMessage({ type: 'success', message: 'Email removed from blacklist' });

                    // Close modal if opened from table
                    if (blacklistingCustomer) {
                        setIsBlacklistModalOpen(false);
                        setBlacklistingCustomer(null);
                    }
                } else {
                    showError('Failed to remove email from blacklist');
                }
            } else {
                // Email is not blacklisted, add it
                setSaving(true);
                const addResponse = await fetch(`/api/blacklist/emails?store_id=${storeId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
                    },
                    body: JSON.stringify({
                        email: customer.email,
                        reason: blacklistReason || 'Guest customer blacklisted'
                    })
                });

                if (addResponse.ok) {
                    setIsBlacklisted(true);
                    setCustomers(customers.map(c =>
                        c.email === customer.email
                            ? { ...c, is_blacklisted: true }
                            : c
                    ));
                    setFlashMessage({ type: 'success', message: 'Email added to blacklist' });

                    // Close modal if opened from table
                    if (blacklistingCustomer) {
                        setIsBlacklistModalOpen(false);
                        setBlacklistingCustomer(null);
                    }
                } else {
                    const errorData = await addResponse.json();
                    console.error('Failed to add email:', errorData);
                    showError(errorData.message || 'Failed to add email to blacklist');
                }
            }
        } catch (error) {
            console.error('Error managing guest blacklist:', error);
            showError(error.message || 'Failed to update blacklist. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveCustomer = async (e) => {
        e.preventDefault();
        if (!editingCustomer) return;

        setSaveSuccess(false);
        setSaving(true);
        try {
            const formData = new FormData(e.target);
            const updatedData = {
                first_name: formData.get('first_name'),
                last_name: formData.get('last_name'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                address_data: {
                    ...editingCustomer.address_data,
                    shipping_address: {
                        street: formData.get('street'),
                        city: formData.get('city'),
                        state: formData.get('state'),
                        postal_code: formData.get('postal_code'),
                        country: formData.get('country')
                    }
                }
            };

            await Customer.update(editingCustomer.id, updatedData);

            // Update the local state
            setCustomers(customers.map(c =>
                c.id === editingCustomer.id
                    ? { ...c, ...updatedData }
                    : c
            ));

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
            setIsEditModalOpen(false);
            setEditingCustomer(null);
        } catch (error) {
            console.error('Error updating customer:', error);
            showError('Failed to update customer. Please try again.');
        } finally {
            setSaving(false);
        }
    };
    
    const handleExport = () => {
        const headers = ["First Name", "Last Name", "Email", "Total Orders", "Total Spent", "Last Order Date"];
        const rows = filteredCustomers.map(c => [
            c.first_name,
            c.last_name,
            c.email,
            c.phone || '',
            (() => {
                const addressData = c.address_data?.shipping_address || c.address_data?.billing_address;
                if (addressData) {
                    const parts = [
                        addressData.street,
                        addressData.city,
                        addressData.state,
                        addressData.postal_code
                    ].filter(Boolean);
                    return parts.length > 0 ? parts.join(', ') : '';
                }
                return '';
            })(),
            c.total_orders,
            (() => {
                const totalSpent = parseFloat(c.total_spent || 0);
                return isNaN(totalSpent) ? '0.00' : totalSpent.toFixed(2);
            })(),
            c.last_order_date ? new Date(c.last_order_date).toLocaleDateString() : ''
        ].join(','));
        
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "customers.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
                    <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
                    <p className="text-gray-600 mt-1">View and manage your store's customers</p>
                </div>
                <Button onClick={handleExport}>
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                </Button>
            </div>
            
            <Card className="mb-6">
                <CardContent className="p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <Input
                            placeholder="Search customers by name, email, or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>All Customers ({filteredCustomers.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-3 px-2 md:px-4 font-medium">Name</th>
                                    <th className="hidden md:table-cell text-left py-3 px-4 font-medium">Email</th>
                                    <th className="hidden md:table-cell text-left py-3 px-4 font-medium">Type</th>
                                    <th className="text-left py-3 px-2 md:px-4 font-medium">Status</th>
                                    <th className="hidden md:table-cell text-left py-3 px-4 font-medium">Total Orders</th>
                                    <th className="hidden md:table-cell text-left py-3 px-4 font-medium">Total Spent</th>
                                    <th className="hidden md:table-cell text-left py-3 px-4 font-medium">Last Order</th>
                                    <th className="text-left py-3 px-2 md:px-4 font-medium w-16 md:w-auto">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.map(customer => {
                                    const isGuest = customer.customer_type === 'guest';
                                    return (
                                        <tr key={customer.id} className="border-b hover:bg-gray-50">
                                            <td className="py-3 px-2 md:px-4 text-sm md:text-base">{customer.first_name} {customer.last_name}</td>
                                            <td className="hidden md:table-cell py-3 px-4">{customer.email}</td>
                                            <td className="hidden md:table-cell py-3 px-4">
                                                <div className="flex items-center gap-1.5">
                                                    <Badge variant="outline" className={isGuest
                                                        ? 'bg-gray-100 text-gray-800 border-gray-200'
                                                        : 'bg-blue-100 text-blue-800 border-blue-200'
                                                    }>
                                                        {isGuest ? 'Guest' : 'Registered'}
                                                    </Badge>
                                                    {customer.demo && (
                                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                                                            Demo
                                                        </Badge>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 px-2 md:px-4">
                                                {customer.is_blacklisted ? (
                                                    <Badge variant="outline" className="text-xs md:text-sm bg-red-100 text-red-800 border-red-200">
                                                        <Ban className="h-3 w-3 mr-1 hidden md:inline" />
                                                        Blocked
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-xs md:text-sm bg-green-100 text-green-800 border-green-200">
                                                        <CheckCircle className="h-3 w-3 mr-1 hidden md:inline" />
                                                        Active
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="hidden md:table-cell py-3 px-4">{customer.total_orders}</td>
                                            <td className="hidden md:table-cell py-3 px-4">${(() => {
                                                const totalSpent = parseFloat(customer.total_spent || 0);
                                                return isNaN(totalSpent) ? '0.00' : totalSpent.toFixed(2);
                                            })()}</td>
                                            <td className="hidden md:table-cell py-3 px-4">{customer.last_order_date ? new Date(customer.last_order_date).toLocaleDateString() : 'N/A'}</td>
                                            <td className="py-3 px-2 md:px-4">
                                                <div className="flex space-x-1 md:space-x-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleEditCustomer(customer)}
                                                        className="h-8 w-8 p-0"
                                                        title={isGuest ? 'View customer' : 'Edit customer'}
                                                    >
                                                        {isGuest ? <Eye className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleOpenBlacklistModal(customer)}
                                                        className={`h-8 w-8 p-0 ${customer.is_blacklisted ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : 'hover:bg-gray-50'}`}
                                                        title={customer.is_blacklisted ? 'Manage blacklist' : 'Add to blacklist'}
                                                    >
                                                        <Shield className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleDeleteCustomer(customer.id)}
                                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {filteredCustomers.length === 0 && (
                        <div className="text-center py-12">
                            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900">No customers found</h3>
                            <p className="text-gray-600">Your customers will appear here once they place an order.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit/View Customer Modal */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{isViewOnly ? 'View Customer' : 'Edit Customer'}</DialogTitle>
                        {isViewOnly && (
                            <p className="text-sm text-gray-500 mt-1">
                                Guest customer information (read-only)
                            </p>
                        )}
                    </DialogHeader>
                    {editingCustomer && (
                        <form onSubmit={handleSaveCustomer} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="first_name">First Name</Label>
                                    <Input
                                        id="first_name"
                                        name="first_name"
                                        defaultValue={editingCustomer.first_name || ''}
                                        required
                                        disabled={isViewOnly}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="last_name">Last Name</Label>
                                    <Input
                                        id="last_name"
                                        name="last_name"
                                        defaultValue={editingCustomer.last_name || ''}
                                        required
                                        disabled={isViewOnly}
                                    />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    defaultValue={editingCustomer.email || ''}
                                    required
                                    disabled={isViewOnly}
                                />
                            </div>

                            <div>
                                <Label htmlFor="phone">Phone</Label>
                                <Input
                                    id="phone"
                                    name="phone"
                                    defaultValue={editingCustomer.phone || ''}
                                    disabled={isViewOnly}
                                />
                            </div>

                            {/* Blacklist Section - For registered customers */}
                            {!isViewOnly && (
                                <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-medium">Account Status</h4>
                                            <p className="text-sm text-gray-600 mt-1">
                                                {isBlacklisted
                                                    ? 'This customer is blacklisted and cannot log in or checkout'
                                                    : 'This customer can log in and checkout normally'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor="is_blacklisted" className="text-sm">
                                                {isBlacklisted ? 'Blacklisted' : 'Active'}
                                            </Label>
                                            <Switch
                                                id="is_blacklisted"
                                                checked={isBlacklisted}
                                                onCheckedChange={(checked) => setIsBlacklisted(checked)}
                                                disabled={saving}
                                            />
                                        </div>
                                    </div>
                                    {isBlacklisted && (
                                        <>
                                            <div>
                                                <Label htmlFor="blacklist_reason">Blacklist Reason (optional)</Label>
                                                <Textarea
                                                    id="blacklist_reason"
                                                    value={blacklistReason}
                                                    onChange={(e) => setBlacklistReason(e.target.value)}
                                                    placeholder="Enter reason for blacklisting this customer..."
                                                    rows={3}
                                                    disabled={saving}
                                                />
                                            </div>
                                        </>
                                    )}
                                    <Button
                                        type="button"
                                        onClick={handleToggleBlacklistFromModal}
                                        disabled={saving}
                                        className={isBlacklisted ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                                    >
                                        <Ban className="h-4 w-4 mr-2" />
                                        {isBlacklisted ? 'Remove from Blacklist' : 'Add to Blacklist'}
                                    </Button>
                                </div>
                            )}

                            {/* Blacklist Section - For guest customers (email only) */}
                            {isViewOnly && (
                                <div className="space-y-3 p-4 border rounded-lg bg-amber-50">
                                    <div>
                                        <h4 className="font-medium">Email Blacklist Status</h4>
                                        <p className="text-sm text-gray-600 mt-1">
                                            {isBlacklisted
                                                ? 'This email is blacklisted and cannot be used for checkout'
                                                : 'This email can be used for checkout'}
                                        </p>
                                        <p className="text-xs text-amber-700 mt-2">
                                            Note: Guest customers don't have accounts. Only their email can be blacklisted.
                                        </p>
                                    </div>
                                    <div>
                                        <Label htmlFor="guest_blacklist_reason">Blacklist Reason (optional)</Label>
                                        <Textarea
                                            id="guest_blacklist_reason"
                                            value={blacklistReason}
                                            onChange={(e) => setBlacklistReason(e.target.value)}
                                            placeholder="Enter reason for blacklisting this email..."
                                            rows={3}
                                            disabled={saving}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        onClick={handleGuestBlacklist}
                                        disabled={saving}
                                        className={isBlacklisted ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                                    >
                                        <Ban className="h-4 w-4 mr-2" />
                                        {isBlacklisted ? 'Remove Email from Blacklist' : 'Add Email to Blacklist'}
                                    </Button>
                                </div>
                            )}

                            <div className="space-y-3">
                                <h4 className="font-medium">Address Information{isViewOnly && ' (from last order)'}</h4>
                                <div>
                                    <Label htmlFor="street">Street Address</Label>
                                    <Input
                                        id="street"
                                        name="street"
                                        defaultValue={editingCustomer.address_data?.shipping_address?.street || ''}
                                        disabled={isViewOnly}
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="city">City</Label>
                                        <Input
                                            id="city"
                                            name="city"
                                            defaultValue={editingCustomer.address_data?.shipping_address?.city || ''}
                                            disabled={isViewOnly}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="state">State</Label>
                                        <Input
                                            id="state"
                                            name="state"
                                            defaultValue={editingCustomer.address_data?.shipping_address?.state || ''}
                                            disabled={isViewOnly}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="postal_code">Postal Code</Label>
                                        <Input
                                            id="postal_code"
                                            name="postal_code"
                                            defaultValue={editingCustomer.address_data?.shipping_address?.postal_code || ''}
                                            disabled={isViewOnly}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="country">Country</Label>
                                        <Input
                                            id="country"
                                            name="country"
                                            defaultValue={editingCustomer.address_data?.shipping_address?.country || ''}
                                            disabled={isViewOnly}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end space-x-2 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsEditModalOpen(false)}
                                    disabled={saving}
                                >
                                    {isViewOnly ? 'Close' : 'Cancel'}
                                </Button>
                                {!isViewOnly && (
                                    <SaveButton
                                        type="submit"
                                        loading={saving}
                                        success={saveSuccess}
                                        defaultText="Save Changes"
                                    />
                                )}
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* Standalone Blacklist Modal */}
            <Dialog open={isBlacklistModalOpen} onOpenChange={setIsBlacklistModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            Blacklist Management
                        </DialogTitle>
                    </DialogHeader>
                    {blacklistingCustomer && (
                        <div className="space-y-4">
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-sm font-medium text-gray-700">Customer</p>
                                <p className="text-sm text-gray-900">{blacklistingCustomer.first_name} {blacklistingCustomer.last_name}</p>
                                <p className="text-sm text-gray-600">{blacklistingCustomer.email}</p>
                                <Badge variant="outline" className={`mt-2 ${
                                    blacklistingCustomer.customer_type === 'guest'
                                        ? 'bg-gray-100 text-gray-800 border-gray-200'
                                        : 'bg-blue-100 text-blue-800 border-blue-200'
                                }`}>
                                    {blacklistingCustomer.customer_type === 'guest' ? 'Guest' : 'Registered'}
                                </Badge>
                            </div>

                            <div className="space-y-3 p-4 border rounded-lg" style={{ backgroundColor: isBlacklisted ? '#fee2e2' : '#f0fdf4' }}>
                                <div className="flex items-center gap-2">
                                    {isBlacklisted ? (
                                        <Ban className="h-5 w-5 text-red-600" />
                                    ) : (
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                    )}
                                    <h4 className="font-medium">
                                        {isBlacklisted ? 'Currently Blacklisted' : 'Currently Active'}
                                    </h4>
                                </div>
                                <p className="text-sm text-gray-600">
                                    {isBlacklisted
                                        ? blacklistingCustomer.customer_type === 'guest'
                                            ? 'This email is blacklisted and cannot be used for checkout'
                                            : 'This customer is blacklisted and cannot log in or checkout'
                                        : blacklistingCustomer.customer_type === 'guest'
                                            ? 'This email can be used for checkout'
                                            : 'This customer can log in and checkout normally'}
                                </p>
                            </div>

                            {blacklistingCustomer.customer_type === 'guest' && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                                    Note: Guest customers don't have accounts. Only their email can be blacklisted.
                                </div>
                            )}

                            <div>
                                <Label htmlFor="modal_blacklist_reason">Blacklist Reason (optional)</Label>
                                <Textarea
                                    id="modal_blacklist_reason"
                                    value={blacklistReason}
                                    onChange={(e) => setBlacklistReason(e.target.value)}
                                    placeholder="Enter reason for blacklisting..."
                                    rows={3}
                                    disabled={saving}
                                />
                            </div>

                            <div className="flex justify-end space-x-2 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsBlacklistModalOpen(false)}
                                    disabled={saving}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleToggleBlacklistFromModal}
                                    disabled={saving}
                                    className={isBlacklisted ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                                >
                                    <Ban className="h-4 w-4 mr-2" />
                                    {isBlacklisted ? 'Remove from Blacklist' : 'Add to Blacklist'}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <AlertComponent />
            <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
        </div>
    );
}