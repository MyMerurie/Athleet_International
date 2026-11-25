import { useState } from 'react';
import {
  Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../api/client';
import type { StudentMonth, StudentSummary } from '../../api/types';
import { useOrg } from '../../org/OrgContext';
import { Loading } from '../../App';
import { MarkChip, StatusChip, today } from './shared';

/** One student's attendance for a month: summary and the day list. Used by the dialog and the profile's Attendance tab. */
export function StudentMonthPanel({ studentId }: { studentId: string }) {
  const { orgId } = useOrg();
  const [month, setMonth] = useState(today().slice(0, 7));
  const q = useQuery({
    queryKey: ['att-student-month', orgId, studentId, month],
    queryFn: () => api.get<StudentMonth>(`/orgs/${orgId}/attendance/students/${studentId}`, { month }),
    enabled: !!month,
  });
  const d = q.data;
  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      <TextField type="month" label="Month" value={month} onChange={(e) => setMonth(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 200 }} />
      {q.isLoading ? <Loading /> : !d ? (q.isError ? <Alert severity="error">{errorMessage(q.error)}</Alert> : null) : (
        <>
          <Stack direction="row" spacing={1}>
            <Chip color="success" label={`Present ${d.present}`} />
            <Chip color="error" label={`Absent ${d.absent}`} />
            <Chip label={`${d.percent}%`} />
          </Stack>
          {!d.days.length ? <Typography color="text.secondary">No attendance recorded this month.</Typography> : (
            <Table size="small">
              <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Batch</TableCell><TableCell>Attendance</TableCell><TableCell>Session</TableCell></TableRow></TableHead>
              <TableBody>
                {d.days.map((x, i) => (
                  <TableRow key={`${x.date}-${i}`}>
                    <TableCell>{x.date}</TableCell>
                    <TableCell>{x.batchName}</TableCell>
                    <TableCell><MarkChip status={x.status} /></TableCell>
                    <TableCell><StatusChip status={x.sessionStatus} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </Stack>
  );
}

export function StudentMonthDialog({ student, onClose }: { student: StudentSummary | null; onClose: () => void }) {
  return (
    <Dialog open={!!student} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Attendance · {student?.firstName} {student?.lastName ?? ''}</DialogTitle>
      <DialogContent>{student && <StudentMonthPanel studentId={student.id} />}</DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}
