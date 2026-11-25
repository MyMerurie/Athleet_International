import { useState, type ReactNode } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, Grid2 as Grid, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../api/client';
import type { Student, StudentProfile } from '../api/types';
import { useOrg } from '../org/OrgContext';
import { EmptyState, PageHeader, Panel } from '../components/common';
import { Loading } from '../App';
import { StudentDialog } from './StudentDialog';
import { StudentMonthPanel } from './attendance/StudentMonthDialog';

const TABS = ['DETAILS', 'CONTACTS', 'TRAINING', 'ATTENDANCE'] as const;
type ProfileTab = (typeof TABS)[number];

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const phone = (code?: string, mobile?: string) => (mobile ? `${code ?? ''} ${mobile}`.trim() : undefined);

function Field({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography sx={{ wordBreak: 'break-word' }}>{value || '—'}</Typography>
    </Grid>
  );
}

function Details({ s, centerLabel }: { s: Student; centerLabel: string }) {
  const place = [s.city, s.state, s.country].filter(Boolean).join(', ');
  return (
    <Grid container spacing={2} sx={{ p: 2 }}>
      <Field label="Student ID" value={s.studentNo} />
      <Field label={centerLabel} value={s.center.name} />
      <Field label="Batch" value={s.batches.map((b) => b.name).join(', ')} />
      <Field label="Gender" value={titleCase(s.gender)} />
      <Field label="Date of Birth" value={s.dateOfBirth} />
      <Field label="Age" value={s.age} />
      <Field label="Unique ID" value={s.uniqueId} />
      <Field label="Blood Group" value={s.bloodGroup} />
      <Field label="Dominant Side" value={s.dominantSide && titleCase(s.dominantSide)} />
      <Field label="Kit Size" value={s.kitSize} />
      <Field label="Address" value={s.address} />
      <Field label="City / State / Country" value={place} />
      <Field label="Pin Code" value={s.pinCode} />
      <Field label="School Name" value={s.schoolName} />
      <Field label="School Address" value={s.schoolAddress} />
      <Field label="Grade" value={s.grade} />
      <Grid size={12}>
        <Typography variant="caption" color="text.secondary">Medical Condition</Typography>
        <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{s.medicalCondition || '—'}</Typography>
      </Grid>
    </Grid>
  );
}

function Contacts({ s }: { s: Student }) {
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow><TableCell>Contact</TableCell><TableCell>Relationship</TableCell><TableCell>Mobile</TableCell><TableCell>Email</TableCell></TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>{s.firstName} {s.lastName ?? ''} <Chip size="small" label="Primary" sx={{ ml: 1 }} /></TableCell>
            <TableCell>Self</TableCell>
            <TableCell>{phone(s.countryCode, s.mobile) ?? '—'}</TableCell>
            <TableCell sx={{ wordBreak: 'break-all' }}>{s.email ?? '—'}</TableCell>
          </TableRow>
          {s.contacts.map((c, i) => (
            <TableRow key={i}>
              <TableCell>{c.name}</TableCell>
              <TableCell>{c.relationship ?? '—'}</TableCell>
              <TableCell>{phone(c.countryCode, c.mobile)}</TableCell>
              <TableCell sx={{ wordBreak: 'break-all' }}>{c.email ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!s.contacts.length && <EmptyState text="No secondary contacts added." />}
    </Box>
  );
}

function Training({ days }: { days: StudentProfile['trainingDays'] }) {
  if (!days.length) return <EmptyState text="No training days scheduled for this student's batches." />;
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead><TableRow><TableCell>Day</TableCell><TableCell>Timing</TableCell><TableCell>Batch</TableCell></TableRow></TableHead>
        <TableBody>
          {days.map((d, i) => (
            <TableRow key={`${d.batch.id}-${d.day}-${i}`}>
              <TableCell>{titleCase(d.day)}</TableCell>
              <TableCell>{d.startTime.slice(0, 5)} to {d.endTime.slice(0, 5)}</TableCell>
              <TableCell>{d.batch.name}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

export function StudentProfilePage() {
  const { orgId, can, centerLabel } = useOrg();
  const { studentId = '' } = useParams();
  const manage = can('STUDENT', 'MANAGE');
  const [tab, setTab] = useState<ProfileTab>('DETAILS');
  const [editing, setEditing] = useState(false);
  const q = useQuery({
    queryKey: ['students', orgId, 'profile', studentId],
    queryFn: () => api.get<StudentProfile>(`/orgs/${orgId}/students/${studentId}/profile`),
    retry: false,
  });
  const base = `/org/${orgId}/students`;
  const back = (
    <Button component={RouterLink} to={base} startIcon={<ArrowBackIcon />}>Students</Button>
  );

  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) {
    return (
      <>
        <PageHeader title="Student" actions={back} />
        <Alert severity="error">{errorMessage(q.error)}</Alert>
      </>
    );
  }
  const { student: s, trainingDays } = q.data;
  const tabs = TABS.filter((t) => t !== 'ATTENDANCE' || can('ATTENDANCE'));

  return (
    <>
      <PageHeader
        title={`${s.firstName} ${s.lastName ?? ''}`.trim()}
        actions={<>
          {back}
          {manage && s.status !== 'DEREGISTERED' && (
            <Button variant="contained" startIcon={<EditIcon />} onClick={() => setEditing(true)}>Edit</Button>
          )}
        </>}
      />
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Chip label={`ID ${s.studentNo}`} />
        <Chip label={titleCase(s.status)} color={s.status === 'ACTIVE' ? 'success' : 'default'} />
      </Stack>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ mb: 2 }}>
        {tabs.map((t) => <Tab key={t} value={t} label={titleCase(t)} />)}
      </Tabs>
      <Panel>
        {tab === 'DETAILS' && <Details s={s} centerLabel={centerLabel} />}
        {tab === 'CONTACTS' && <Contacts s={s} />}
        {tab === 'TRAINING' && <Training days={trainingDays} />}
        {tab === 'ATTENDANCE' && <Box sx={{ p: 2 }}><StudentMonthPanel studentId={s.id} /></Box>}
      </Panel>
      {manage && <StudentDialog open={editing} student={s} onClose={() => setEditing(false)} />}
    </>
  );
}
