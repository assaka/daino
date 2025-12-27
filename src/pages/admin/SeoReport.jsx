import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BarChart3, AlertCircle, CheckCircle, XCircle, Download } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function SeoReport() {
  const seoScore = 78;
  
  const issues = [
    { type: 'error', message: '12 pages missing meta descriptions', count: 12 },
    { type: 'warning', message: '5 pages with duplicate title tags', count: 5 },
    { type: 'warning', message: '3 images missing alt text', count: 3 },
    { type: 'success', message: 'All pages have canonical URLs', count: 0 }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          <h1 className="text-3xl font-bold">SEO Report</h1>
        </div>
        <Button>
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Overall SEO Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-5xl font-bold mb-2" style={{ color: seoScore > 70 ? '#10b981' : seoScore > 40 ? '#f59e0b' : '#ef4444' }}>
                {seoScore}%
              </div>
              <Progress value={seoScore} className="mb-2" />
              <p className="text-sm text-muted-foreground">
                {seoScore > 70 ? 'Good' : seoScore > 40 ? 'Needs Improvement' : 'Poor'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pages Analyzed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-5xl font-bold mb-2">247</div>
              <p className="text-sm text-muted-foreground">
                Last scan: 2 hours ago
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Critical Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-5xl font-bold text-red-500 mb-2">12</div>
              <p className="text-sm text-muted-foreground">
                Require immediate attention
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SEO Issues</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {issues.map((issue, index) => (
            <Alert key={index} className={
              issue.type === 'error' ? 'border-red-200 bg-red-50' :
              issue.type === 'warning' ? 'border-yellow-200 bg-yellow-50' :
              'border-green-200 bg-green-50'
            }>
              {issue.type === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
              {issue.type === 'warning' && <AlertCircle className="h-4 w-4 text-yellow-600" />}
              {issue.type === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
              <AlertDescription className="flex justify-between items-center">
                <span>{issue.message}</span>
                {issue.count > 0 && (
                  <Button size="sm" variant="outline">Fix Now</Button>
                )}
              </AlertDescription>
            </Alert>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-1">Add structured data</h3>
            <p className="text-sm text-muted-foreground">
              Implement Product schema markup to enhance search results
            </p>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-1">Improve page speed</h3>
            <p className="text-sm text-muted-foreground">
              Optimize images and enable caching to improve load times
            </p>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-1">Create XML sitemap</h3>
            <p className="text-sm text-muted-foreground">
              Generate and submit a sitemap to search engines
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}