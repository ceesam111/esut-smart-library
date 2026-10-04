'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface DeliveryRecord {
  id: string;
  notice_type: string;
  channel: string;
  status: string;
  recipient_email?: string;
  error_category?: string;
  error_detail?: string;
  retry_count: number;
  provider_message_id?: string;
  created_at: string;
  sent_at?: string;
  failed_at?: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'secondary',
  QUEUED: 'secondary',
  SENT: 'default',
  DELIVERED: 'default',
  FAILED: 'destructive',
  CANCELLED: 'outline',
  SUPPRESSED: 'outline',
};

export default function DeliveryHistoryPage() {
  const [history, setHistory] = useState<DeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterChannel !== 'all') params.set('channel', filterChannel);
      const res = await fetch(`/api/admin/notices/test-send?${params}`);
      const data = await res.json();
      if (data.success) {
        setHistory(data.history);
      }
    } catch (err) {
      toast.error('Failed to load delivery history');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterChannel]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      const res = await fetch('/api/admin/notices/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry', deliveryId: id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Retry initiated');
        fetchHistory();
      } else {
        toast.error(data.error || 'Retry failed');
      }
    } catch (err) {
      toast.error('Retry failed');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Delivery History</h1>
          <p className="text-sm text-muted-foreground">Inspect notice delivery status and retry failures</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchHistory}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label>Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="SUPPRESSED">Suppressed</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label>Channel</Label>
          <Select value={filterChannel} onValueChange={setFilterChannel}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="in-app">In-App</SelectItem>
              <SelectItem value="print">Print</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Alert>
        <AlertDescription>
          Delivery records show the full lifecycle: queued, sent, delivered, failed, or suppressed. Retry is available for failed deliveries.
        </AlertDescription>
      </Alert>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left font-medium">Notice Type</th>
                    <th className="p-3 text-left font-medium">Channel</th>
                    <th className="p-3 text-left font-medium">Status</th>
                    <th className="p-3 text-left font-medium">Recipient</th>
                    <th className="p-3 text-left font-medium">Retries</th>
                    <th className="p-3 text-left font-medium">Date</th>
                    <th className="p-3 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => (
                    <tr key={record.id} className="border-t">
                      <td className="p-3">{record.notice_type}</td>
                      <td className="p-3">{record.channel}</td>
                      <td className="p-3">
                        <Badge variant={STATUS_COLORS[record.status] as 'default' | 'destructive' | 'secondary' | 'outline' ?? 'outline'}>
                          {record.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{record.recipient_email ?? '—'}</td>
                      <td className="p-3">{record.retry_count}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(record.created_at).toLocaleString()}
                      </td>
                      <td className="p-3">
                        {record.status === 'FAILED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRetry(record.id)}
                            disabled={retryingId === record.id}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No delivery records found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
