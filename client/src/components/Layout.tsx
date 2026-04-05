import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Box,
  Container,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SsidChartIcon from '@mui/icons-material/SsidChart';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import BuildIcon from '@mui/icons-material/Build';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { apiGet } from '../api';
import { brand } from '../theme';
import UserMenu from './UserMenu';
import type { ReactNode } from 'react';
import type { AboutInfo, AppSettingsPublic } from '../types';

const SIDEBAR_EXPANDED = 240;
const SIDEBAR_COLLAPSED = 64;
const SIDEBAR_TRANSITION = 'width 200ms ease, min-width 200ms ease';
const MAIN_MARGIN_TRANSITION = 'margin-left 200ms ease';
const STORAGE_KEY = 'pulsebeat:sidebar-collapsed';
const MOBILE_QUERY = '(max-width:767.95px)';

const CYAN = '#22d3ee';

const navItems = [
  { to: '/', label: 'Dashboard', icon: SpaceDashboardOutlinedIcon, match: (p: string) => p === '/' },
  {
    to: '/notifications',
    label: 'Notifications',
    icon: NotificationsOutlinedIcon,
    match: (p: string) => p === '/notifications',
  },
  {
    to: '/maintenance',
    label: 'Maintenance',
    icon: BuildIcon,
    match: (p: string) => p === '/maintenance',
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: SettingsOutlinedIcon,
    match: (p: string) => p === '/settings',
  },
] as const;

