import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, Table,
  TableBody, TableCell, TableHead, TableRow, TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage, fieldErrors } from '../api/client';
import type { HistoryEvent, HistoryEventType, Injury, InjurySeverity } from '../api/types';
import { useOrg } from '../org/OrgContext';
import { ConfirmDialog, EmptyState, clean, useForm } from '../components/common';
import { Loading } from '../App';

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** One small dialog to replace a student's tags: a comma-separated list. */
export function TagsDialog({ student, onClose }: { student: { id: string; tags: string[] } | null; onClose: () => void }) {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (student) { setText(student.tags.join(', ')); setError(null); }
  }, [student]);
  const save = useMutation({
    mutationFn: () => api.put<string[]>(`/orgs/${orgId}/students/${student!.id}/tags`, {
      tags: text.split(',').map((t) => t.trim()).filter(Boolean),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['students', orgId] }); onClose(); },
    onError: (e) => setError(Object.values(fieldErrors(e)).join(', ') || errorMessage(e)),
  });
  return (
    <Dialog open={!!student} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Tag Student</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField sx={{ mt: 1 }} label="Tags" value={text} onChange={(e) => setText(e.target.value)}
          helperText="Separate tags with commas. Up to 10 tags, 30 characters each." />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={save.isPending} onClick={() => save.mutate()}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

const EMPTY_INJURY = { injuryDate: '', bodyPart: '', severity: 'MINOR' as InjurySeverity, description: '', recoveredOn: '' };

function InjuryDialog({ open, studentId, injury, onClose }: { open: boolean; studentId: string; injury?: Injury; onClose: () => void }) {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const f = useForm({ ...EMPTY_INJURY });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setError(null);
    f.setErrors({});
    f.setValues(injury ? {
      injuryDate: injury.injuryDate, bodyPart: injury.bodyPart, severity: injury.severity,
      description: injury.description ?? '', recoveredOn: injury.recoveredOn ?? '',
    } : { ...EMPTY_INJURY });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, injury]);
  const base = `/orgs/${orgId}/students/${studentId}/injuries`;
  const save = useMutation({
    mutationFn: () => {
      const body = clean({ ...f.values });
      return injury ? api.put(`${base}/${injury.id}`, body) : api.post(base, body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['students', orgId, 'injuries', studentId] }); onClose(); },
    onError: (e) => { f.setErrors(fieldErrors(e)); setError(errorMessage(e)); },
  });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{injury ? 'Edit Injury' : 'Add Injury'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Injury Date" type="date" required {...f.field('injuryDate')} InputLabelProps={{ shrink: true }} inputProps={{ max: today }} />
          <TextField label="Body Part" required {...f.field('bodyPart')} inputProps={{ maxLength: 60 }} />
          <TextField select label="Severity" required {...f.field('severity')}>
            {(['MINOR', 'MODERATE', 'SEVERE'] as const).map((s) => <MenuItem key={s} value={s}>{titleCase(s)}</MenuItem>)}
          </TextField>
          <TextField label="Description" multiline minRows={2} {...f.field('description')} inputProps={{ maxLength: 1000 }} />
          <TextField label="Recovered On" type="date" {...f.field('recoveredOn')} InputLabelProps={{ shrink: true }}
            inputProps={{ min: f.values.injuryDate || undefined, max: today }} helperText={f.errors.recoveredOn ?? 'Leave empty while still injured'} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={save.isPending || !f.values.injuryDate || !f.values.bodyPart.trim()} onClick={() => save.mutate()}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

const SEVERITY_COLOR = { MINOR: 'default', MODERATE: 'warning', SEVERE: 'error' } as const;

/** Injuries tab: a table, with add / edit / delete for users who can manage students. */
export function StudentInjuries({ studentId, manage }: { studentId: string; manage: boolean }) {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; injury?: Injury }>({ open: false });
  const [del, setDel] = useState<Injury | null>(null);
  const q = useQuery({
    queryKey: ['students', orgId, 'injuries', studentId],
    queryFn: () => api.get<Injury[]>(`/orgs/${orgId}/students/${studentId}/injuries`),
  });
  const remove = useMutation({
    mutationFn: (i: Injury) => api.del(`/orgs/${orgId}/students/${studentId}/injuries/${i.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['students', orgId, 'injuries', studentId] }); setDel(null); },
  });
  if (q.isLoading) return <Loading />;
  if (q.isError) return <Alert severity="error" sx={{ m: 2 }}>{errorMessage(q.error)}</Alert>;
  const rows = q.data ?? [];
  return (
    <Box>
      {manage && (
        <Box sx={{ p: 2, pb: 0 }}>
          <Button startIcon={<AddIcon />} onClick={() => setDialog({ open: true })}>Add Injury</Button>
        </Box>
      )}
      {!rows.length ? <EmptyState text="No injuries logged." /> : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell><TableCell>Body Part</TableCell><TableCell>Severity</TableCell>
                <TableCell>Recovered On</TableCell><TableCell>Description</TableCell>{manage && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.injuryDate}</TableCell>
                  <TableCell>{i.bodyPart}</TableCell>
                  <TableCell><Chip size="small" color={SEVERITY_COLOR[i.severity]} label={titleCase(i.severity)} /></TableCell>
                  <TableCell>{i.recoveredOn ?? 'Still injured'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{i.description ?? '—'}</TableCell>
                  {manage && (
                    <TableCell align="right">
                      <IconButton size="small" aria-label="Edit injury" onClick={() => setDialog({ open: true, injury: i })}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" aria-label="Delete injury" onClick={() => setDel(i)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
      {manage && <InjuryDialog open={dialog.open} studentId={studentId} injury={dialog.injury} onClose={() => setDialog({ open: false })} />}
      <ConfirmDialog open={!!del} title="Delete injury" danger confirmLabel="Delete" text="Delete this injury entry? This cannot be undone."
        onClose={() => setDel(null)} onConfirm={() => del && remove.mutateAsync(del)} />
    </Box>
  );
}

const EVENT_LABEL: Record<HistoryEventType, string> = {
  REGISTERED: 'Registered', APPROVED: 'Approved', PLACEMENT_CHANGED: 'Class / batch changed', TRANSFERRED: 'Transferred',
  DEACTIVATED: 'Deactivated', REACTIVATED: 'Reactivated', DEREGISTERED: 'Deregistered',
};

const place = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ');

function change(e: HistoryEvent): string {
  const from = place(e.fromAcademy, e.fromCenter, e.fromBatches);
  const to = place(e.toAcademy, e.toCenter, e.toBatches);
  return from || to ? `${from || '—'} → ${to || '—'}` : '';
}

/** History tab: read-only, newest first. */
export function StudentHistory({ studentId }: { studentId: string }) {
  const { orgId } = useOrg();
  const q = useQuery({
    queryKey: ['students', orgId, 'history', studentId],
    queryFn: () => api.get<HistoryEvent[]>(`/orgs/${orgId}/students/${studentId}/history`),
  });
  if (q.isLoading) return <Loading />;
  if (q.isError) return <Alert severity="error" sx={{ m: 2 }}>{errorMessage(q.error)}</Alert>;
  if (!q.data?.length) return <EmptyState text="No history yet." />;
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead><TableRow><TableCell>When</TableCell><TableCell>Event</TableCell><TableCell>Change</TableCell><TableCell>By</TableCell></TableRow></TableHead>
        <TableBody>
          {q.data.map((e) => (
            <TableRow key={e.id}>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(e.occurredAt).toLocaleString()}</TableCell>
              <TableCell>{EVENT_LABEL[e.eventType]}</TableCell>
              <TableCell>{change(e) || '—'}</TableCell>
              <TableCell>{e.actorName ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
