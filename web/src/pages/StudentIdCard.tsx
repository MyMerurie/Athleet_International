import { Avatar, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, Typography } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import type { Student } from '../api/types';
import { useOrg } from '../org/OrgContext';

// Printing hides everything except the card, so the browser prints just the card.
const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  #student-id-card, #student-id-card * { visibility: visible !important; }
  #student-id-card { position: fixed; left: 0; top: 0; box-shadow: none !important; }
}`;

function Row({ label, value }: { label: string; value?: string | number }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ textAlign: 'right', wordBreak: 'break-word' }}>{value || '—'}</Typography>
    </Stack>
  );
}

/** A printable student ID card built from the profile data (no photo yet: initials are shown). */
export function IdCardDialog({ student, onClose }: { student: Student | null; onClose: () => void }) {
  const { access } = useOrg();
  const s = student;
  const first = s?.contacts?.[0];
  const emergency = first
    ? `${first.name}${first.relationship ? ` (${first.relationship})` : ''} ${first.countryCode ?? ''} ${first.mobile}`.replace(/\s+/g, ' ').trim()
    : s?.mobile ? `${s.countryCode ?? ''} ${s.mobile}`.trim() : undefined;
  return (
    <Dialog open={!!s} onClose={onClose} maxWidth="xs" fullWidth>
      <style>{PRINT_CSS}</style>
      <DialogTitle>ID Card</DialogTitle>
      <DialogContent>
        {s && (
          <Box id="student-id-card" sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.paper', boxShadow: 1 }}>
            <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', px: 2, py: 1 }}>
              <Typography fontWeight={700}>{access.organization.name}</Typography>
            </Box>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ p: 2 }}>
              <Avatar sx={{ width: 64, height: 64, fontSize: 28 }}>{s.firstName[0]}{s.lastName?.[0] ?? ''}</Avatar>
              <Box>
                <Typography variant="h6" fontWeight={700}>{s.firstName} {s.lastName ?? ''}</Typography>
                <Typography variant="body2" color="text.secondary">Student ID {s.studentNo}</Typography>
              </Box>
            </Stack>
            <Divider />
            <Stack spacing={0.5} sx={{ p: 2 }}>
              <Row label="Unique ID" value={s.uniqueId} />
              <Row label={access.organization.centerLabel || 'Class'} value={s.center.name} />
              <Row label="Batch" value={s.batches.map((b) => b.name).join(', ')} />
              <Row label="Date of Birth" value={s.dateOfBirth} />
              <Row label="Blood Group" value={s.bloodGroup} />
              <Row label="Emergency Contact" value={emergency} />
            </Stack>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>Print</Button>
      </DialogActions>
    </Dialog>
  );
}
