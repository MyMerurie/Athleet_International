import { useState } from 'react';
import {
  Alert, Avatar, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, IconButton, InputLabel,
  Link, Menu, MenuItem, Select, Stack, Tab, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, Tabs, TextField,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import type { Page, Student, StudentStatus, StudentSummary } from '../api/types';
import { useOrg } from '../org/OrgContext';
import { EmptyState, PageHeader, Panel, SearchBox, useDebounced } from '../components/common';
import { useBatchOptions, useCenterOptions } from '../components/options';
import { StudentDialog } from './StudentDialog';
import { TagsDialog } from './StudentRecords';
import { IdCardDialog } from './StudentIdCard';
import { TransferDialog } from './StudentTransfer';
import { StudentMonthDialog } from './attendance/StudentMonthDialog';
import { Loading } from '../App';

function useStudentCount(orgId: string, status: StudentStatus) {
  return useQuery({
    queryKey: ['students', orgId, 'count', status],
    queryFn: () => api.get<Page<StudentSummary>>(`/orgs/${orgId}/students`, { status, size: 1 }),
    select: (p) => p.total,
  });
}

function BatchesDialog({ student, onClose }: { student: Student | null; onClose: () => void }) {
  const { orgId, centerLabel } = useOrg();
  const qc = useQueryClient();
  const [centerId, setCenterId] = useState<string>('');
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const centers = useCenterOptions(orgId);
  const current = centerId || student?.center.id || '';
  const batches = useBatchOptions(orgId, current || undefined);
  const selected = centerId || batchIds.length ? batchIds : (student?.batches.map((b) => b.id) ?? []);
  const save = useMutation({
    mutationFn: () => api.put(`/orgs/${orgId}/students/${student!.id}/batches`, { centerId: current, batchIds: selected }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['students', orgId] }); close(); },
    onError: (e) => setError(errorMessage(e)),
  });
  const close = () => { setCenterId(''); setBatchIds([]); setError(null); onClose(); };
  return (
    <Dialog open={!!student} onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle>Batches · Transfer</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <FormControl>
            <InputLabel>{centerLabel}</InputLabel>
            <Select label={centerLabel} value={current} onChange={(e) => { setCenterId(e.target.value); setBatchIds([]); }}>
              {(centers.data ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>Batch</InputLabel>
            <Select multiple label="Batch" value={selected}
              onChange={(e) => setBatchIds(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}>
              {(batches.data ?? []).map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Cancel</Button>
        <Button variant="contained" disabled={!selected.length || save.isPending} onClick={() => save.mutate()}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function DeregisterDialog({ student, onClose }: { student: StudentSummary | null; onClose: () => void }) {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const close = () => { setReason(''); setError(null); onClose(); };
  const save = useMutation({
    mutationFn: () => api.post(`/orgs/${orgId}/students/${student!.id}/deregister`, { reason: reason.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['students', orgId] }); qc.invalidateQueries({ queryKey: ['dashboard', orgId] }); close(); },
    onError: (e) => setError(errorMessage(e)),
  });
  return (
    <Dialog open={!!student} onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle>Deregistration</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField sx={{ mt: 1 }} label="Reason" required multiline minRows={3} value={reason}
          onChange={(e) => setReason(e.target.value)} inputProps={{ maxLength: 500 }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Cancel</Button>
        <Button color="error" variant="contained" disabled={!reason.trim() || save.isPending} onClick={() => save.mutate()}>Deregister</Button>
      </DialogActions>
    </Dialog>
  );
}

export function StudentsPage() {
  const { orgId, can, centerLabel } = useOrg();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const manage = can('STUDENT', 'MANAGE');
  const viewAttendance = can('ATTENDANCE');
  const [status, setStatus] = useState<StudentStatus>('ACTIVE');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const q = useDebounced(search);
  const [dialog, setDialog] = useState<{ open: boolean; student?: Student }>({ open: false });
  const [menu, setMenu] = useState<{ el: HTMLElement; row: StudentSummary } | null>(null);
  const [batchesFor, setBatchesFor] = useState<Student | null>(null);
  const [deregFor, setDeregFor] = useState<StudentSummary | null>(null);
  const [attendanceFor, setAttendanceFor] = useState<StudentSummary | null>(null);
  const [tagsFor, setTagsFor] = useState<Student | null>(null);
  const [cardFor, setCardFor] = useState<Student | null>(null);
  const [transferFor, setTransferFor] = useState<Student | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const active = useStudentCount(orgId, 'ACTIVE');
  const submitted = useStudentCount(orgId, 'SUBMITTED');
  const list = useQuery({
    queryKey: ['students', orgId, status, q, page, size],
    queryFn: () => api.get<Page<StudentSummary>>(`/orgs/${orgId}/students`, { status, search: q, page, size }),
    placeholderData: keepPreviousData,
  });

  const loadFull = (id: string) => api.get<Student>(`/orgs/${orgId}/students/${id}`);
  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/orgs/${orgId}/students/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students', orgId] }),
    onError: (e) => setActionError(errorMessage(e)),
  });

  async function act(action: string, row: StudentSummary) {
    setMenu(null);
    setActionError(null);
    try {
      if (action === 'profile') navigate(`/org/${orgId}/students/${row.id}`);
      if (action === 'injuries') navigate(`/org/${orgId}/students/${row.id}?tab=injuries`);
      if (action === 'history') navigate(`/org/${orgId}/students/${row.id}?tab=history`);
      if (action === 'tags') setTagsFor(await loadFull(row.id));
      if (action === 'idcard') setCardFor(await loadFull(row.id));
      if (action === 'transfer') setTransferFor(await loadFull(row.id));
      if (action === 'edit') setDialog({ open: true, student: await loadFull(row.id) });
      if (action === 'batches') setBatchesFor(await loadFull(row.id));
      if (action === 'deregister') setDeregFor(row);
      if (action === 'approve') approve.mutate(row.id);
      if (action === 'attendance') setAttendanceFor(row);
    } catch (e) {
      setActionError(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Student"
        actions={<>
          <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(0); }} />
          {manage && (
            <Tooltip title="Add Student">
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialog({ open: true })}>Add</Button>
            </Tooltip>
          )}
        </>}
      />
      <Tabs value={status} onChange={(_, v) => { setStatus(v); setPage(0); }} sx={{ mb: 2 }}>
        <Tab value="ACTIVE" label={`Active (${active.data ?? 0})`} />
        <Tab value="SUBMITTED" label={`Submitted (${submitted.data ?? 0})`} />
      </Tabs>
      {actionError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>{actionError}</Alert>}
      <Panel>
        {list.isLoading ? <Loading /> : !list.data?.items.length ? <EmptyState text="No students found." /> : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell /><TableCell>Student Name</TableCell><TableCell>ID</TableCell><TableCell>{centerLabel} Name</TableCell>
                  <TableCell>Batch</TableCell><TableCell>Age</TableCell><TableCell>Grade</TableCell><TableCell>Email Address</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {list.data.items.map((s) => (
                  <TableRow key={s.id} hover>
                    <TableCell><Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>{s.firstName[0]}</Avatar></TableCell>
                    <TableCell>
                      <Link component={RouterLink} to={`/org/${orgId}/students/${s.id}`} underline="hover" color="inherit">
                        {s.firstName} {s.lastName ?? ''}
                      </Link>
                    </TableCell>
                    <TableCell>{s.studentNo}</TableCell>
                    <TableCell>{s.center.name}</TableCell>
                    <TableCell>{s.batches.map((b) => b.name).join(', ')}</TableCell>
                    <TableCell>{s.age ?? '—'}</TableCell>
                    <TableCell>{s.grade ?? '—'}</TableCell>
                    <TableCell sx={{ wordBreak: 'break-all' }}>{s.email ?? '—'}</TableCell>
                    <TableCell align="right">
                      {(manage || viewAttendance) && (
                        <IconButton size="small" aria-label="Select Action" onClick={(e) => setMenu({ el: e.currentTarget, row: s })}>
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
        <TablePagination component="div" count={list.data?.total ?? 0} page={page} rowsPerPage={size}
          rowsPerPageOptions={[5, 10, 20]} onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setSize(parseInt(e.target.value, 10)); setPage(0); }} />
      </Panel>

      <Menu anchorEl={menu?.el} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => menu && act('profile', menu.row)}>Profile</MenuItem>
        {manage && menu?.row.status === 'SUBMITTED' && <MenuItem onClick={() => act('approve', menu.row)}>Approve</MenuItem>}
        {manage && <MenuItem onClick={() => menu && act('edit', menu.row)}>Edit</MenuItem>}
        {manage && <MenuItem onClick={() => menu && act('batches', menu.row)}>Batches</MenuItem>}
        {manage && <MenuItem onClick={() => menu && act('transfer', menu.row)}>Transfer Student</MenuItem>}
        {manage && <MenuItem onClick={() => menu && act('deregister', menu.row)}>Deregistration</MenuItem>}
        {viewAttendance && <MenuItem onClick={() => menu && act('attendance', menu.row)}>Attendance</MenuItem>}
        {manage && <MenuItem onClick={() => menu && act('tags', menu.row)}>Tag Student</MenuItem>}
        <MenuItem onClick={() => menu && act('injuries', menu.row)}>Injury Log</MenuItem>
        <MenuItem onClick={() => menu && act('history', menu.row)}>Student History</MenuItem>
        <MenuItem onClick={() => menu && act('idcard', menu.row)}>ID Card</MenuItem>
      </Menu>

      <StudentDialog open={dialog.open} student={dialog.student} onClose={() => setDialog({ open: false })} />
      <BatchesDialog student={batchesFor} onClose={() => setBatchesFor(null)} />
      <DeregisterDialog student={deregFor} onClose={() => setDeregFor(null)} />
      <StudentMonthDialog student={attendanceFor} onClose={() => setAttendanceFor(null)} />
      <TagsDialog student={tagsFor} onClose={() => setTagsFor(null)} />
      <IdCardDialog student={cardFor} onClose={() => setCardFor(null)} />
      <TransferDialog student={transferFor} onClose={() => setTransferFor(null)} />
    </>
  );
}
