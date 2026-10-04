'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, Send, Copy, Power } from 'lucide-react';
import { toast } from 'sonner';

interface NoticeTemplate {
  id: string;
  notice_type: string;
  name: string;
  subject: string;
  body_text: string;
  body_html?: string;
  channel: string;
  enabled: boolean;
  variables: Record<string, { type: string; required: boolean; description: string }>;
  version: number;
}

const NOTICE_TYPE_LABELS: Record<string, string> = {
  checkout_receipt: 'Checkout Receipt',
  checkin_receipt: 'Checkin Receipt',
  due_soon: 'Due Soon',
  overdue: 'Overdue',
  overdue_escalation: 'Overdue Escalation',
  hold_ready: 'Hold Ready',
  hold_cancelled: 'Hold Cancelled',
  renewal_confirmation: 'Renewal Confirmation',
  fine_notice: 'Fine Notice',
  welcome: 'Welcome',
  email_verification: 'Email Verification',
  password_reset: 'Password Reset',
  account_expiry: 'Account Expiry',
  account_restriction: 'Account Restriction',
  submission_received: 'Submission Received',
  reviewer_assigned: 'Reviewer Assigned',
  changes_requested: 'Changes Requested',
  returned_for_correction: 'Returned for Correction',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
  claim_notice: 'Claim Notice',
  order_notice: 'Order Notice',
  vendor_notice: 'Vendor Notice',
  custom_notice: 'Custom Notice',
};

const SAMPLE_CONTEXT: Record<string, unknown> = {
  patron_name: 'John Doe',
  item_title: 'Introduction to Library Science',
  item_barcode: 'LIB-001234',
  due_date: '2026-10-15',
  return_date: '2026-10-10',
  fine_amount: '500.00',
  hold_pickup_location: 'Main Library Desk',
  library_name: 'ESUT Library',
  repository_title: 'Research Paper on AI',
  workflow_status: 'approved',
};

export default function NoticesPage() {
  const [templates, setTemplates] = useState<NoticeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<NoticeTemplate | null>(null);
  const [previewData, setPreviewData] = useState<{ subject: string; html: string; text: string } | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [filterChannel, setFilterChannel] = useState<string>('all');

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notices/templates');
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
        if (data.templates.length > 0 && !selectedTemplate) {
          setSelectedTemplate(data.templates[0]);
        }
      }
    } catch (err) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [selectedTemplate]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handlePreview = async () => {
    if (!selectedTemplate) return;
    try {
      const res = await fetch('/api/admin/notices/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', template: selectedTemplate, context: SAMPLE_CONTEXT }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewData(data.rendered);
      }
    } catch (err) {
      toast.error('Preview failed');
    }
  };

  const handleTestSend = async () => {
    if (!selectedTemplate || !testEmail) return;
    setSending(true);
    try {
      const res = await fetch('/api/admin/notices/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noticeType: selectedTemplate.notice_type,
          channel: 'email',
          email: testEmail,
          context: SAMPLE_CONTEXT,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Test sent via ${data.delivery?.status ?? 'unknown'}`);
      } else {
        toast.error(data.error || 'Test send failed');
      }
    } catch (err) {
      toast.error('Test send failed');
    } finally {
      setSending(false);
    }
  };

  const handleToggle = async (templateId: string, enabled: boolean) => {
    try {
      const res = await fetch('/api/admin/notices/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', templateId, enabled }),
      });
      const data = await res.json();
      if (data.success) {
        setTemplates((prev) => prev.map((t) => (t.id === templateId ? { ...t, enabled } : t)));
        toast.success(enabled ? 'Template enabled' : 'Template disabled');
      }
    } catch (err) {
      toast.error('Toggle failed');
    }
  };

  const handleDuplicate = async (template: NoticeTemplate) => {
    try {
      const res = await fetch('/api/admin/notices/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', templateId: template.id, newName: `${template.name} (Copy)` }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Template duplicated');
        fetchTemplates();
      }
    } catch (err) {
      toast.error('Duplicate failed');
    }
  };

  const filteredTemplates = filterChannel === 'all'
    ? templates
    : templates.filter((t) => t.channel === filterChannel);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notice Templates</h1>
          <p className="text-sm text-muted-foreground">Manage notice templates, preview, and test send</p>
        </div>
        <Select value={filterChannel} onValueChange={setFilterChannel}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="in-app">In-App</SelectItem>
            <SelectItem value="print">Print</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-lg font-semibold">Templates ({filteredTemplates.length})</h2>
          {filteredTemplates.map((template) => (
            <Card
              key={template.id}
              className={`cursor-pointer transition-colors ${
                selectedTemplate?.id === template.id ? 'border-primary ring-1 ring-primary' : ''
              }`}
              onClick={() => setSelectedTemplate(template)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{template.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {NOTICE_TYPE_LABELS[template.notice_type] ?? template.notice_type}
                    </p>
                  </div>
                  <Badge variant={template.enabled ? 'default' : 'secondary'}>
                    {template.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">v{template.version} | {template.channel}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-2">
          {selectedTemplate ? (
            <Tabs defaultValue="edit">
              <TabsList>
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="test">Test Send</TabsTrigger>
                <TabsTrigger value="variables">Variables</TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Template Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={selectedTemplate.name} readOnly />
                      </div>
                      <div className="space-y-2">
                        <Label>Channel</Label>
                        <Input value={selectedTemplate.channel} readOnly />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Subject</Label>
                      <Input value={selectedTemplate.subject} readOnly />
                    </div>
                    <div className="space-y-2">
                      <Label>Body (Text)</Label>
                      <Textarea value={selectedTemplate.body_text} readOnly rows={6} />
                    </div>
                    {selectedTemplate.body_html && (
                      <div className="space-y-2">
                        <Label>Body (HTML)</Label>
                        <Textarea value={selectedTemplate.body_html} readOnly rows={6} />
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={selectedTemplate.enabled}
                          onCheckedChange={(checked) => handleToggle(selectedTemplate.id, checked)}
                        />
                        <Label>Enabled</Label>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleDuplicate(selectedTemplate)}>
                        <Copy className="h-4 w-4 mr-1" /> Duplicate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="preview">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Preview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert>
                      <AlertDescription>SAMPLE DATA — preview only, not sent</AlertDescription>
                    </Alert>
                    <Button onClick={handlePreview} variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-1" /> Render Preview
                    </Button>
                    {previewData && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Subject</Label>
                          <div className="p-3 bg-muted rounded-md text-sm">{previewData.subject}</div>
                        </div>
                        <div className="space-y-2">
                          <Label>HTML Body</Label>
                          <div className="p-3 bg-muted rounded-md text-sm overflow-auto max-h-64">
                            <pre className="whitespace-pre-wrap">{previewData.html}</pre>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Text Body</Label>
                          <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">{previewData.text}</div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="test">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Test Send</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert>
                      <AlertDescription>
                        Sends a test notice to the specified email. Clearly marked as TEST in delivery log.
                      </AlertDescription>
                    </Alert>
                    <div className="space-y-2">
                      <Label>Test Recipient Email</Label>
                      <Input
                        type="email"
                        placeholder="test@example.com"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleTestSend} disabled={sending || !testEmail}>
                      {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                      Send Test
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="variables">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Template Variables</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(selectedTemplate.variables).map(([key, schema]) => (
                        <div key={key} className="flex items-center justify-between p-3 bg-muted rounded-md">
                          <div>
                            <code className="text-sm font-mono">{`{{${key}}}`}</code>
                            <p className="text-xs text-muted-foreground mt-1">{schema.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{schema.type}</Badge>
                            {schema.required && <Badge>Required</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Select a template to view details
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
