import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Avatar,
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { useAuth } from '../contexts/AuthContext';

export default function UserMenu({
  variant = 'toolbar',
  sidebarShowLabel = true,
}: {
  variant?: 'toolbar' | 'sidebar';
  /** When variant is sidebar, show username beside avatar */
  sidebarShowLabel?: boolean;
}) {
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const initial = user?.username?.charAt(0).toUpperCase() || '?';

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

  const menu = (
    <Menu
      id="user-account-menu"
      anchorEl={anchorEl}
      open={open}
      onClose={() => setAnchorEl(null)}
      anchorOrigin={
        variant === 'sidebar'
          ? { vertical: 'top', horizontal: 'right' }
          : { vertical: 'bottom', horizontal: 'right' }
      }
      transformOrigin={
        variant === 'sidebar'
          ? { vertical: 'bottom', horizontal: 'left' }
          : { vertical: 'top', horizontal: 'right' }
      }
      slotProps={{
        paper: {
          sx: { minWidth: 220, mt: variant === 'sidebar' ? -1 : 1, ml: variant === 'sidebar' ? 1 : 0 },
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
      <>
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
            onClick={(e) => setAnchorEl(e.currentTarget)}
            aria-controls={open ? 'user-account-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={open ? 'true' : undefined}
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
        {menu}
      </>
    );
  }

  return (
    <>
      <IconButton
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-controls={open ? 'user-account-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        aria-label="Account menu"
        size="small"
        sx={{ p: 0.5 }}
      >
        {avatar}
      </IconButton>
      {menu}
    </>
  );
}
