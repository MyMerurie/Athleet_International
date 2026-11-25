import { useState } from 'react';
import {
  Alert, Box, Card, CardContent, Grid2 as Grid, LinearProgress, Stack, Tab, Table, TableBody, TableCell, TableHead,
  TableRow, Tabs, Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { GeneralDashboard } from '../api/types';
import { useOrg } from '../org/OrgContext';
import { isPrimaryView } from '../components/Shell';
import { Loading } from '../App';
import { Panel } from '../components/common';
import { AttendanceDashboard } from './attendance/AttendanceDashboard';

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="h4" fontWeight={700}>{typeof value === 'number' ? value.toLocaleString() : value}</Typography>
      </CardContent>
    </Card>
  );
}

function Bars({ data }: { data: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(data));
  return (
    <Stack spacing={1.25}>
      {Object.entries(data).map(([label, n]) => (
        <Box key={label}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2">{label}</Typography>
            <Typography variant="body2" fontWeight={600}>{n}</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={(n / max) * 100} sx={{ height: 8, borderRadius: 4 }} />
        </Box>
      ))}
    </Stack>
  );
}

const pct = (part: number, whole: number) => (whole ? Math.round((part * 100) / whole) : 0);

function Headcount({ d, groupLabel }: { d: GeneralDashboard; groupLabel: string }) {
  const total = d.male + d.female + d.other;
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 4 }}>
        <Kpi label={d.groupedBy === 'ACADEMY' ? 'Affiliated Academies' : `Total ${groupLabel}es`}
          value={d.groupedBy === 'ACADEMY' ? Math.max(0, d.headcount.length - 1) : d.totalCenters} />
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}><Kpi label="Current Headcount" value={d.totalStudents} /></Grid>
      <Grid size={{ xs: 12, sm: 4 }}><Kpi label="Batches" value={d.totalBatches} /></Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent>
            <Typography fontWeight={600} gutterBottom>Age Wise Breakup</Typography>
            <Bars data={d.ageBuckets} />
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent>
            <Typography fontWeight={600} gutterBottom>Gender Ratio</Typography>
            <Stack direction="row" spacing={4} sx={{ mt: 2 }}>
              <Box><Typography variant="h4" fontWeight={700} color="primary">{pct(d.male, total)}%</Typography><Typography color="text.secondary">Male ({d.male})</Typography></Box>
              <Box><Typography variant="h4" fontWeight={700} color="secondary">{pct(d.female, total)}%</Typography><Typography color="text.secondary">Female ({d.female})</Typography></Box>
              {d.other > 0 && <Box><Typography variant="h4" fontWeight={700}>{pct(d.other, total)}%</Typography><Typography color="text.secondary">Other ({d.other})</Typography></Box>}
            </Stack>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={12}>
        <Panel>
          <Typography fontWeight={600} sx={{ p: 2 }}>{d.groupedBy === 'ACADEMY' ? 'Academy Details' : `${groupLabel} Headcount`}</Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>{d.groupedBy === 'ACADEMY' ? 'Academy Name' : `${groupLabel} Name`}</TableCell>
                <TableCell align="right">Male</TableCell><TableCell align="right">Female</TableCell>
                <TableCell align="right">No. of Players</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {d.headcount.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell align="right">{r.male}</TableCell>
                    <TableCell align="right">{r.female}</TableCell>
                    <TableCell align="right">{r.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Panel>
      </Grid>
    </Grid>
  );
}

function Utilization({ d, groupLabel }: { d: GeneralDashboard; groupLabel: string }) {
  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}><Kpi label="Available Capacity" value={Math.max(0, d.totalCapacity - d.totalStudents)} /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><Kpi label="Used Capacity" value={d.totalStudents} /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><Kpi label="Utilization" value={`${pct(d.totalStudents, d.totalCapacity)}%`} /></Grid>
      </Grid>
      <Panel>
        <Typography fontWeight={600} sx={{ p: 2 }}>Real Time Utilization</Typography>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>{d.groupedBy === 'ACADEMY' ? 'Academy Name' : `${groupLabel} Name`}</TableCell>
              <TableCell align="right">Capacity</TableCell><TableCell align="right">Student</TableCell>
              <TableCell sx={{ minWidth: 160 }}>Utilization</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {d.utilization.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell align="right">{r.capacity}</TableCell>
                  <TableCell align="right">{r.students}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <LinearProgress variant="determinate" value={Math.min(100, r.utilization)} sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                        color={r.utilization > 75 ? 'success' : r.utilization >= 50 ? 'primary' : 'warning'} />
                      <Typography variant="body2" sx={{ width: 40 }}>{r.utilization}%</Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Panel>
    </Stack>
  );
}

export function DashboardPage() {
  const { orgId, access, can, centerLabel } = useOrg();
  const primary = isPrimaryView(access);
  const [tab, setTab] = useState(0);
  const [sub, setSub] = useState(0);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', orgId, primary],
    queryFn: () => api.get<GeneralDashboard>(`/orgs/${orgId}/dashboard/general`, { includeAffiliates: primary }),
  });

  return (
    <>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="GENERAL" /><Tab label="ATTENDANCE" /><Tab label="PERFORMANCE" />
      </Tabs>
      {tab === 0 && (
        <>
          <Tabs value={sub} onChange={(_, v) => setSub(v)} sx={{ mb: 2 }} textColor="secondary" indicatorColor="secondary">
            <Tab label="HEADCOUNT" /><Tab label="UTILIZATION" />
          </Tabs>
          {isLoading ? <Loading /> : isError || !data ? <Alert severity="error">Could not load the dashboard.</Alert>
            : sub === 0 ? <Headcount d={data} groupLabel={centerLabel} /> : <Utilization d={data} groupLabel={centerLabel} />}
        </>
      )}
      {tab === 1 && can('ATTENDANCE') && <AttendanceDashboard />}
      {tab === 1 && !can('ATTENDANCE') && <Alert severity="info">You do not have access to attendance.</Alert>}
      {tab === 2 && <Alert severity="info">The performance dashboard arrives with the assessment module.</Alert>}
    </>
  );
}
