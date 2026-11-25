import { useEffect, useState } from 'react';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage, isStale } from '../../api/client';
import type { MarkStatus, SessionDetail } from '../../api/types';
import { useOrg } from '../../org/OrgContext';
import { Loading } from '../../App';
import { MarkChip, StatusChip } from './shared';

type Marks = Record<string, { status?: MarkStatus; remark: string }>;

/** One batch's session for a date: mark and submit (coach), or review it (approver). */
export function SessionDialog({ batchId, date, onClose }: { batchId: string | null; date: string; onClose: () => void }) {
  const { orgId, can } = useOrg();
  const qc = useQueryClient();
  const base = `/orgs/${orgId}/attendance`;
  const [marks, setMarks] = useState<Marks>({});
  const [error, setError] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<'reject' | 'reopen' | null>(null);
  const [reason, setReason] = useState('');

  const q = useQuery({
    queryKey: ['att-session', orgId, batchId, date],
    queryFn: () => api.get<SessionDetail>(`${base}/batches/${batchId}/sessions/${date}`),
    enabled: !!batchId,
    gcTime: 0,
  });
  const d = q.data;

  useEffect(() => {
    if (d) setMarks(Object.fromEntries(d.marks.map((m) => [m.studentId, { status: m.status, remark: m.remark ?? '' }])));
  }, [d]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['att-session', orgId] });
    qc.invalidateQueries({ queryKey: ['att-batches', orgId] });
    qc.invalidateQueries({ queryKey: ['att-approvals', orgId] });
    qc.invalidateQueries({ queryKey: ['att-live', orgId] });
  };
  const fail = (e: unknown) => { setError(errorMessage(e)); if (isStale(e)) refresh(); };
  const close = () => { setError(null); setReasonFor(null); setReason(''); onClose(); };

  const body = () => ({
    version: d?.version ?? null,
    marks: Object.entries(marks).map(([studentId, m]) => ({ studentId, status: m.status, remark: m.remark.trim() || undefined })),
  });
  const save = useMutation({
    mutationFn: () => api.put<SessionDetail>(`${base}/batches/${batchId}/sessions/${date}`, body()),
    onSuccess: () => { setError(null); refresh(); },
    onError: fail,
  });
  const submit = useMutation({
    mutationFn: async () => {
      const saved = await api.put<SessionDetail>(`${base}/batches/${batchId}/sessions/${date}`, body());
      return api.post(`${base}/sessions/${saved.id}/submit`, { version: saved.version });
    },
    onSuccess: () => { refresh(); close(); },
    onError: fail,
  });
  const transition = useMutation({
    mutationFn: (a: { action: 'approve' | 'reject' | 'reopen'; reason?: string }) =>
      api.post(`${base}/sessions/${d!.id}/${a.action}`, { version: d!.version, reason: a.reason }),
    onSuccess: () => { refresh(); close(); },
    onError: fail,
  });

  const setMark = (id: string, patch: Partial<Marks[string]>) => setMarks((m) => ({ ...m, [id]: { ...m[id], remark: m[id]?.remark ?? '', ...patch } }));
  const busy = save.isPending || submit.isPending || transition.isPending;
  const canEdit = !!d && d.editable && d.canSubmit;
  const canReopen = !!d && d.status === 'APPROVED' && can('ATTENDANCE_APPROVAL', 'MANAGE');

  return (
    <Dialog open={!!batchId} onClose={close} maxWidth="md" fullWidth>
      <DialogTitle>
        {d ? `${d.batchName} · ${d.date}` : 'Attendance'} {d && <StatusChip status={d.status} />}
      </DialogTitle>
      <DialogContent>
        {q.isLoading ? <Loading /> : !d ? (q.isError ? <Alert severity="error">{errorMessage(q.error)}</Alert> : null) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
            {d.reviewReason && (d.status === 'REJECTED' || d.status === 'DRAFT') && (
              <Alert severity="warning">{d.status === 'REJECTED' ? 'Rejected' : 'Sent back'}: {d.reviewReason}</Alert>
            )}
            {canEdit && (
              <Button size="small" sx={{ alignSelf: 'flex-start' }}
                onClick={() => setMarks((m) => Object.fromEntries(d.marks.map((r) => [r.studentId, { remark: m[r.studentId]?.remark ?? '', status: 'PRESENT' as MarkStatus }])))}>
                Mark all present
              </Button>
            )}
            {!d.marks.length ? <Typography color="text.secondary">No students in this batch.</Typography> : (
              <Table size="small">
                <TableHead><TableRow><TableCell>ID</TableCell><TableCell>Student</TableCell><TableCell>Status</TableCell><TableCell>Remark</TableCell></TableRow></TableHead>
                <TableBody>
                  {d.marks.map((r) => {
                    const m = marks[r.studentId];
                    return (
                      <TableRow key={r.studentId}>
                        <TableCell>{r.studentNo}</TableCell>
                        <TableCell>{r.studentName}</TableCell>
                        <TableCell>
                          {canEdit ? (
                            <ToggleButtonGroup size="small" exclusive value={m?.status ?? null}
                              onChange={(_, v) => v && setMark(r.studentId, { status: v })}>
                              <ToggleButton value="PRESENT" color="success">Present</ToggleButton>
                              <ToggleButton value="ABSENT" color="error">Absent</ToggleButton>
                            </ToggleButtonGroup>
                          ) : <MarkChip status={r.status} />}
                        </TableCell>
                        <TableCell>
                          {canEdit
                            ? <TextField size="small" value={m?.remark ?? ''} inputProps={{ maxLength: 200 }} onChange={(e) => setMark(r.studentId, { remark: e.target.value })} />
                            : r.remark}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {reasonFor && (
              <TextField label={reasonFor === 'reject' ? 'Reason for rejection' : 'Reason for reopening'} value={reason} autoFocus
                onChange={(e) => setReason(e.target.value)} inputProps={{ maxLength: 500 }} helperText="At least 3 characters" />
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Close</Button>
        {canEdit && !reasonFor && (
          <>
            <Button disabled={busy} onClick={() => save.mutate()}>Save draft</Button>
            <Button variant="contained" disabled={busy} onClick={() => submit.mutate()}>Submit</Button>
          </>
        )}
        {d?.canReview && !reasonFor && (
          <>
            <Button color="error" disabled={busy} onClick={() => setReasonFor('reject')}>Reject</Button>
            <Button variant="contained" disabled={busy} onClick={() => transition.mutate({ action: 'approve' })}>Approve</Button>
          </>
        )}
        {canReopen && !reasonFor && <Button color="warning" disabled={busy} onClick={() => setReasonFor('reopen')}>Reopen</Button>}
        {reasonFor && (
          <>
            <Button disabled={busy} onClick={() => { setReasonFor(null); setReason(''); }}>Back</Button>
            <Button variant="contained" color={reasonFor === 'reject' ? 'error' : 'warning'} disabled={busy || reason.trim().length < 3}
              onClick={() => transition.mutate({ action: reasonFor, reason: reason.trim() })}>
              {reasonFor === 'reject' ? 'Reject' : 'Reopen'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
