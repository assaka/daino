import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import abTestService from '@/services/abTestService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  FlaskConical,
  Plus,
  MoreVertical,
  Play,
  Pause,
  CheckCircle2,
  Archive,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Clock,
  Users,
  Target,
  Loader2,
  Edit,
  Eye,
  Trash2,
  Copy,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';

// Lazy load the child components to avoid issues
const ABTestEditor = React.lazy(() => import('@/components/admin/ab-testing/ABTestEditor'));
const ABTestResults = React.lazy(() => import('@/components/admin/ab-testing/ABTestResults'));

export default function ABTesting() {
  const { selectedStore } = useStoreSelection();
  const queryClient = useQueryClient();
  const [selectedTest, setSelectedTest] = useState(null);
  const [viewMode, setViewMode] = useState(null); // 'edit', 'results', null
  const [filterStatus, setFilterStatus] = useState('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [testToAction, setTestToAction] = useState(null);

  // Fetch all tests
  const { data: testsData, isLoading } = useQuery({
    queryKey: ['ab-tests', selectedStore?.id, filterStatus],
    queryFn: () => abTestService.getTests(
      selectedStore.id,
      filterStatus === 'all' ? null : filterStatus
    ),
    enabled: !!selectedStore?.id,
  });

  const tests = testsData?.data || [];

  // Mutations
  const startTestMutation = useMutation({
    mutationFn: (testId) => abTestService.startTest(selectedStore.id, testId),
    onSuccess: () => {
      queryClient.invalidateQueries(['ab-tests']);
    },
  });

  const pauseTestMutation = useMutation({
    mutationFn: (testId) => abTestService.pauseTest(selectedStore.id, testId),
    onSuccess: () => {
      queryClient.invalidateQueries(['ab-tests']);
    },
  });

  const completeTestMutation = useMutation({
    mutationFn: ({ testId, winnerVariantId }) =>
      abTestService.completeTest(selectedStore.id, testId, winnerVariantId),
    onSuccess: () => {
      queryClient.invalidateQueries(['ab-tests']);
    },
  });

  const deleteTestMutation = useMutation({
    mutationFn: (testId) => abTestService.deleteTest(selectedStore.id, testId),
    onSuccess: () => {
      queryClient.invalidateQueries(['ab-tests']);
    },
  });

  const handleCreateTest = () => {
    setSelectedTest(null);
    setViewMode('edit');
  };

  const handleEditTest = (test) => {
    setSelectedTest(test);
    setViewMode('edit');
  };

  const handleViewResults = (test) => {
    setSelectedTest(test);
    setViewMode('results');
  };

  const handleCloseDialog = () => {
    setViewMode(null);
    setSelectedTest(null);
  };

  const handleRecreateTest = (test) => {
    // Create a copy of the test without id and dates, reset status to draft
    const recreatedTest = {
      ...test,
      id: undefined,
      name: `${test.name} (Copy)`,
      status: 'draft',
      start_date: null,
      end_date: null,
      created_at: undefined,
      updated_at: undefined,
      winner_variant_id: undefined,
    };
    setSelectedTest(recreatedTest);
    setViewMode('edit');
  };

  const handleDeleteClick = (test) => {
    setTestToAction(test);
    setDeleteDialogOpen(true);
  };

  const handleCompleteClick = (test) => {
    setTestToAction(test);
    setCompleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (testToAction) {
      deleteTestMutation.mutate(testToAction.id);
    }
    setDeleteDialogOpen(false);
    setTestToAction(null);
  };

  const handleConfirmComplete = () => {
    if (testToAction) {
      completeTestMutation.mutate({ testId: testToAction.id });
    }
    setCompleteDialogOpen(false);
    setTestToAction(null);
  };

  const getStatusBadge = (status) => {
    const variants = {
      draft: { label: 'Draft', className: 'bg-gray-100 text-gray-800' },
      running: { label: 'Running', className: 'bg-green-100 text-green-800' },
      paused: { label: 'Paused', className: 'bg-yellow-100 text-yellow-800' },
      completed: { label: 'Completed', className: 'bg-blue-100 text-blue-800' },
      archived: { label: 'Archived', className: 'bg-gray-100 text-gray-600' },
    };
    const variant = variants[status] || variants.draft;
    return <Badge variant="outline" className={variant.className}>{variant.label}</Badge>;
  };

  const stats = {
    total: tests.length,
    running: tests.filter(t => t.status === 'running').length,
    completed: tests.filter(t => t.status === 'completed').length,
    draft: tests.filter(t => t.status === 'draft').length,
  };

  if (!selectedStore) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Please select a store first</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <FlaskConical className="w-8 h-8" />
              A/B Testing
            </h1>
            <p className="text-muted-foreground">
              Test different versions of your store to optimize conversions
            </p>
          </div>
          <Button onClick={handleCreateTest}>
            <Plus className="w-4 h-4 mr-2" />
            Create Test
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Tests</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <BarChart3 className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Running</p>
                  <p className="text-2xl font-bold text-green-600">{stats.running}</p>
                </div>
                <Play className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.completed}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Drafts</p>
                  <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
                </div>
                <Clock className="w-8 h-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tests Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Your Tests</CardTitle>
              <Tabs value={filterStatus} onValueChange={setFilterStatus}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="draft">Draft</TabsTrigger>
                  <TabsTrigger value="running">Running</TabsTrigger>
                  <TabsTrigger value="completed">Completed</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : tests.length === 0 ? (
              <div className="text-center py-12">
                <FlaskConical className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No tests yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first A/B test to start optimizing your store
                </p>
                <Button onClick={handleCreateTest}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Test
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Variants</TableHead>
                    <TableHead>Primary Metric</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tests.map((test) => (
                    <TableRow key={test.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{test.name}</div>
                          {test.description && (
                            <div className="text-sm text-muted-foreground">
                              {test.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(test.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span>{test.variants?.length || 0} variants</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{test.primary_metric}</Badge>
                      </TableCell>
                      <TableCell>
                        {test.start_date
                          ? format(new Date(test.start_date), 'MMM d, yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {test.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startTestMutation.mutate(test.id)}
                              disabled={startTestMutation.isPending}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                          {test.status === 'running' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewResults(test)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => pauseTestMutation.mutate(test.id)}
                                disabled={pauseTestMutation.isPending}
                              >
                                <Pause className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {test.status === 'paused' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startTestMutation.mutate(test.id)}
                              disabled={startTestMutation.isPending}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                          {test.status === 'completed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewResults(test)}
                            >
                              <BarChart3 className="w-4 h-4" />
                            </Button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditTest(test)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleViewResults(test)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Results
                              </DropdownMenuItem>
                              {test.status === 'completed' && (
                                <DropdownMenuItem onClick={() => handleRecreateTest(test)}>
                                  <Copy className="w-4 h-4 mr-2" />
                                  Create Test
                                </DropdownMenuItem>
                              )}
                              {(test.status === 'running' || test.status === 'paused') && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleCompleteClick(test)}>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Complete Test
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteClick(test)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={viewMode === 'edit'} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTest ? 'Edit Test' : 'Create New Test'}
            </DialogTitle>
            <DialogDescription>
              {selectedTest
                ? 'Modify your test configuration'
                : 'Set up a new A/B test for your store'}
            </DialogDescription>
          </DialogHeader>
          <React.Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
            <ABTestEditor
              test={selectedTest}
              storeId={selectedStore.id}
              onSave={() => {
                queryClient.invalidateQueries(['ab-tests']);
                handleCloseDialog();
              }}
              onCancel={handleCloseDialog}
            />
          </React.Suspense>
        </DialogContent>
      </Dialog>

      {/* Results Dialog */}
      <Dialog open={viewMode === 'results'} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Test Results: {selectedTest?.name}</DialogTitle>
            <DialogDescription>
              View statistical analysis and performance metrics
            </DialogDescription>
          </DialogHeader>
          {selectedTest && (
            <React.Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
              <ABTestResults testId={selectedTest.id} storeId={selectedStore.id} />
            </React.Suspense>
          )}
        </DialogContent>
      </Dialog>

      {/* Complete Test Confirmation Dialog */}
      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
              </div>
              <AlertDialogTitle>Complete Test</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-2">
              Are you sure you want to complete "{testToAction?.name}"? This will stop the test and
              no more data will be collected. You can still view the results afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmComplete}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Complete Test
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Test Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <AlertDialogTitle>Delete Test</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-2">
              Are you sure you want to delete "{testToAction?.name}"? This action cannot be undone.
              {testToAction?.status === 'running' && (
                <span className="block mt-2 text-amber-600 font-medium">
                  Warning: This test is currently running and will be stopped.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Test
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
