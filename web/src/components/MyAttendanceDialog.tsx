import { useRef, useState } from 'react';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../api/client';
import type { FileResponse, MyDay } from '../api/types';
import { useOrg } from '../org/OrgContext';
import { Loading } from '../App';
import { fmtTime } from '../pages/attendance/shared';

function deviceId() {
  let id = localStorage.getItem('athleet.deviceId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('athleet.deviceId', id);
  }
  return id;
}

/** Position is optional: never blocks a punch. */
function currentPosition(): Promise<{ latitude: number; longitude: number; accuracyM: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({
        latitude: Number(p.coords.latitude.toFixed(6)),
        longitude: Number(p.coords.longitude.toFixed(6)),
        accuracyM: Math.round(p.coords.accuracy),
      }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 },
    );
  });
}

export function MyAttendanceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const base = `/orgs/${orgId}/attendance/staff`;
  const [selfie, setSelfie] = useState<File | null>(null);
  const [tasks, setTasks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0); // remounts the file input to clear it
  // One attempt = one clientId (and one uploaded selfie), reused when the same attempt is retried.
  const attempt = useRef<{ clientId: string; file: File | null; fileId?: string }>({ clientId: crypto.randomUUID(), file: null });

  const today = useQuery({
    queryKey: ['att-me-today', orgId],
    queryFn: () => api.get<MyDay>(`${base}/me/today`),
    enabled: open,
    gcTime: 0,
  });
  const d = today.data;
  const open_ = d?.openShift;

  const newAttempt = () => { attempt.current = { clientId: crypto.randomUUID(), file: null }; setSelfie(null); setTasks(''); setInputKey((k) => k + 1); };
  const punch = useMutation({
    mutationFn: async (kind: 'in' | 'out') => {
      const a = attempt.current;
      if (selfie && (a.file !== selfie || !a.fileId)) {
        const form = new FormData();
        form.append('purpose', 'ATTENDANCE_SELFIE');
        form.append('file', selfie);
        const f = await api.upload<FileResponse>(`/orgs/${orgId}/files`, form);
        a.file = selfie;
        a.fileId = f.id;
      }
      const pos = await currentPosition();
      const common = { clientId: a.clientId, selfieFileId: selfie ? a.fileId : undefined, ...(pos ?? {}) };
      return kind === 'in'
        ? api.post(`${base}/me/punch-in`, { ...common, deviceId: deviceId(), phoneType: (navigator.platform || navigator.userAgent).slice(0, 60) })
        : api.post(`${base}/me/punch-out`, { ...common, tasksAccomplished: tasks.trim() || undefined });
    },
    onSuccess: () => {
      newAttempt();
      setError(null);
      qc.invalidateQueries({ queryKey: ['att-me-today', orgId] });
      qc.invalidateQueries({ queryKey: ['att-staff', orgId] });
      qc.invalidateQueries({ queryKey: ['att-live', orgId] });
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const needSelfie = !!d?.config.selfieRequired && !selfie;
  const needTasks = !!open_ && !!d?.config.tasksOnOut && !tasks.trim();
  const close = () => { setError(null); onClose(); };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>My attendance{d ? ` · ${d.date}` : ''}</DialogTitle>
      <DialogContent>
        {today.isLoading ? <Loading /> : !d ? (today.isError ? <Alert severity="error">{errorMessage(today.error)}</Alert> : null) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
            <Alert severity={open_ ? 'success' : 'info'}>
              {open_ ? `You are punched in since ${fmtTime(open_.inAt)}.` : 'You are not punched in.'}
            </Alert>
            <Stack spacing={1}>
              <Typography variant="body2">
                Selfie{d.config.selfieRequired ? ' (required)' : ' (optional)'}
              </Typography>
              <input key={inputKey} type="file" accept="image/jpeg,image/png" capture="user"
                onChange={(e) => setSelfie(e.target.files?.[0] ?? null)} />
            </Stack>
            {open_ && (
              <TextField label={`Tasks accomplished${d.config.tasksOnOut ? ' (required)' : ''}`} multiline minRows={3} value={tasks}
                onChange={(e) => setTasks(e.target.value)} inputProps={{ maxLength: 1000 }} />
            )}
            <Typography variant="subtitle2">Today</Typography>
            {!d.shifts.length ? <Typography variant="body2" color="text.secondary">No shifts yet.</Typography> : (
              <Table size="small">
                <TableHead><TableRow><TableCell>In</TableCell><TableCell>Out</TableCell><TableCell>Tasks</TableCell></TableRow></TableHead>
                <TableBody>
                  {d.shifts.map((s) => (
                    <TableRow key={s.id}><TableCell>{fmtTime(s.inAt)}</TableCell><TableCell>{fmtTime(s.outAt)}</TableCell><TableCell>{s.tasks ?? '—'}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Close</Button>
        {d && (open_
          ? <Button variant="contained" color="secondary" disabled={punch.isPending || needSelfie || needTasks} onClick={() => punch.mutate('out')}>Punch out</Button>
          : <Button variant="contained" disabled={punch.isPending || needSelfie} onClick={() => punch.mutate('in')}>Punch in</Button>)}
      </DialogActions>
    </Dialog>
  );
}
