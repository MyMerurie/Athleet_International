import { useState } from 'react';
import {
  Alert, Box, Card, CardContent, Chip, MenuItem, Stack, Tab, Table, TableBody, TableCell, TableHead, TablePagination,
  TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../api/client';
import type { LiveAttendance, TrackerGrid } from '../../api/types';
import { useOrg } from '../../org/OrgContext';
import { isPrimaryView } from '../../components/Shell';
import { EmptyState, Panel } from '../../components/common';
import { Loading } from '../../App';
import { CenterSelect, StatusChip, addDays, fmtTime, today } from './shared';

function Live() {
  const { orgId, access } = useOrg();
  const primary = isPrimaryView(access);
  const q = useQuery({
    queryKey: ['att-live', orgId, primary],
    queryFn: () => api.get<LiveAttendance>(`/orgs/${orgId}/attendance/live`, { includeAffiliates: primary }),
    refetchInterval: 60000,
  });
  if (q.isLoading) return <Loading />;
  if (!q.data) return <Alert severity="error">{errorMessage(q.error)}</Alert>;
  if (!q.data.groups.length) return <EmptyState text="Nothing to show for today." />;
  const statusColor = { IN: 'success', OUT: 'default', NOT_IN: 'warning' } as const;
  return (
    <Stack spacing={2}>
      <Typography color="text.secondary">Today · {q.data.date}</Typography>
      {q.data.groups.map((g) => (
        <Card key={g.id} variant="outlined">
          <CardContent>
            <Typography fontWeight={600} gutterBottom>{g.name}</Typography>
            <Typography variant="subtitle2">Staff</Typography>
            {!g.staff.length ? <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>No staff.</Typography> : (
              <Box sx={{ overflowX: 'auto', mb: 2 }}>
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell>Name</TableCell><TableCell>Status</TableCell><TableCell>In</TableCell><TableCell>Out</TableCell><TableCell>Batch</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {g.staff.map((s) => (
                      <TableRow key={s.userId}>
                        <TableCell>{s.name}</TableCell>
                        <TableCell>
                          <Chip size="small" color={statusColor[s.status]} label={s.status.replace('_', ' ')} />
                          {s.outsideGeofence && <Chip size="small" color="warning" label="Outside geofence" sx={{ ml: 1 }} />}
                        </TableCell>
                        <TableCell>{fmtTime(s.inAt)}</TableCell>
                        <TableCell>{fmtTime(s.outAt)}</TableCell>
                        <TableCell>{s.batchName ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
            <Typography variant="subtitle2">Sessions</Typography>
            {!g.sessions.length ? <Typography variant="body2" color="text.secondary">No batches train today.</Typography> : (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell>Batch</TableCell><TableCell>Status</TableCell><TableCell align="right">Present / Total</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {g.sessions.map((s) => (
                      <TableRow key={s.batchId}>
                        <TableCell>{s.batchName}</TableCell>
                        <TableCell><StatusChip status={s.status} /></TableCell>
                        <TableCell align="right">{s.present} / {s.total}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

function Tracker() {
  const { orgId, access, centerLabel } = useOrg();
  const [type, setType] = useState<'STAFF' | 'STUDENT'>('STUDENT');
  const [from, setFrom] = useState(addDays(today(), -6));
  const [to, setTo] = useState(today());
  const [centerId, setCenterId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const days = (new Date(to).getTime() - new Date(from).getTime()) / 86400000 + 1;
  const rangeError = days < 1 ? 'The end date is before the start date.' : days > 31 ? 'Pick at most 31 days.' : null;
  const q = useQuery({
    queryKey: ['att-tracker', orgId, type, from, to, centerId, status, page],
    queryFn: () => api.get<TrackerGrid>(`/orgs/${orgId}/attendance/tracker`, { type, from, to, centerId, status, page, size: 25 }),
    enabled: !rangeError && !!from && !!to,
    placeholderData: keepPreviousData,
  });
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); };
  return (
    <>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} useFlexGap flexWrap="wrap">
        <TextField select size="small" label="Type" value={type} onChange={(e) => reset(setType)(e.target.value as 'STAFF' | 'STUDENT')} sx={{ width: 130 }}>
          <MenuItem value="STUDENT">Student</MenuItem>
          <MenuItem value="STAFF">Staff</MenuItem>
        </TextField>
        <TextField type="date" size="small" label="From" value={from} onChange={(e) => reset(setFrom)(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField type="date" size="small" label="To" value={to} onChange={(e) => reset(setTo)(e.target.value)} InputLabelProps={{ shrink: true }} />
        {!access.centerId && <CenterSelect orgId={orgId} size="small" label={centerLabel} value={centerId} onChange={reset(setCenterId)} width={180} />}
        <TextField select size="small" label="Status" value={status} onChange={(e) => reset(setStatus)(e.target.value)} sx={{ width: 150 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="ACTIVE">Active</MenuItem>
          <MenuItem value="DEREGISTERED">Deregistered</MenuItem>
        </TextField>
      </Stack>
      {rangeError && <Alert severity="warning" sx={{ mb: 2 }}>{rangeError}</Alert>}
      {q.isError && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(q.error)}</Alert>}
      {!rangeError && (
        <Panel>
          {q.isLoading ? <Loading /> : !q.data?.rows.length ? <EmptyState text="No one to show." /> : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell sx={{ minWidth: 160 }}>Name</TableCell>
                  {q.data.days.map((d) => <TableCell key={d} align="center" sx={{ px: 0.5 }}>{d.slice(8)}</TableCell>)}
                  <TableCell align="right">{type === 'STUDENT' ? 'P' : 'In'}</TableCell>
                  {type === 'STUDENT' && <TableCell align="right">A</TableCell>}
                  <TableCell align="right">%</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {q.data.rows.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>{r.name}{r.subtitle && <Typography variant="caption" display="block" color="text.secondary">{r.subtitle}</Typography>}</TableCell>
                      {q.data.days.map((d) => {
                        // The API returns a cell only for days with attendance data.
                        const c = r.cells.find((x) => x.date === d);
                        return (
                          <TableCell key={d} align="center" sx={{ px: 0.5, opacity: c?.pending ? 0.45 : 1, fontWeight: 600,
                            color: c?.code === 'A' ? 'error.main' : c?.code === 'P' || c?.code === 'IN' ? 'success.main' : 'text.primary' }}>
                            {c?.code || '·'}
                          </TableCell>
                        );
                      })}
                      <TableCell align="right">{r.present}</TableCell>
                      {type === 'STUDENT' && <TableCell align="right">{r.absent}</TableCell>}
                      <TableCell align="right">{r.percent}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
          <TablePagination component="div" count={q.data?.total ?? 0} page={page} rowsPerPage={25} rowsPerPageOptions={[25]} onPageChange={(_, p) => setPage(p)} />
        </Panel>
      )}
    </>
  );
}

export function AttendanceDashboard() {
  const [sub, setSub] = useState(0);
  return (
    <>
      <Tabs value={sub} onChange={(_, v) => setSub(v)} sx={{ mb: 2 }} textColor="secondary" indicatorColor="secondary">
        <Tab label="LIVE" /><Tab label="TRACKER" />
      </Tabs>
      {sub === 0 ? <Live /> : <Tracker />}
    </>
  );
}
