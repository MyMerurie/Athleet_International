import { useEffect, useState } from 'react';
import {
  Alert, Button, Card, CardContent, FormControlLabel, Grid2 as Grid, List, ListItemButton, ListItemText, MenuItem, Stack, Switch,
  TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage, fieldErrors } from '../api/client';
import { useOrg } from '../org/OrgContext';
import { PageHeader } from '../components/common';
import type { AttendanceConfig, StudentConfig } from '../api/types';
import { Loading } from '../App';

const SECTIONS = [
  'Branding Preference', 'Mobile Apps', 'Notifications', 'Social Media Handles', 'Terms & Conditions',
  'Dashboard Configuration', 'Attendance Configuration', 'Fee Settings', 'Cascade Activities', 'Activity Categories',
  'Competition / Rank Master', 'Player Unique ID Auto-generation', 'Student Rating Categories',
];

function AttendanceConfigForm({ manage }: { manage: boolean }) {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [v, setV] = useState<AttendanceConfig | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const q = useQuery({ queryKey: ['att-config', orgId], queryFn: () => api.get<AttendanceConfig>(`/orgs/${orgId}/attendance/config`) });
  useEffect(() => { if (q.data) setV(q.data); }, [q.data]);
  const save = useMutation({
    mutationFn: () => api.put<AttendanceConfig>(`/orgs/${orgId}/attendance/config`, v),
    onSuccess: (r) => { qc.setQueryData(['att-config', orgId], r); setMsg({ ok: true, text: 'Saved.' }); },
    onError: (e) => setMsg({ ok: false, text: errorMessage(e) }),
  });
  if (q.isLoading) return <Loading />;
  if (!v) return <Alert severity="error">{errorMessage(q.error)}</Alert>;
  const sw = (key: 'selfieRequired' | 'tasksOnOut' | 'showDeviceInfo' | 'allowDateOverride', label: string) => (
    <FormControlLabel label={label} control={<Switch checked={v[key]} disabled={!manage} onChange={(e) => setV({ ...v, [key]: e.target.checked })} />} />
  );
  const num = (key: 'maxBackDays' | 'maxForwardDays', label: string, max: number) => (
    <TextField type="number" label={label} value={v[key]} disabled={!manage} sx={{ width: 200 }}
      inputProps={{ min: 0, max }} helperText={`0 to ${max}`}
      onChange={(e) => setV({ ...v, [key]: Math.min(max, Math.max(0, parseInt(e.target.value || '0', 10) || 0)) })} />
  );
  return (
    <Stack spacing={1}>
      {msg && <Alert severity={msg.ok ? 'success' : 'error'} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      {sw('selfieRequired', 'Selfie required when punching in or out')}
      {sw('tasksOnOut', 'Tasks accomplished required with the out punch')}
      {sw('showDeviceInfo', 'Show device info (phone, device id) on staff attendance')}
      {sw('allowDateOverride', 'Allow backdated / forward-dated student attendance')}
      {v.allowDateOverride && (
        <Stack direction="row" spacing={2} sx={{ pt: 1 }}>
          {num('maxBackDays', 'Days back', 31)}
          {num('maxForwardDays', 'Days forward', 7)}
        </Stack>
      )}
      {manage && <div><Button variant="contained" disabled={save.isPending} onClick={() => save.mutate()}>Save</Button></div>}
    </Stack>
  );
}

/** Player Unique ID Auto-generation: switch + prefix; the Unique ID becomes prefix + student number. */
function UniqueIdForm({ manage }: { manage: boolean }) {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [v, setV] = useState<StudentConfig | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const q = useQuery({ queryKey: ['student-config', orgId], queryFn: () => api.get<StudentConfig>(`/orgs/${orgId}/student-config`) });
  useEffect(() => { if (q.data) setV(q.data); }, [q.data]);
  const save = useMutation({
    mutationFn: () => api.put<StudentConfig>(`/orgs/${orgId}/student-config`, v),
    onSuccess: (r) => { qc.setQueryData(['student-config', orgId], r); setMsg({ ok: true, text: 'Saved.' }); },
    onError: (e) => setMsg({ ok: false, text: Object.values(fieldErrors(e)).join(', ') || errorMessage(e) }),
  });
  const apply = useMutation({
    mutationFn: () => api.post<{ updated: number; skipped: number }>(`/orgs/${orgId}/student-config/apply`),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['students', orgId] });
      setMsg({ ok: true, text: `${r.updated} student(s) updated${r.skipped ? `, ${r.skipped} skipped because that Unique ID is already in use` : ''}.` });
    },
    onError: (e) => setMsg({ ok: false, text: errorMessage(e) }),
  });
  if (q.isLoading) return <Loading />;
  if (!v) return <Alert severity="error">{errorMessage(q.error)}</Alert>;
  return (
    <Stack spacing={2}>
      {msg && <Alert severity={msg.ok ? 'success' : 'error'} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      <FormControlLabel label="Generate the Unique ID automatically (prefix + student number)"
        control={<Switch checked={v.uniqueIdAuto} disabled={!manage} onChange={(e) => setV({ ...v, uniqueIdAuto: e.target.checked })} />} />
      <TextField label="Prefix" value={v.uniqueIdPrefix} disabled={!manage || !v.uniqueIdAuto} sx={{ width: 240 }}
        inputProps={{ maxLength: 10 }} helperText={`Example: ${v.uniqueIdPrefix}100001`}
        onChange={(e) => setV({ ...v, uniqueIdPrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })} />
      {manage && (
        <Stack direction="row" spacing={1}>
          <Button variant="contained" disabled={save.isPending} onClick={() => save.mutate()}>Save</Button>
          <Button disabled={apply.isPending || !q.data?.uniqueIdAuto} onClick={() => apply.mutate()}>Apply to students without a Unique ID</Button>
        </Stack>
      )}
    </Stack>
  );
}

