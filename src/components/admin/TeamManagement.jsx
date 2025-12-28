import React, { useState, useEffect } from 'react';
import { StoreTeam } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Edit,
  Trash2,
  Crown,
  Eye,
  Plus,
  AlertCircle,
  Send
} from 'lucide-react';
import FlashMessage from '@/components/storefront/FlashMessage';

const ROLE_COLORS = {
  owner: 'bg-purple-100 text-purple-800 border-purple-200',
  admin: 'bg-blue-100 text-blue-800 border-blue-200',
  editor: 'bg-green-100 text-green-800 border-green-200',
  viewer: 'bg-gray-100 text-gray-800 border-gray-200'
};

const ROLE_ICONS = {
  owner: Crown,
  admin: Shield,
  editor: Edit,
  viewer: Eye
};

const DEFAULT_PERMISSIONS = {
  owner: {
    canManageProducts: true,
    canManageOrders: true,
    canManageCategories: true,
    canViewReports: true,
    canManageContent: true,
    canManageTeam: true,
    canManageStore: true,
    canDeleteStore: true
  },
  admin: {
    canManageProducts: true,
    canManageOrders: true,
    canManageCategories: true,
    canViewReports: true,
    canManageContent: true,
    canManageTeam: true,
    canManageStore: false,
    canDeleteStore: false
  },
  editor: {
    canManageProducts: true,
    canManageOrders: true,
    canManageCategories: true,
    canViewReports: true,
    canManageContent: true,
    canManageTeam: false,
    canManageStore: false,
    canDeleteStore: false
  },
  viewer: {
    canManageProducts: false,
    canManageOrders: false,
    canManageCategories: false,
    canViewReports: true,
    canManageContent: false,
    canManageTeam: false,
    canManageStore: false,
    canDeleteStore: false
  }
};

