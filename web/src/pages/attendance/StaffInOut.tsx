import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Table, TableBody, TableCell,
  TableHead, TablePagination, TableRow, TextField, Typography,
} from '@mui/material';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage, isStale } from '../../api/client';
import type { Page, Shift, ShiftDetail } from '../../api/types';
import { useOrg } from '../../org/OrgContext';
import { EmptyState, Panel } from '../../components/common';
import { Loading } from '../../App';
import { CenterSelect, addDays, fmtTime, fromLocalInput, today, toLocalInput, useStaffOptions } from './shared';

/** Add a shift for someone who forgot to punch, or correct an existing one. Needs a reason. */
function ShiftEditDialog({ open, shift, onClose }: { open: boolean; shift?: Shift; onClose: () => void }) {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const staff = useStaffOptions(orgId, open && !shift);
  const [userId, setUserId] = useState('');
  const [inAt, setInAt] = useState('');
  const [outAt, setOutAt] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setUserId(shift?.userId ?? '');
    setInAt(toLocalInput(shift?.inAt));
    setOutAt(toLocalInput(shift?.outAt));
    setReason('');
    setError(null);
  }, [open, shift]);

  const save = useMutation({
    mutationFn: () => shift
      ? api.put(`/orgs/${orgId}/attendance/staff/${shift.id}`, { version: shift.version, inAt: fromLocalInput(inAt), outAt: fromLocalInput(outAt), reason: reason.trim() })
      : api.post(`/orgs/${orgId}/attendance/staff`, { userId, inAt: fromLocalInput(inAt), outAt: fromLocalInput(outAt), reason: reason.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['att-staff', orgId] }); qc.invalidateQueries({ queryKey: ['att-shift', orgId] }); onClose(); },
    onError: (e) => { setError(errorMessage(e)); if (isStale(e)) qc.invalidateQueries({ queryKey: ['att-staff', orgId] }); },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{shift ? `Correct shift · ${shift.staffName}` : 'Add shift'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {!shift && (
            <TextField select label="Staff" value={userId} onChange={(e) => setUserId(e.target.value)}
              error={staff.isError} helperText={staff.isError ? errorMessage(staff.error) : undefined}>
              {(staff.data ?? []).map((s) => <MenuItem key={s.userId} value={s.userId}>{s.firstName} {s.lastName ?? ''}</MenuItem>)}
            </TextField>
          )}
          <TextField type="datetime-local" label="In" value={inAt} onChange={(e) => setInAt(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField type="datetime-local" label="Out" value={outAt} onChange={(e) => setOutAt(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} inputProps={{ maxLength: 300 }} helperText="At least 3 characters" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={save.isPending || !inAt || reason.trim().length < 3 || (!shift && !userId)} onClick={() => save.mutate()}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function ShiftDialog({ id, canCorrect, onClose, onCorrect }: {
  id: string | null; canCorrect: boolean; onClose: () => void; onCorrect: (s: Shift) => void;
}) {
  const { orgId } = useOrg();
  const q = useQuery({
    queryKey: ['att-shift', orgId, id],
    queryFn: () => api.get<ShiftDetail>(`/orgs/${orgId}/attendance/staff/${id}`),
    enabled: !!id,
    gcTime: 0,
  });
  const d = q.data;
  const s = d?.shift;
  const row = (label: string, value?: string | number | null) =>
    value === undefined || value === null || value === '' ? null : (
      <Typography variant="body2"><b>{label}:</b> {value}</Typography>
    );
  return (
    <Dialog open={!!id} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{s ? `${s.staffName} · ${s.workDate}` : 'Shift'}</DialogTitle>
      <DialogContent>
        {q.isLoading ? <Loading /> : !s ? (q.isError ? <Alert severity="error">{errorMessage(q.error)}</Alert> : null) : (
          <Stack spacing={1} sx={{ mt: 1 }}>
            {row('In', fmtTime(s.inAt))}
            {row('Out', fmtTime(s.outAt))}
            {row('Class', s.centerName)}
            {row('Batch', s.batchName)}
            {s.inOutsideGeofence && <Chip size="small" color="warning" label="In outside geofence" sx={{ alignSelf: 'flex-start' }} />}
            {s.outOutsideGeofence && <Chip size="small" color="warning" label="Out outside geofence" sx={{ alignSelf: 'flex-start' }} />}
            {row('In distance (m)', s.inDistanceM)}
            {row('Out distance (m)', s.outDistanceM)}
            {row('Tasks', s.tasks)}
            {row('Device', [s.phoneType, s.deviceId].filter(Boolean).join(' · '))}
            {s.corrected && <Alert severity="info">Corrected by a supervisor{d?.correctionReason ? `: ${d.correctionReason}` : ''}</Alert>}
            <Stack direction="row" spacing={2} sx={{ pt: 1 }}>
              {d?.inSelfieUrl && <Box><Typography variant="caption">In selfie</Typography><img src={d.inSelfieUrl} alt="In selfie" style={{ display: 'block', maxWidth: 220, maxHeight: 220 }} /></Box>}
              {d?.outSelfieUrl && <Box><Typography variant="caption">Out selfie</Typography><img src={d.outSelfieUrl} alt="Out selfie" style={{ display: 'block', maxWidth: 220, maxHeight: 220 }} /></Box>}
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {canCorrect && s && <Button variant="contained" onClick={() => { onCorrect(s); onClose(); }}>Correct</Button>}
      </DialogActions>
    </Dialog>
  );
}

export function StaffInOut() {
  const { orgId, access, can, centerLabel } = useOrg();
  const approver = can('ATTENDANCE_APPROVAL', 'MANAGE');
  const [from, setFrom] = useState(addDays(today(), -6));
  const [to, setTo] = useState(today());
  const [centerId, setCenterId] = useState('');
  const [userId, setUserId] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [openId, setOpenId] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ open: boolean; shift?: Shift }>({ open: false });
  const staff = useStaffOptions(orgId, can('STAFF'));
  const list = useQuery({
    queryKey: ['att-staff', orgId, from, to, centerId, userId, page, size],
    queryFn: () => api.get<Page<Shift>>(`/orgs/${orgId}/attendance/staff`, { from, to, centerId, userId, page, size }),
    placeholderData: keepPreviousData,
  });
  // The API leaves device fields out unless the academy turned on "show device info".
  const device = !!list.data?.items.some((s) => s.deviceId || s.phoneType);
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); };

  return (
    <>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} useFlexGap flexWrap="wrap" alignItems="center">
        <TextField type="date" label="From" size="small" value={from} onChange={(e) => reset(setFrom)(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField type="date" label="To" size="small" value={to} onChange={(e) => reset(setTo)(e.target.value)} InputLabelProps={{ shrink: true }} />
        {!access.centerId && <CenterSelect orgId={orgId} size="small" label={centerLabel} value={centerId} onChange={reset(setCenterId)} />}
        {can('STAFF') && (
          <TextField select size="small" label="Staff" value={userId} onChange={(e) => reset(setUserId)(e.target.value)} sx={{ width: 200 }}>
            <MenuItem value="">All</MenuItem>
            {(staff.data ?? []).map((s) => <MenuItem key={s.userId} value={s.userId}>{s.firstName} {s.lastName ?? ''}</MenuItem>)}
          </TextField>
        )}
        {approver && <Button variant="contained" onClick={() => setEdit({ open: true })}>Add shift</Button>}
      </Stack>
      {list.isError && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(list.error)}</Alert>}
      <Panel>
        {list.isLoading ? <Loading /> : !list.data?.items.length ? <EmptyState text="No shifts in this period." /> : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>Staff</TableCell><TableCell>{centerLabel}</TableCell><TableCell>In</TableCell><TableCell>Out</TableCell>
                <TableCell>Location</TableCell><TableCell>Tasks</TableCell>
                {device && <><TableCell>Phone</TableCell><TableCell>Device</TableCell></>}
              </TableRow></TableHead>
              <TableBody>
                {list.data.items.map((s) => (
                  <TableRow key={s.id} hover sx={{ cursor: 'pointer' }} onClick={() => setOpenId(s.id)}>
                    <TableCell>{s.staffName}{s.corrected && <Chip size="small" label="corrected" sx={{ ml: 1 }} />}</TableCell>
                    <TableCell>{s.centerName ?? '—'}</TableCell>
                    <TableCell>{fmtTime(s.inAt)}</TableCell>
                    <TableCell>{s.outAt ? fmtTime(s.outAt) : <Chip size="small" color="info" label="Open" />}</TableCell>
                    <TableCell>{(s.inOutsideGeofence || s.outOutsideGeofence) && <Chip size="small" color="warning" label="Outside geofence" />}</TableCell>
                    <TableCell sx={{ maxWidth: 240 }}>{s.tasks ?? '—'}</TableCell>
                    {device && <><TableCell>{s.phoneType ?? '—'}</TableCell><TableCell>{s.deviceId ?? '—'}</TableCell></>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
        <TablePagination component="div" count={list.data?.total ?? 0} page={page} rowsPerPage={size} rowsPerPageOptions={[10, 20, 50]}
          onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setSize(parseInt(e.target.value, 10)); setPage(0); }} />
      </Panel>
      <ShiftDialog id={openId} canCorrect={approver} onClose={() => setOpenId(null)} onCorrect={(s) => setEdit({ open: true, shift: s })} />
      <ShiftEditDialog open={edit.open} shift={edit.shift} onClose={() => setEdit({ open: false })} />
    </>
  );
}
