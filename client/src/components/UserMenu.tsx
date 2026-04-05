import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Avatar,
  Box,
  ClickAwayListener,
  Collapse,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Typography,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { useAuth } from '../contexts/AuthContext';

export default function UserMenu({
  variant = 'toolbar',
  sidebarShowLabel = true,
  /** Desktop sidebar icon-only rail — compact action rows */
  sidebarCollapsed = false,
}: {
  variant?: 'toolbar' | 'sidebar';
  sidebarShowLabel?: boolean;
  sidebarCollapsed?: boolean;
}) {
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const toolbarOpen = Boolean(anchorEl);
  const [sidebarPanelOpen, setSidebarPanelOpen] = useState(false);
  const initial = user?.username?.charAt(0).toUpperCase() || '?';
  const menuCompact = variant === 'sidebar' && sidebarCollapsed;

  const avatar = (
    <Avatar
      sx={{
        width: 36,
        height: 36,
        fontSize: '0.95rem',
        fontWeight: 600,
        bgcolor: 'primary.dark',
        color: 'rgba(255,255,255,0.95)',
      }}
    >
      {initial}
    </Avatar>
  );

  const toolbarMenu = (
    <Menu
      id="user-account-menu"
      anchorEl={anchorEl}
      open={toolbarOpen}
      onClose={() => setAnchorEl(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{
        paper: {
          sx: { minWidth: 220, mt: 1 },
        },
      }}
    >
      {user && user.id >= 0 ? (
        <MenuItem
          component={RouterLink}
          to="/account/password"
          onClick={() => setAnchorEl(null)}
        >
          <ListItemIcon>
            <LockOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ variant: 'body2' }}>Change password</ListItemText>
        </MenuItem>
      ) : null}
      {user && user.id >= 0 ? (
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            void logout();
          }}
        >
          <ListItemIcon>
            <LogoutOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ variant: 'body2' }}>Sign out</ListItemText>
        </MenuItem>
      ) : (
        <MenuItem disabled>
          <ListItemText
            primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
            primary="Open access (no sign-in)"
          />
        </MenuItem>
      )}
    </Menu>
  );

  if (variant === 'sidebar') {
    return (
      <ClickAwayListener onClickAway={() => setSidebarPanelOpen(false)}>
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
          }}
        >
          <Collapse in={sidebarPanelOpen} timeout="auto" unmountOnExit>
            <Paper
              id="user-account-menu"
              elevation={8}
              variant="outlined"
              sx={(theme) => ({
                mb: 1,
                borderRadius: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                boxShadow: theme.shadows[8],
                overflow: 'hidden',
              })}
            >
              <List dense disablePadding component="nav" aria-label="Account actions">
                {user && user.id >= 0 ? (
                  <ListItemButton
                    component={RouterLink}
                    to="/account/password"
                    onClick={() => setSidebarPanelOpen(false)}
                    aria-label="Change password"
                    sx={
                      menuCompact
                        ? { justifyContent: 'center', px: 1, py: 1.25, minHeight: 48 }
                        : { py: 1.25 }
                    }
                  >
                    <ListItemIcon sx={menuCompact ? { minWidth: 0 } : undefined}>
                      <LockOutlinedIcon fontSize="small" />
                    </ListItemIcon>
                    {menuCompact ? null : (
                      <ListItemText
                        primary="Change password"
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    )}
                  </ListItemButton>
                ) : null}
                {user && user.id >= 0 ? (
                  <ListItemButton
                    onClick={() => {
                      setSidebarPanelOpen(false);
                      void logout();
                    }}
                    aria-label="Sign out"
                    sx={
                      menuCompact
                        ? { justifyContent: 'center', px: 1, py: 1.25, minHeight: 48 }
                        : { py: 1.25 }
                    }
                  >
                    <ListItemIcon sx={menuCompact ? { minWidth: 0 } : undefined}>
                      <LogoutOutlinedIcon fontSize="small" />
                    </ListItemIcon>
                    {menuCompact ? null : (
                      <ListItemText primary="Sign out" primaryTypographyProps={{ variant: 'body2' }} />
                    )}
                  </ListItemButton>
                ) : (
                  <ListItemButton disabled sx={{ py: 1.25 }}>
                    <ListItemText
                      primary="Open access (no sign-in)"
                      primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                    />
                  </ListItemButton>
                )}
              </List>
            </Paper>
          </Collapse>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: sidebarShowLabel ? 1.5 : 0.5,
              py: 1.25,
              justifyContent: sidebarShowLabel ? 'flex-start' : 'center',
              width: '100%',
              minWidth: 0,
            }}
          >
            <IconButton
              onClick={() => setSidebarPanelOpen((o) => !o)}
              aria-controls={sidebarPanelOpen ? 'user-account-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={sidebarPanelOpen ? 'true' : undefined}
              aria-label="Account menu"
              size="small"
              sx={{ p: 0.25, flexShrink: 0 }}
            >
              {avatar}
            </IconButton>
            {sidebarShowLabel ? (
              <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0, fontWeight: 500 }}>
                {user?.username ?? '—'}
              </Typography>
            ) : null}
          </Box>
        </Box>
      </ClickAwayListener>
    );
  }

  return (
    <>
      <IconButton
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-controls={toolbarOpen ? 'user-account-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={toolbarOpen ? 'true' : undefined}
        aria-label="Account menu"
        size="small"
        sx={{ p: 0.5 }}
      >
        {avatar}
      </IconButton>
      {toolbarMenu}
    </>
  );
}
