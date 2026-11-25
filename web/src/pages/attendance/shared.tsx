import { Chip, MenuItem, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useCenterOptions } from '../../components/options';
import type { MarkStatus, Page, SessionStatus, Staff } from '../../api/types';

export function isoDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const today = () => isoDate(new Date());

export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

export const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

/** Value for <input type="datetime-local"> (local time) from an ISO instant, and back. */
export function toLocalInput(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${isoDate(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : undefined);

const COLORS: Record<SessionStatus, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  DRAFT: 'default', SUBMITTED: 'info', RESUBMITTED: 'info', APPROVED: 'success', REJECTED: 'error',
};

export function StatusChip({ status }: { status?: SessionStatus }) {
  if (!status) return <Chip size="small" label="Not marked" variant="outlined" />;
  return <Chip size="small" label={status} color={COLORS[status]} />;
}

export function MarkChip({ status }: { status?: MarkStatus }) {
  if (!status) return <Chip size="small" label="—" variant="outlined" />;
  return <Chip size="small" label={status === 'PRESENT' ? 'Present' : 'Absent'} color={status === 'PRESENT' ? 'success' : 'error'} />;
}

/** Active staff of the academy, for "Add shift". */
export function useStaffOptions(orgId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['staff-options', orgId],
    queryFn: () => api.get<Page<Staff>>(`/orgs/${orgId}/staff`, { status: 'ACTIVE', size: 100 }),
    select: (p) => p.items,
    enabled,
  });
}

/** Class filter. Mount it only for users with all-class scope: the options endpoint is forbidden for class-scoped users. */
export function CenterSelect({ orgId, label, value, onChange, size, width = 200 }: {
  orgId: string; label: string; value: string; onChange: (v: string) => void; size?: 'small'; width?: number;
}) {
  const centers = useCenterOptions(orgId);
  return (
    <TextField select size={size} label={label} value={value} onChange={(e) => onChange(e.target.value)} sx={{ width }}>
      <MenuItem value="">All</MenuItem>
      {(centers.data ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
    </TextField>
  );
}
