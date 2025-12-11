import React, { useState, useEffect } from "react";
import { EmailTemplate } from "@/api/entities";
import { useStoreSelection } from "@/contexts/StoreSelectionContext.jsx";
import NoStoreSelected from "@/components/admin/NoStoreSelected";
import EmailTemplateForm from "@/components/admin/emails/EmailTemplateForm";
import PdfTemplateForm from "@/components/admin/pdfs/PdfTemplateForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Mail, Send, Languages, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FlashMessage from "@/components/storefront/FlashMessage";
import { useAlertTypes } from "@/hooks/useAlert";
import BulkTranslateDialog from "@/components/admin/BulkTranslateDialog";
import api from "@/utils/api";
import { PageLoader } from "@/components/ui/page-loader";

export default function Emails() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const { showConfirm, AlertComponent } = useAlertTypes();

  // Email templates state
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [flashMessage, setFlashMessage] = useState(null);
  const [showBulkTranslate, setShowBulkTranslate] = useState(false);

  // PDF templates state
  const [pdfTemplates, setPdfTemplates] = useState([]);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [showPdfForm, setShowPdfForm] = useState(false);
  const [editingPdfTemplate, setEditingPdfTemplate] = useState(null);

  // Tab state
  const [activeTab, setActiveTab] = useState('emails');

  useEffect(() => {
    if (selectedStore) {
      loadTemplates();
      loadPdfTemplates();
    }
  }, [selectedStore]);

  // Listen for store changes
  useEffect(() => {
    const handleStoreChange = () => {
      if (selectedStore) {
        loadTemplates();
        loadPdfTemplates();
      }
    };

    window.addEventListener('storeSelectionChanged', handleStoreChange);
    return () => window.removeEventListener('storeSelectionChanged', handleStoreChange);
  }, [selectedStore]);

  const loadTemplates = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const templatesData = await EmailTemplate.filter({ store_id: storeId });
      setTemplates(templatesData || []);
    } catch (error) {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPdfTemplates = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setPdfTemplates([]);
      setLoadingPdf(false);
      return;
    }

    setLoadingPdf(true);
    try {
      const response = await api.get(`/pdf-templates?store_id=${storeId}`);
      setPdfTemplates(response?.data || []);
    } catch (error) {
      setPdfTemplates([]);
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleFormSubmit = async (formData) => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setFlashMessage({ type: 'error', message: 'Cannot save email template: No store selected.' });
      return;
    }

    try {
      if (editingTemplate) {
        await EmailTemplate.update(editingTemplate.id, formData);
        setFlashMessage({ type: 'success', message: 'Email template updated successfully!' });
      } else {
        await EmailTemplate.create(formData);
        setFlashMessage({ type: 'success', message: 'Email template created successfully!' });
      }
      setShowForm(false);
      setEditingTemplate(null);
      loadTemplates();
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to save email template.' });
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditingTemplate(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingTemplate(null);
  };

  const handleToggleActive = async (template) => {
    try {
      await EmailTemplate.update(template.id, { ...template, is_active: !template.is_active });
      setFlashMessage({ type: 'success', message: `Email template ${template.is_active ? 'deactivated' : 'activated'} successfully!` });
      loadTemplates();
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to toggle template status.' });
    }
  };

  const handleDelete = async (templateId) => {
    const confirmed = await showConfirm("Are you sure you want to delete this email template?", "Delete Email Template");
    if (confirmed) {
      try {
        const storeId = getSelectedStoreId();
        await EmailTemplate.delete(templateId, { store_id: storeId });
        setFlashMessage({ type: 'success', message: 'Email template deleted successfully!' });
        loadTemplates();
      } catch (error) {
        setFlashMessage({ type: 'error', message: 'Failed to delete email template.' });
      }
    }
  };

  const handleBulkTranslate = async (fromLang, toLang) => {
    const storeId = getSelectedStoreId();
    if (!storeId) return { success: false, message: 'No store selected' };

    try {
      const response = await EmailTemplate.bulkTranslate(storeId, fromLang, toLang);
      return response;
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  // PDF Template Handlers
  const handlePdfFormSubmit = async (formData) => {
    try {
      const storeId = getSelectedStoreId();
      await api.put(`/pdf-templates/${editingPdfTemplate.id}?store_id=${storeId}`, formData);
      setFlashMessage({ type: 'success', message: 'PDF template updated successfully!' });
      setShowPdfForm(false);
      setEditingPdfTemplate(null);
      loadPdfTemplates();
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to save PDF template.' });
    }
  };

  const handleEditPdf = (template) => {
    setEditingPdfTemplate(template);
    setShowPdfForm(true);
  };

  const closePdfForm = () => {
    setShowPdfForm(false);
    setEditingPdfTemplate(null);
  };

  const handleTogglePdfActive = async (template) => {
    try {
      const storeId = getSelectedStoreId();
      await api.put(`/pdf-templates/${template.id}?store_id=${storeId}`, { is_active: !template.is_active });
      setFlashMessage({ type: 'success', message: `PDF template ${template.is_active ? 'deactivated' : 'activated'} successfully!` });
      loadPdfTemplates();
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to toggle PDF template status.' });
    }
  };

  const getEmailTypeInfo = (identifier) => {
    const types = {
      'signup_email': {
        icon: '👋',
        color: 'from-blue-500 to-purple-600',
        label: 'Welcome Email'
      },
      'email_verification': {
        icon: '✉️',
        color: 'from-indigo-500 to-blue-600',
        label: 'Email Verification'
      },
      'order_success_email': {
        icon: '📦',
        color: 'from-orange-500 to-red-600',
        label: 'Order Confirmation'
      },
      'credit_purchase_email': {
        icon: '💳',
        color: 'from-green-500 to-emerald-600',
        label: 'Credit Purchase'
      },
      'pdf_invoice': {
        icon: '📄',
        color: 'from-purple-500 to-pink-600',
        label: 'PDF Invoice Template'
      },
      'shipment_notification': {
        icon: '🚚',
        color: 'from-teal-500 to-cyan-600',
        label: 'Shipment Notification'
      }
    };

    return types[identifier] || { icon: '📧', color: 'from-gray-500 to-gray-600', label: identifier };
  };

  if (!selectedStore) {
    return <NoStoreSelected />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
      <AlertComponent />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Email & PDF Templates</h1>
            <p className="text-gray-600 mt-1">Manage email and PDF templates for your store</p>
          </div>
          <div className="flex gap-2">
            {activeTab === 'emails' ? (
              <>
                <Button
                  onClick={() => setShowBulkTranslate(true)}
                  variant="outline"
                  disabled={!selectedStore || templates.length === 0}
                >
                  <Languages className="mr-2 h-4 w-4" /> Bulk Translate
                </Button>
                <Button
                  onClick={handleAdd}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple material-elevation-1"
                  disabled={!selectedStore}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Custom Template
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('emails')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'emails'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Mail className="w-4 h-4 inline-block mr-2" />
              Email Templates
            </button>
            <button
              onClick={() => setActiveTab('pdfs')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'pdfs'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="w-4 h-4 inline-block mr-2" />
              PDF Templates
            </button>
          </div>
        </div>

        {/* Email Templates Tab */}
        {activeTab === 'emails' && (loading ? (
          <PageLoader size="lg" fullScreen={false} className="h-64" />
        ) : templates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {templates.map(template => {
              const typeInfo = getEmailTypeInfo(template.identifier);
              return (
                <Card key={template.id} className="material-elevation-1 border-0 hover:material-elevation-2 transition-all duration-300">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-12 h-12 bg-gradient-to-r ${typeInfo.color} rounded-lg flex items-center justify-center`}>
                          <span className="text-xl">{typeInfo.icon}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{typeInfo.label}</CardTitle>
                            {template.is_system && (
                              <Badge variant="secondary" className="text-xs">System</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{template.identifier}</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Active</span>
                      <Switch
                        checked={template.is_active}
                        onCheckedChange={() => handleToggleActive(template)}
                      />
                    </div>

                    <div className="text-sm text-gray-600">
                      <div className="font-medium mb-1">Subject:</div>
                      <div className="bg-gray-50 p-2 rounded text-xs">
                        {template.translations?.en?.subject || 'No subject'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Badge variant="outline" className="text-xs">
                        {template.content_type}
                      </Badge>
                      {template.attachment_enabled && (
                        <Badge variant="outline" className="text-xs">
                          📎 Attachments
                        </Badge>
                      )}
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <Badge variant={template.is_active ? "default" : "secondary"}>
                        {template.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(template)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {!template.is_system && (
                          <Button variant="outline" size="sm" onClick={() => handleDelete(template.id, template.is_system)} className="text-red-600 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="material-elevation-1 border-0">
            <CardContent className="text-center py-12">
              <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No email templates found</h3>
              <p className="text-gray-600 mb-6">
                System email templates should be automatically created. You can also create custom templates for plugins.
              </p>
              <Button
                onClick={handleAdd}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple"
                disabled={!selectedStore}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Custom Template
              </Button>
            </CardContent>
          </Card>
        ))}

        {/* PDF Templates Tab */}
        {activeTab === 'pdfs' && (loadingPdf ? (
          <PageLoader size="lg" fullScreen={false} className="h-64" />
        ) : pdfTemplates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pdfTemplates.map(template => (
              <Card key={template.id} className="material-elevation-1 border-0 hover:material-elevation-2 transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 bg-gradient-to-r ${
                        template.template_type === 'invoice' ? 'from-purple-500 to-pink-600' : 'from-teal-500 to-cyan-600'
                      } rounded-lg flex items-center justify-center`}>
                        <span className="text-xl">
                          {template.template_type === 'invoice' ? '📄' : '📦'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          {template.is_system && (
                            <Badge variant="secondary" className="text-xs">System</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{template.identifier}</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Active</span>
                    <Switch
                      checked={template.is_active}
                      onCheckedChange={() => handleTogglePdfActive(template)}
                    />
                  </div>

                  <div className="text-sm text-gray-600">
                    <div className="flex justify-between mb-1">
                      <span>Page Size:</span>
                      <span className="font-medium">{template.settings?.page_size || 'A4'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Orientation:</span>
                      <span className="font-medium capitalize">{template.settings?.orientation || 'portrait'}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => handleEditPdf(template)}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Edit className="w-4 h-4 mr-2" /> Edit Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="material-elevation-1 border-0">
            <CardContent className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No PDF templates found</h3>
              <p className="text-gray-600 mb-6">
                System PDF templates should be automatically created during migration.
              </p>
            </CardContent>
          </Card>
        ))}

        {/* Bulk Translate Dialog */}
        <BulkTranslateDialog
          open={showBulkTranslate}
          onOpenChange={setShowBulkTranslate}
          entityType="email templates"
          entityName="Email Templates"
          onTranslate={handleBulkTranslate}
          onComplete={loadTemplates}
          itemCount={templates.length}
        />

        {/* Email Template Form Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? 'Edit Email Template' : 'Add New Email Template'}</DialogTitle>
            </DialogHeader>
            <EmailTemplateForm
              template={editingTemplate}
              onSubmit={handleFormSubmit}
              onCancel={closeForm}
            />
          </DialogContent>
        </Dialog>

        {/* PDF Template Form Dialog */}
        <Dialog open={showPdfForm} onOpenChange={setShowPdfForm}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit PDF Template: {editingPdfTemplate?.name}</DialogTitle>
            </DialogHeader>
            <PdfTemplateForm
              template={editingPdfTemplate}
              onSubmit={handlePdfFormSubmit}
              onCancel={closePdfForm}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
