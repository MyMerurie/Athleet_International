import { useState } from 'react';
import {
  Alert, Box, MenuItem, Stack, Tab, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, Tabs, TextField,
} from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../api/client';
import type { Page, SessionBatch, SessionSummary } from '../api/types';
import { useOrg } from '../org/OrgContext';
import { EmptyState, PageHeader, Panel } from '../components/common';
import { Loading } from '../App';
import { SessionDialog } from './attendance/SessionDialog';
import { StaffInOut } from './attendance/StaffInOut';
import { CenterSelect, StatusChip, today } from './attendance/shared';

function MarkStudents() {
  const { orgId, access, centerLabel } = useOrg();
  const allCenters = !access.centerId;
  const [date, setDate] = useState(today());
  const [centerId, setCenterId] = useState('');
  const [open, setOpen] = useState<{ batchId: string; date: string } | null>(null);
  const list = useQuery({
    queryKey: ['att-batches', orgId, date, centerId],
    queryFn: () => api.get<SessionBatch[]>(`/orgs/${orgId}/attendance/session-batches`, { date, centerId }),
    enabled: !!date,
  });
  return (
    <>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 180 }} />
        {allCenters && <CenterSelect orgId={orgId} label={centerLabel} value={centerId} onChange={setCenterId} width={220} />}
      </Stack>
      {list.isError && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(list.error)}</Alert>}
      <Panel>
        {list.isLoading ? <Loading /> : !list.data?.length ? <EmptyState text="No batches train on this date." /> : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>Batch</TableCell><TableCell>{centerLabel}</TableCell><TableCell>Status</TableCell>
                <TableCell align="right">Present</TableCell><TableCell align="right">Absent</TableCell><TableCell align="right">Students</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {list.data.map((b) => (
                  <TableRow key={b.batchId} hover sx={{ cursor: 'pointer' }} onClick={() => setOpen({ batchId: b.batchId, date })}>
                    <TableCell>{b.batchName}</TableCell>
                    <TableCell>{b.centerName}</TableCell>
                    <TableCell><StatusChip status={b.status} /></TableCell>
                    <TableCell align="right">{b.present}</TableCell>
                    <TableCell align="right">{b.absent}</TableCell>
                    <TableCell align="right">{b.sessionId ? b.total : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Panel>
      <SessionDialog batchId={open?.batchId ?? null} date={open?.date ?? date} onClose={() => setOpen(null)} />
    </>
  );
}

const FILTERS = {
  PENDING: 'SUBMITTED,RESUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ALL: 'SUBMITTED,RESUBMITTED,APPROVED,REJECTED',
} as const;

function Approvals() {
  const { orgId, centerLabel } = useOrg();
  const [filter, setFilter] = useState<keyof typeof FILTERS>('PENDING');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [open, setOpen] = useState<SessionSummary | null>(null);
  const list = useQuery({
    queryKey: ['att-approvals', orgId, filter, page, size],
    queryFn: () => api.get<Page<SessionSummary>>(`/orgs/${orgId}/attendance/sessions`, { status: FILTERS[filter], page, size }),
    placeholderData: keepPreviousData,
  });
  return (
    <>
      <TextField select label="Show" value={filter} onChange={(e) => { setFilter(e.target.value as keyof typeof FILTERS); setPage(0); }} sx={{ width: 180, mb: 2 }}>
        <MenuItem value="PENDING">Pending</MenuItem>
        <MenuItem value="APPROVED">Approved</MenuItem>
        <MenuItem value="REJECTED">Rejected</MenuItem>
        <MenuItem value="ALL">All</MenuItem>
      </TextField>
      {list.isError && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(list.error)}</Alert>}
      <Panel>
        {list.isLoading ? <Loading /> : !list.data?.items.length ? <EmptyState text="Nothing here." /> : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>Date</TableCell><TableCell>Batch</TableCell><TableCell>{centerLabel}</TableCell><TableCell>Status</TableCell>
                <TableCell align="right">Present</TableCell><TableCell align="right">Absent</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {list.data.items.map((s) => (
                  <TableRow key={s.id} hover sx={{ cursor: 'pointer' }} onClick={() => setOpen(s)}>
                    <TableCell>{s.date}</TableCell>
                    <TableCell>{s.batchName}</TableCell>
                    <TableCell>{s.centerName}</TableCell>
                    <TableCell><StatusChip status={s.status} /></TableCell>
                    <TableCell align="right">{s.present}</TableCell>
                    <TableCell align="right">{s.absent}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
        <TablePagination component="div" count={list.data?.total ?? 0} page={page} rowsPerPage={size} rowsPerPageOptions={[10, 20, 50]}
          onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setSize(parseInt(e.target.value, 10)); setPage(0); }} />
      </Panel>
      <SessionDialog batchId={open?.batchId ?? null} date={open?.date ?? today()} onClose={() => setOpen(null)} />
    </>
  );
}

export function AttendancePage() {
  const { can } = useOrg();
  const approver = can('ATTENDANCE_APPROVAL', 'MANAGE');
  const [tab, setTab] = useState<'mark' | 'approvals' | 'staff'>('mark');
  return (
    <>
      <PageHeader title="Attendance" />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="mark" label="MARK STUDENTS" />
        {approver && <Tab value="approvals" label="APPROVALS" />}
        <Tab value="staff" label="STAFF IN/OUT" />
      </Tabs>
      {tab === 'mark' && <MarkStudents />}
      {tab === 'approvals' && approver && <Approvals />}
      {tab === 'staff' && <StaffInOut />}
    </>
  );
}
