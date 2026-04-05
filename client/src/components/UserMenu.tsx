import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Avatar,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { useAuth } from '../contexts/AuthContext';

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const initial = user?.username?.charAt(0).toUpperCase() || '?';

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
      </IconButton>
      <Menu
        id="user-account-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { minWidth: 220, mt: 1 },
          },
        }}
      >
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
      </Menu>
    </>
  );
}