export function SettingsPage() {
  const { orgId, access, can } = useOrg();
  const qc = useQueryClient();
  const org = access.organization;
  const manage = can('SETTINGS', 'MANAGE');
  const [section, setSection] = useState(SECTIONS[0]);
  const [v, setV] = useState({ centerLabel: org.centerLabel, currency: org.currency, dateFormat: org.dateFormat });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setV({ centerLabel: org.centerLabel, currency: org.currency, dateFormat: org.dateFormat }), [org]);

  const save = useMutation({
    mutationFn: () => api.put(`/organizations/${orgId}/branding`, { ...v, centerLabel: v.centerLabel.trim(), currency: v.currency.trim().toUpperCase() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-access', orgId] }); setErrors({}); setMsg({ ok: true, text: 'Saved.' }); },
    onError: (e) => { setErrors(fieldErrors(e)); setMsg({ ok: false, text: errorMessage(e) }); },
  });

  return (
    <>
      <PageHeader title="Settings" />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card variant="outlined">
            <List dense>
              {SECTIONS.map((s) => (
                <ListItemButton key={s} selected={s === section} onClick={() => setSection(s)}>
                  <ListItemText primary={s} />
                </ListItemButton>
              ))}
            </List>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>{section}</Typography>
              {section === 'Attendance Configuration' ? <AttendanceConfigForm manage={manage} />
                : section === 'Player Unique ID Auto-generation' ? <UniqueIdForm manage={manage} />
                : section !== 'Branding Preference' ? (
                <Alert severity="info">
                  {section === 'Fee Settings' ? 'Fees are scheduled for the final phase.' : 'This setting will be added in a later phase.'}
                </Alert>
              ) : (
                <Grid container spacing={2}>
                  {msg && <Grid size={12}><Alert severity={msg.ok ? 'success' : 'error'} onClose={() => setMsg(null)}>{msg.text}</Alert></Grid>}
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField select label="Currency" value={v.currency} disabled={!manage} onChange={(e) => setV({ ...v, currency: e.target.value })}>
                      {['INR', 'AED', 'SAR', 'QAR', 'KWD', 'OMR', 'BHD', 'GBP', 'USD'].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField select label="Date format" value={v.dateFormat} disabled={!manage} onChange={(e) => setV({ ...v, dateFormat: e.target.value })}>
                      {['d/m/Y', 'm/d/Y', 'Y-m-d'].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField label="Center Name Title" value={v.centerLabel} disabled={!manage} error={!!errors.centerLabel}
                      helperText={errors.centerLabel ?? 'e.g. "Class" — the label used for a center'}
                      onChange={(e) => setV({ ...v, centerLabel: e.target.value })} inputProps={{ maxLength: 30 }} />
                  </Grid>
                  {manage && <Grid size={12}><Button variant="contained" disabled={save.isPending} onClick={() => save.mutate()}>Save</Button></Grid>}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