export default function TeamManagement({ storeId, storeName }) {
  const [teamMembers, setTeamMembers] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    type: null, // 'resend', 'deleteInvitation', 'removeMember'
    data: null
  });

  // Flash message state
  const [flashMessage, setFlashMessage] = useState(null);

  // Invite form state
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'editor',
    message: '',
    permissions: DEFAULT_PERMISSIONS.editor
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    role: '',
    permissions: {}
  });

  useEffect(() => {
    if (storeId) {
      loadTeamData();
    }
  }, [storeId]);

  const loadTeamData = async () => {
    try {
      setLoading(true);

      // Fetch team members and pending invitations in parallel
      const [membersResponse, invitationsResponse] = await Promise.all([
        StoreTeam.getTeamMembers(storeId),
        StoreTeam.getInvitations(storeId)
      ]);

      // Handle team members response structure
      let teamMembers = [];
      if (Array.isArray(membersResponse)) {
        teamMembers = membersResponse;
      } else if (membersResponse?.data?.team_members) {
        teamMembers = membersResponse.data.team_members;
      } else if (membersResponse?.team_members) {
        teamMembers = membersResponse.team_members;
      }

      setTeamMembers(teamMembers);
      setPendingInvitations(invitationsResponse || []);
    } catch (error) {
      console.error('❌ TeamManagement: Error loading team data:', error);
      console.error('❌ TeamManagement: Error details:', error.message);
      setFlashMessage({ type: 'error', message: 'Failed to load team data' });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async () => {
    try {
      await StoreTeam.inviteMember(storeId, inviteForm);
      setFlashMessage({ type: 'success', message: `Invitation sent to ${inviteForm.email}` });
      setInviteDialogOpen(false);
      setInviteForm({
        email: '',
        role: 'editor',
        message: '',
        permissions: DEFAULT_PERMISSIONS.editor
      });
      loadTeamData();
    } catch (error) {
      console.error('Error inviting member:', error);
      setFlashMessage({ type: 'error', message: 'Failed to send invitation' });
    }
  };

  const handleUpdateMember = async () => {
    try {
      await StoreTeam.updateMember(storeId, selectedMember.id, editForm);
      setFlashMessage({ type: 'success', message: 'Team member updated successfully' });
      setEditDialogOpen(false);
      setSelectedMember(null);
      loadTeamData();
    } catch (error) {
      console.error('Error updating member:', error);
      setFlashMessage({ type: 'error', message: 'Failed to update team member' });
    }
  };

  // Open confirmation dialogs
  const openRemoveMemberDialog = (memberId, email) => {
    setConfirmDialog({
      open: true,
      type: 'removeMember',
      data: { memberId, email }
    });
  };

  const openResendDialog = (invitationId, email) => {
    setConfirmDialog({
      open: true,
      type: 'resend',
      data: { invitationId, email }
    });
  };

  const openDeleteInvitationDialog = (invitationId, email) => {
    setConfirmDialog({
      open: true,
      type: 'deleteInvitation',
      data: { invitationId, email }
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({ open: false, type: null, data: null });
  };

  // Handle confirmed actions
  const handleConfirmAction = async () => {
    const { type, data } = confirmDialog;

    try {
      if (type === 'removeMember') {
        await StoreTeam.removeMember(storeId, data.memberId);
        setFlashMessage({ type: 'success', message: 'Team member removed successfully' });
      } else if (type === 'resend') {
        await StoreTeam.resendInvitation(storeId, data.invitationId);
        setFlashMessage({ type: 'success', message: `Invitation resent to ${data.email}` });
      } else if (type === 'deleteInvitation') {
        await StoreTeam.deleteInvitation(storeId, data.invitationId);
        setFlashMessage({ type: 'success', message: 'Invitation cancelled' });
      }
      loadTeamData();
    } catch (error) {
      console.error(`Error performing ${type}:`, error);
      // Use the actual error message from the API if available
      const errorMessage = error.message || 'An error occurred';
      setFlashMessage({ type: 'error', message: errorMessage });
    } finally {
      closeConfirmDialog();
    }
  };

  // Get dialog content based on type
  const getDialogContent = () => {
    const { type, data } = confirmDialog;

    if (type === 'resend') {
      return {
        icon: <Send className="w-6 h-6 text-blue-600" />,
        title: 'Resend Invitation',
        description: `Are you sure you want to resend the invitation to ${data?.email}? This will extend the expiration by 7 days.`,
        actionText: 'Resend',
        actionClass: 'bg-blue-600 hover:bg-blue-700'
      };
    } else if (type === 'deleteInvitation') {
      return {
        icon: <Trash2 className="w-6 h-6 text-red-600" />,
        title: 'Cancel Invitation',
        description: `Are you sure you want to cancel the invitation to ${data?.email}? This action cannot be undone.`,
        actionText: 'Cancel Invitation',
        actionClass: 'bg-red-600 hover:bg-red-700'
      };
    } else if (type === 'removeMember') {
      return {
        icon: <Trash2 className="w-6 h-6 text-red-600" />,
        title: 'Remove Team Member',
        description: `Are you sure you want to remove ${data?.email} from the team? They will lose access to this store.`,
        actionText: 'Remove',
        actionClass: 'bg-red-600 hover:bg-red-700'
      };
    }
    return {};
  };

  const openEditDialog = (member) => {
    setSelectedMember(member);
    setEditForm({
      role: member.role,
      permissions: member.permissions || DEFAULT_PERMISSIONS[member.role]
    });
    setEditDialogOpen(true);
  };

  const updateInvitePermissions = (role) => {
    setInviteForm(prev => ({
      ...prev,
      role,
      permissions: DEFAULT_PERMISSIONS[role]
    }));
  };

  const updatePermission = (permissionKey, value, isInvite = false) => {
    if (isInvite) {
      setInviteForm(prev => ({
        ...prev,
        permissions: {
          ...prev.permissions,
          [permissionKey]: value
        }
      }));
    } else {
      setEditForm(prev => ({
        ...prev,
        permissions: {
          ...prev.permissions,
          [permissionKey]: value
        }
      }));
    }
  };

  if (!storeId) {
    return (
      <Card className="material-elevation-1 border-0">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Please select a store to manage team members</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
      <Card className="material-elevation-1 border-0">
      <CardHeader>
        <div className="sm:flex items-center justify-between space-y-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Team Management
            </CardTitle>
            <CardDescription>
              Manage team members and their permissions for this store
            </CardDescription>
          </div>
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                <UserPlus className="w-4 h-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Invite Team Member{storeName ? ` to ${storeName}` : ''}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="team@example.com"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select 
                      value={inviteForm.role} 
                      onValueChange={updateInvitePermissions}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Permissions</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {Object.entries(inviteForm.permissions).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between">
                        <Label className="text-sm font-normal">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </Label>
                        <Switch
                          checked={value}
                          onCheckedChange={(checked) => updatePermission(key, checked, true)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="message">Welcome Message (Optional)</Label>
                  <Textarea
                    id="message"
                    placeholder="Welcome to the team! You now have access to our store."
                    value={inviteForm.message}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, message: e.target.value }))}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleInviteMember} disabled={!inviteForm.email}>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Invitation
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pending Invitations Section */}
            {pendingInvitations.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Pending Invitations ({pendingInvitations.length})
                </h3>
                <div className="space-y-2">
                  {pendingInvitations.map((invitation) => {
                    const RoleIcon = ROLE_ICONS[invitation.role] || Shield;
                    const expiresAt = new Date(invitation.expires_at);
                    const isExpiringSoon = expiresAt - new Date() < 2 * 24 * 60 * 60 * 1000; // 2 days

                    return (
                      <div
                        key={invitation.id}
                        className="sm:flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className="bg-yellow-100 text-yellow-700">
                              {invitation.invited_email?.charAt(0).toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{invitation.invited_email}</div>
                            <div className="text-sm text-gray-500">
                              Invited {new Date(invitation.created_at).toLocaleDateString()}
                              {' • '}
                              <span className={isExpiringSoon ? 'text-orange-600' : ''}>
                                Expires {expiresAt.toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={ROLE_COLORS[invitation.role]}>
                            <RoleIcon className="w-3 h-3 mr-1" />
                            {invitation.role?.charAt(0).toUpperCase() + invitation.role?.slice(1)}
                          </Badge>
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                            Pending
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openResendDialog(invitation.id, invitation.invited_email)}
                            title="Resend invitation"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteInvitationDialog(invitation.id, invitation.invited_email)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Cancel invitation"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Team Members Section */}
            {teamMembers.length === 0 && pendingInvitations.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No team members yet</p>
                <Button onClick={() => setInviteDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Invite your first team member
                </Button>
              </div>
            ) : teamMembers.length > 0 && (
              <>
                {pendingInvitations.length > 0 && (
                  <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Active Members ({teamMembers.length})
                  </h3>
                )}
                <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.map((member) => {
                const RoleIcon = ROLE_ICONS[member.role] || Shield;
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {member.User?.email?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{member.User?.email}</div>
                          <div className="text-sm text-gray-500">
                            {member.User?.first_name && member.User?.last_name 
                              ? `${member.User.first_name} ${member.User.last_name}`
                              : 'No name provided'
                            }
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ROLE_COLORS[member.role]}>
                        <RoleIcon className="w-3 h-3 mr-1" />
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(member.createdAt || member.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(member)}
                          title="Edit permissions"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openRemoveMemberDialog(member.id, member.User?.email)}
                          title="Remove from team"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
              </>
            )}
          </div>
        )}

        {/* Edit Member Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Team Member</DialogTitle>
            </DialogHeader>
            {selectedMember && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Avatar>
                    <AvatarFallback>
                      {selectedMember.User?.email?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{selectedMember.User?.email}</div>
                    <div className="text-sm text-gray-500">
                      Current role: {selectedMember.role}
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="edit-role">Role</Label>
                  <Select 
                    value={editForm.role} 
                    onValueChange={(role) => setEditForm(prev => ({ 
                      ...prev, 
                      role, 
                      permissions: DEFAULT_PERMISSIONS[role] 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Permissions</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {Object.entries(editForm.permissions).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between">
                        <Label className="text-sm font-normal">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </Label>
                        <Switch
                          checked={value}
                          onCheckedChange={(checked) => updatePermission(key, checked, false)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateMember}>
                    <Edit className="w-4 h-4 mr-2" />
                    Update Member
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog */}
        <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && closeConfirmDialog()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="flex items-center gap-3">
                {getDialogContent().icon}
                <AlertDialogTitle>{getDialogContent().title}</AlertDialogTitle>
              </div>
              <AlertDialogDescription>
                {getDialogContent().description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmAction}
                className={getDialogContent().actionClass}
              >
                {getDialogContent().actionText}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
    </>
  );
}