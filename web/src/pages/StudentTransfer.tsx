import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage, fieldErrors } from '../api/client';
import type { Student, TransferTarget } from '../api/types';
import { useOrg } from '../org/OrgContext';
import { Loading } from '../App';

/** Transfer a student to another academy of the same group: academy, then class, then batches. */
export function TransferDialog({ student, onClose }: { student: Student | null; onClose: () => void }) {
  const { orgId, centerLabel } = useOrg();
  const qc = useQueryClient();
  const [targetId, setTargetId] = useState('');
  const [centerId, setCenterId] = useState('');
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (student) { setTargetId(''); setCenterId(''); setBatchIds([]); setError(null); }
  }, [student]);
  const targets = useQuery({
    queryKey: ['students', orgId, 'transfer-targets'],
    queryFn: () => api.get<TransferTarget[]>(`/orgs/${orgId}/students/transfer-targets`),
    enabled: !!student,
  });
  const target = targets.data?.find((t) => t.id === targetId);
  const center = target?.centers.find((c) => c.id === centerId);
  const save = useMutation({
    mutationFn: () => api.post(`/orgs/${orgId}/students/${student!.id}/transfer`, { targetOrgId: targetId, centerId, batchIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students', orgId] });
      qc.invalidateQueries({ queryKey: ['dashboard', orgId] });
      onClose();
    },
    onError: (e) => setError(Object.values(fieldErrors(e)).join(', ') || errorMessage(e)),
  });
  return (
    <Dialog open={!!student} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Transfer Student</DialogTitle>
      <DialogContent>
        {targets.isLoading ? <Loading /> : targets.isError ? <Alert severity="error">{errorMessage(targets.error)}</Alert>
          : !targets.data?.length ? <Alert severity="info">There is no other academy you can transfer students to.</Alert> : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <Alert severity="info">
                {student?.firstName} moves to the academy you pick, with their contacts and injury log. Past attendance stays with this academy.
              </Alert>
              <TextField select label="Academy" value={targetId} onChange={(e) => { setTargetId(e.target.value); setCenterId(''); setBatchIds([]); }}>
                {targets.data.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </TextField>
              <TextField select label={centerLabel} value={centerId} disabled={!target}
                onChange={(e) => { setCenterId(e.target.value); setBatchIds([]); }}>
                {(target?.centers ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
              <TextField select label="Batch" value={batchIds} disabled={!center} SelectProps={{ multiple: true }}
                onChange={(e) => setBatchIds(typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as unknown as string[]))}>
                {(center?.batches ?? []).map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
              </TextField>
            </Stack>
          )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="primary" disabled={!batchIds.length || save.isPending} onClick={() => save.mutate()}>Transfer</Button>
      </DialogActions>
    </Dialog>
  );
}
