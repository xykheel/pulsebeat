import { useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Container,
  Drawer,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MonitorHeartIcon from '@mui/icons-material/Favorite';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import { brand, appBarSx, navLinkClassName } from '../theme';
import UserMenu from './UserMenu';
import type { ReactNode } from 'react';

const DRAWER_WIDTH = 280;

export default function Layout({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { pathname } = useLocation();
  const isMobileNav = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeDrawer = () => setMobileOpen(false);

  const drawer = (
    <Box
      component="nav"
      aria-label="Main navigation"
      sx={{ width: DRAWER_WIDTH, pt: 2, px: 1 }}
      onClick={closeDrawer}
    >
      <List disablePadding>
        <ListItemButton
          component={RouterLink}
          to="/"
          selected={pathname === '/'}
          sx={{ borderRadius: 1, mb: 0.5 }}
        >
          <ListItemIcon sx={{ minWidth: 40, color: pathname === '/' ? 'primary.main' : 'text.secondary' }}>
            <SpaceDashboardOutlinedIcon />
          </ListItemIcon>
          <ListItemText primary="Dashboard" />
        </ListItemButton>
        <ListItemButton
          component={RouterLink}
          to="/notifications"
          selected={pathname === '/notifications'}
          sx={{ borderRadius: 1 }}
        >
          <ListItemIcon
            sx={{
              minWidth: 40,
              color: pathname === '/notifications' ? 'primary.main' : 'text.secondary',
            }}
          >
            <NotificationsOutlinedIcon />
          </ListItemIcon>
          <ListItemText primary="Notifications" />
        </ListItemButton>
      </List>
    </Box>
  );

  return (
    <Box className="flex min-h-screen flex-col">
      <AppBar position="sticky" elevation={0} sx={appBarSx(theme)}>
        <Toolbar className="mx-auto flex w-full max-w-shell flex-wrap items-center gap-x-2 gap-y-2 px-3 sm:px-6" disableGutters>
          {isMobileNav ? (
            <IconButton
              color="inherit"
              aria-label="Open navigation menu"
              edge="start"
              onClick={() => setMobileOpen(true)}
              size="medium"
            >
              <MenuIcon />
            </IconButton>
          ) : null}

          <Box className="flex min-w-0 items-center gap-2">
            <MonitorHeartIcon className="h-6 w-6 shrink-0 text-pb-primary" aria-hidden />
            <Typography
              variant="h6"
              component={RouterLink}
              to="/"
              className="min-w-0 max-w-[55vw] truncate font-bold no-underline text-inherit sm:max-w-none"
            >
              {brand.displayName}
            </Typography>
          </Box>

          {!isMobileNav ? (
            <Box className="flex items-center gap-1 sm:gap-2">
              <Link
                component={RouterLink}
                to="/"
                underline="none"
                className={navLinkClassName(pathname === '/')}
              >
                <SpaceDashboardOutlinedIcon className="shrink-0 text-[1.25rem]" aria-hidden />
                Dashboard
              </Link>
              <Link
                component={RouterLink}
                to="/notifications"
                underline="none"
                className={navLinkClassName(pathname === '/notifications')}
              >
                <NotificationsOutlinedIcon className="shrink-0 text-[1.25rem]" aria-hidden />
                Notifications
              </Link>
            </Box>
          ) : null}

          <Box sx={{ flexGrow: 1 }} aria-hidden />

          <UserMenu />
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={closeDrawer}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
            backgroundImage: 'none',
            borderRight: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        {drawer}
      </Drawer>

      <Container maxWidth="xl" className="flex flex-1 flex-col px-3 py-4 sm:px-6 sm:py-6">
        {children}
      </Container>
    </Box>
  );
}
