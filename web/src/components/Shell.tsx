import { useState, type ReactElement } from 'react';
import {
  Alert, AppBar, Avatar, Badge, Box, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText,
  Menu, MenuItem, Toolbar, Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ApartmentIcon from '@mui/icons-material/Apartment';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SchoolIcon from '@mui/icons-material/School';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BadgeIcon from '@mui/icons-material/Badge';
import AssessmentIcon from '@mui/icons-material/Assessment';
import InboxIcon from '@mui/icons-material/MoveToInbox';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ChatIcon from '@mui/icons-material/Chat';
import ArticleIcon from '@mui/icons-material/Article';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import SportsIcon from '@mui/icons-material/SportsSoccer';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { OrgProvider, useMyAccess, useOrgIdParam } from '../org/OrgContext';
import type { AppModule, MyAccess } from '../api/types';
import { SIDEBAR_ACTIVE, SIDEBAR_BG, SIDEBAR_TEXT } from '../theme';
import { Loading } from '../App';
import { MyAttendanceDialog } from './MyAttendanceDialog';

const DRAWER = 220;

interface NavItem {
  module: AppModule;
  label: string;
  path: string;
  icon: ReactElement;
  primaryView: boolean;
}

/** Same order as Acadware's side navigation. Modules not built yet route to a placeholder. */
function navItems(centerLabel: string): NavItem[] {
  return [
    { module: 'DASHBOARD', label: 'Dashboard', path: 'dashboard', icon: <DashboardIcon />, primaryView: true },
    { module: 'STUDENT', label: 'Student', path: 'students', icon: <SchoolIcon />, primaryView: true },
    { module: 'ATTENDANCE', label: 'Attendance', path: 'attendance', icon: <EventAvailableIcon />, primaryView: false },
    { module: 'CENTER', label: centerLabel, path: 'classes', icon: <MeetingRoomIcon />, primaryView: false },
    { module: 'ROLE', label: 'Roles', path: 'roles', icon: <AdminPanelSettingsIcon />, primaryView: false },
    { module: 'STAFF', label: 'Staff', path: 'staff', icon: <BadgeIcon />, primaryView: true },
    { module: 'REPORTS', label: 'Reports', path: 'soon/reports', icon: <AssessmentIcon />, primaryView: true },
    { module: 'REQUEST', label: 'Request', path: 'soon/request', icon: <InboxIcon />, primaryView: true },
    { module: 'EXPENSE', label: 'Expense', path: 'soon/expense', icon: <ReceiptLongIcon />, primaryView: true },
    { module: 'MESSAGING', label: 'Messaging', path: 'soon/messaging', icon: <ChatIcon />, primaryView: false },
    { module: 'POSTS', label: 'Posts', path: 'soon/posts', icon: <ArticleIcon />, primaryView: true },
    { module: 'ASSESSMENT', label: 'Assessment', path: 'soon/assessment', icon: <FactCheckIcon />, primaryView: true },
    { module: 'COACHING_DRILLS', label: 'Coaching Drills', path: 'soon/coaching-drills', icon: <SportsIcon />, primaryView: false },
  ];
}

export function isPrimaryView(access: MyAccess) {
  return !access.organization.parentId && sessionStorage.getItem('athleet.view') === 'primary';
}

function Layout({ access }: { access: MyAccess }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null);
  const [myAttendance, setMyAttendance] = useState(false);
  const org = access.organization;
  const primary = isPrimaryView(access);
  const rank = { NONE: 0, VIEW: 1, MANAGE: 2 } as const;
  const items = navItems(org.centerLabel || 'Center').filter(
    (i) => rank[access.permissions[i.module] ?? 'NONE'] >= 1 && (!primary || i.primaryView),
  );

  const drawer = (
    <Box sx={{ bgcolor: SIDEBAR_BG, color: SIDEBAR_TEXT, height: '100%' }}>
      <Toolbar>
        <Typography fontWeight={700} color={SIDEBAR_ACTIVE} noWrap title={org.name}>{org.name}</Typography>
      </Toolbar>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      <List dense>
        {items.map((i) => (
          <ListItemButton
            key={i.path}
            component={NavLink}
            to={i.path}
            onClick={() => setMobileOpen(false)}
            sx={{
              color: SIDEBAR_TEXT, mx: 1, borderRadius: 1, my: 0.25,
              '& .MuiListItemIcon-root': { color: SIDEBAR_TEXT, minWidth: 36 },
              '&.active': { bgcolor: 'rgba(255,255,255,0.10)', color: SIDEBAR_ACTIVE, '& .MuiListItemIcon-root': { color: SIDEBAR_ACTIVE } },
            }}
          >
            <ListItemIcon>{i.icon}</ListItemIcon>
            <ListItemText primary={i.label.toUpperCase()} primaryTypographyProps={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.4 }} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="fixed" elevation={1} sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          {!desktop && (
            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(true)} aria-label="Open menu" sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" fontWeight={700} sx={{ mr: 2 }}>Athleet</Typography>
          <Typography noWrap sx={{ flexGrow: 1, opacity: 0.9 }}>{org.name}{primary ? ' · Primary' : ''}</Typography>
          <Tooltip title="Switch academy">
            <IconButton color="inherit" onClick={() => navigate('/organizations')} aria-label="Switch academy">
              <Badge badgeContent={access.affiliateCount || null} color="secondary"><ApartmentIcon /></Badge>
            </IconButton>
          </Tooltip>
          {access.permissions.SETTINGS && access.permissions.SETTINGS !== 'NONE' && (
            <Tooltip title="Settings">
              <IconButton color="inherit" onClick={() => navigate('settings')} aria-label="Settings"><SettingsIcon /></IconButton>
            </Tooltip>
          )}
          <Tooltip title="My attendance">
            <IconButton color="inherit" onClick={() => setMyAttendance(true)} aria-label="My attendance"><AccessTimeIcon /></IconButton>
          </Tooltip>
          <Tooltip title="Notifications">
            <IconButton color="inherit" aria-label="Notifications"><NotificationsIcon /></IconButton>
          </Tooltip>
          <IconButton onClick={(e) => setMenuEl(e.currentTarget)} aria-label="Account menu" sx={{ ml: 0.5 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', fontSize: 14 }}>
              {(user?.firstName?.[0] ?? '?').toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
            <MenuItem disabled>{user?.firstName} {user?.lastName ?? ''}</MenuItem>
            <MenuItem onClick={() => logout().then(() => navigate('/login'))}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <MyAttendanceDialog open={myAttendance} onClose={() => setMyAttendance(false)} />
      <Box component="nav" sx={{ width: { md: DRAWER }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={desktop ? 'permanent' : 'temporary'}
          open={desktop || mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER, border: 0 } }}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, md: 3 }, mt: 8 }}>
        <Outlet />
      </Box>
    </Box>
  );
}

export function Shell() {
  const orgId = useOrgIdParam();
  const { data, isLoading, isError } = useMyAccess(orgId);
  if (isLoading) return <Loading />;
  if (isError || !data) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">This academy was not found or you do not have access to it.</Alert>
      </Box>
    );
  }
  return (
    <OrgProvider access={data}>
      <Layout access={data} />
    </OrgProvider>
  );
}