export default function Layout({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { pathname } = useLocation();
  const isMobile = useMediaQuery(MOBILE_QUERY);

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'true') return true;
    if (v === 'false') return false;
    return false;
  });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('1.8.0');

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? 'true' : 'false');
  }, [collapsed]);

  const refreshDisplayName = useCallback(async () => {
    try {
      const [s, about] = await Promise.all([
        apiGet<AppSettingsPublic>('/api/settings'),
        apiGet<AboutInfo>('/api/settings/about'),
      ]);
      if (s.app_name?.trim()) {
        document.title = s.app_name.trim();
      } else {
        document.title = brand.displayName;
      }
      if (about?.version) setAppVersion(about.version);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshDisplayName();
  }, [refreshDisplayName]);

  useEffect(() => {
    function onSettingsUpdated() {
      void refreshDisplayName();
    }
    window.addEventListener('pulsebeat:settings-updated', onSettingsUpdated);
    return () => window.removeEventListener('pulsebeat:settings-updated', onSettingsUpdated);
  }, [refreshDisplayName]);

  const desktopSidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  const closeMobileDrawer = useCallback(() => setMobileDrawerOpen(false), []);

  const sidebarPaperSx = useMemo(
    () => ({
      width: SIDEBAR_EXPANDED,
      boxSizing: 'border-box' as const,
      backgroundImage: 'none',
      borderRight: `1px solid ${theme.palette.divider}`,
      display: 'flex',
      flexDirection: 'column' as const,
      height: '100%',
      bgcolor: 'background.paper',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    }),
    [theme.palette.divider, theme.palette.background.paper]
  );

  const mainSx = useMemo(
    () => ({
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column' as const,
      minHeight: '100vh',
      marginLeft: 0,
      transition: MAIN_MARGIN_TRANSITION,
      '@media (min-width: 768px)': {
        marginLeft: `${desktopSidebarWidth}px`,
      },
    }),
    [desktopSidebarWidth]
  );

  const navList = (opts: { collapsed: boolean; onNavigate?: () => void }) => {
    const { collapsed: narrow, onNavigate } = opts;
    return (
      <List disablePadding sx={{ flex: 1, px: narrow ? 0.5 : 1, pt: 1, overflowY: 'auto', minHeight: 0 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const selected = item.match(pathname);
          const button = (
            <ListItemButton
              component={RouterLink}
              to={item.to}
              selected={selected}
              onClick={onNavigate}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                minHeight: 44,
                justifyContent: narrow ? 'center' : 'flex-start',
                px: narrow ? 1 : 1.5,
                borderLeft: '3px solid transparent',
                '&.Mui-selected': {
                  borderLeftColor: CYAN,
                  bgcolor: 'action.selected',
                },
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: narrow ? 0 : 40,
                  mr: narrow ? 0 : undefined,
                  justifyContent: 'center',
                  color: selected ? CYAN : 'text.secondary',
                }}
              >
                <Icon fontSize="small" />
              </ListItemIcon>
              {!narrow ? <ListItemText primary={item.label} primaryTypographyProps={{ variant: 'body2' }} /> : null}
            </ListItemButton>
          );
          return narrow ? (
            <Tooltip key={item.to} title={item.label} placement="right">
              {button}
            </Tooltip>
          ) : (
            <Box key={item.to}>{button}</Box>
          );
        })}
      </List>
    );
  };

  const brandBlock = (opts: { collapsed: boolean }) => (
    <Box
      sx={{
        px: opts.collapsed ? 0.5 : 1.5,
        py: 2,
        borderBottom: 1,
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        minHeight: 72,
        flexShrink: 0,
        justifyContent: opts.collapsed ? 'center' : 'flex-start',
      }}
    >
      <SsidChartIcon className="h-8 w-8 shrink-0 text-pb-primary" sx={{ fontSize: '2rem' }} aria-hidden />
      {!opts.collapsed ? (
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle1" component={RouterLink} to="/" noWrap className="font-bold no-underline text-inherit block">
            Pulsebeat
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.9 }}>
            v{appVersion}
          </Typography>
        </Box>
      ) : null}
    </Box>
  );

  const sidebarInnerDesktop = (
    <>
      {brandBlock({ collapsed })}
      <Box
        sx={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          minWidth: 0,
        }}
      >
        {navList({ collapsed })}
        <IconButton
          size="small"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          sx={{
            position: 'absolute',
            right: -14,
            top: '42%',
            zIndex: theme.zIndex.drawer + 2,
            width: 28,
            height: 44,
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            boxShadow: 1,
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          {collapsed ? <ChevronRightIcon sx={{ fontSize: 18 }} /> : <ChevronLeftIcon sx={{ fontSize: 18 }} />}
        </IconButton>
      </Box>
      <Box sx={{ borderTop: 1, borderColor: 'divider', flexShrink: 0 }}>
        <UserMenu variant="sidebar" sidebarShowLabel={!collapsed} />
      </Box>
    </>
  );

  const sidebarInnerMobile = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {brandBlock({ collapsed: false })}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {navList({ collapsed: false, onNavigate: closeMobileDrawer })}
      </Box>
      <Box sx={{ borderTop: 1, borderColor: 'divider', flexShrink: 0 }}>
        <UserMenu variant="sidebar" sidebarShowLabel />
      </Box>
    </Box>
  );

  return (
    <>
      {/* Desktop: fixed viewport-height sidebar (independent of main content scroll) */}
      <Box
        component="aside"
        aria-label="Main navigation"
        sx={{
          display: 'none',
          '@media (min-width: 768px)': {
            display: 'flex',
          },
          position: 'fixed',
          left: 0,
          top: 0,
          height: '100vh',
          maxHeight: '100vh',
          width: desktopSidebarWidth,
          minWidth: desktopSidebarWidth,
          flexDirection: 'column',
          transition: SIDEBAR_TRANSITION,
          borderRight: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflow: 'hidden',
          zIndex: theme.zIndex.drawer,
        }}
      >
        {sidebarInnerDesktop}
      </Box>

      <Drawer
        variant="temporary"
        open={mobileDrawerOpen}
        onClose={closeMobileDrawer}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: 'block',
          '@media (min-width: 768px)': {
            display: 'none',
          },
          '& .MuiDrawer-paper': sidebarPaperSx,
        }}
      >
        {sidebarInnerMobile}
      </Drawer>

      <Box component="main" sx={mainSx}>
        {isMobile ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 1,
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              flexShrink: 0,
            }}
          >
            <IconButton
              color="inherit"
              aria-label="Open navigation menu"
              edge="start"
              onClick={() => setMobileDrawerOpen(true)}
              size="medium"
            >
              <MenuIcon />
            </IconButton>
          </Box>
        ) : null}
        <Container maxWidth="xl" className="flex flex-1 flex-col px-3 py-4 sm:px-6 sm:py-6" sx={{ flex: 1 }}>
          {children}
        </Container>
      </Box>
    </>
  );
}
