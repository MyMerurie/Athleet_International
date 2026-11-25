import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../api/client';
import type { BulkAction, ImportResult, StudentStatus } from '../api/types';
import { useOrg } from '../org/OrgContext';

const LABEL: Record<BulkAction, string> = { DEACTIVATE: 'Deactivate', ACTIVATE: 'Activate', DEREGISTER: 'Deregister' };

/** One dialog for every bulk action: pick the action (and a reason to deregister), apply it to the selected students. */
export function BulkDialog({ open, status, ids, onClose, onDone }: {
  open: boolean; status: StudentStatus; ids: string[]; onClose: () => void; onDone: () => void;
}) {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const actions: BulkAction[] = status === 'INACTIVE' ? ['ACTIVATE', 'DEREGISTER'] : ['DEACTIVATE', 'DEREGISTER'];
  const [action, setAction] = useState<BulkAction>(actions[0]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) { setAction(actions[0]); setReason(''); setError(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, status]);
  const run = useMutation({
    mutationFn: () => api.post(`/orgs/${orgId}/students/bulk`, { action, studentIds: ids, reason: action === 'DEREGISTER' ? reason.trim() : undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students', orgId] });
      qc.invalidateQueries({ queryKey: ['dashboard', orgId] });
      onDone();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const needReason = action === 'DEREGISTER';
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Bulk action · {ids.length} selected</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField select label="Action" value={action} onChange={(e) => setAction(e.target.value as BulkAction)}>
            {actions.map((a) => <MenuItem key={a} value={a}>{LABEL[a]}</MenuItem>)}
          </TextField>
          {action === 'DEACTIVATE' && <Alert severity="info">Inactive students stay on record but leave batch lists, attendance and headcounts until they are activated again.</Alert>}
          {action === 'ACTIVATE' && <Alert severity="info">The students go back to Active.</Alert>}
          {needReason && (
            <>
              <Alert severity="warning">Deregistration cannot be undone from here.</Alert>
              <TextField label="Reason" required multiline minRows={2} value={reason} onChange={(e) => setReason(e.target.value)}
                inputProps={{ maxLength: 500 }} helperText="At least 3 characters" />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color={needReason ? 'error' : 'primary'}
          disabled={run.isPending || !ids.length || (needReason && reason.trim().length < 3)} onClick={() => run.mutate()}>
          {LABEL[action]} {ids.length}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Import students from a CSV file: download the template, check the file, then import it. */
export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [checked, setChecked] = useState<ImportResult | null>(null);
  const [done, setDone] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) { setFile(null); setChecked(null); setDone(null); setError(null); }
  }, [open]);

  const send = (dryRun: boolean) => {
    const form = new FormData();
    form.append('file', file!);
    return api.upload<ImportResult>(`/orgs/${orgId}/students/import?dryRun=${dryRun}`, form);
  };
  const check = useMutation({
    mutationFn: () => send(true),
    onSuccess: (r) => { setChecked(r); setError(null); },
    onError: (e) => { setChecked(null); setError(errorMessage(e)); },
  });
  const run = useMutation({
    mutationFn: () => send(false),
    onSuccess: (r) => {
      setDone(r);
      setError(null);
      qc.invalidateQueries({ queryKey: ['students', orgId] });
      qc.invalidateQueries({ queryKey: ['dashboard', orgId] });
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const template = useMutation({
    mutationFn: () => api.download(`/orgs/${orgId}/students/import/template`),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'student-import-template.csv';
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const clean = !!checked && checked.errors.length === 0;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Import Students</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body2" color="text.secondary">
            1. Download the template and fill in one student per row. Class and Batch must match existing names (separate several
            batches with ;). Dates are YYYY-MM-DD or DD/MM/YYYY. At most 500 students and 1 MB, saved as UTF-8 CSV.
          </Typography>
          <Box>
            <Button startIcon={<DownloadIcon />} disabled={template.isPending} onClick={() => template.mutate()}>Download template</Button>
          </Box>
          <Typography variant="body2" color="text.secondary">2. Choose the file and check it. Nothing is imported until the check is clean.</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <input ref={input} type="file" accept=".csv,text/csv"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setChecked(null); setDone(null); setError(null); }} />
            <Button variant="outlined" disabled={!file || check.isPending || run.isPending} onClick={() => check.mutate()}>Check file</Button>
          </Stack>
          {clean && !done && <Alert severity="success">The file looks good: {checked!.rows} student(s) can be imported.</Alert>}
          {done && <Alert severity="success">{done.imported} student(s) imported.</Alert>}
          {checked && checked.errors.length > 0 && (
            <>
              <Alert severity="error">
                {checked.errors.length}{checked.errorsTruncated ? '+' : ''} problem(s) found. Fix the file and check it again; nothing was imported.
              </Alert>
              <Box sx={{ maxHeight: 280, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Table size="small" stickyHeader>
                  <TableHead><TableRow><TableCell>Row</TableCell><TableCell>Column</TableCell><TableCell>Problem</TableCell></TableRow></TableHead>
                  <TableBody>
                    {checked.errors.map((e, i) => (
                      <TableRow key={i}><TableCell>{e.row}</TableCell><TableCell>{e.column}</TableCell><TableCell>{e.message}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{done ? 'Close' : 'Cancel'}</Button>
        {!done && <Button variant="contained" disabled={!clean || run.isPending} onClick={() => run.mutate()}>{clean ? `Import ${checked!.rows} students` : 'Import students'}</Button>}
      </DialogActions>
    </Dialog>
  );
}
