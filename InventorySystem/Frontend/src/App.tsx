import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box, Drawer, AppBar, Toolbar, List, Typography, ListItem, ListItemButton, ListItemIcon, ListItemText, IconButton } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import SettingsIcon from '@mui/icons-material/Settings';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import BusinessIcon from '@mui/icons-material/Business';
import AssessmentIcon from '@mui/icons-material/Assessment';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import StorageIcon from '@mui/icons-material/Storage';

import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Masters from './pages/Masters';
import Purchasing from './pages/Purchasing';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { api } from './api';

const drawerWidth = 240;

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const [storeName, setStoreName] = useState('Inventory Pro');

  // Load Store Name
  useEffect(() => {
    async function loadStoreName() {
      try {
        const settings = await api.getSettings();
        const nameSetting = settings.find(s => s.key === 'StoreName');
        if (nameSetting) setStoreName(nameSetting.value);
      } catch (e) {
        // Fallback to default name
      }
    }
    loadStoreName();
  }, [activePage]); // Refresh when switching pages (in case name changed in Settings)

  // Custom premium theme configuration
  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? 'dark' : 'light',
          primary: {
            main: '#6366f1', // Indigo
          },
          secondary: {
            main: '#ec4899', // Pink/Rose
          },
          background: {
            default: darkMode ? '#0b0f19' : '#f8fafc',
            paper: darkMode ? '#111827' : '#ffffff',
          },
        },
        typography: {
          fontFamily: 'Inter, system-ui, sans-serif',
          h4: {
            fontWeight: 700,
          },
          h6: {
            fontWeight: 600,
          },
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                borderRadius: '8px',
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: '12px',
              },
            },
          },
        },
      }),
    [darkMode]
  );

  const navigationItems = [
    { id: 'dashboard', text: 'Dashboard', icon: <DashboardIcon /> },
    { id: 'products', text: 'Products', icon: <Inventory2Icon /> },
    { id: 'masters', text: 'Masters', icon: <BusinessIcon /> },
    { id: 'purchasing', text: 'Purchasing', icon: <ReceiptLongIcon /> },
    { id: 'inventory', text: 'Inventory Ledger', icon: <StorageIcon /> },
    { id: 'reports', text: 'Reports', icon: <AssessmentIcon /> },
    { id: 'settings', text: 'Settings', icon: <SettingsIcon /> },
  ];

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        {/* AppBar header */}
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, boxShadow: 'none', borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', color: 'text.primary' }}>
          <Toolbar>
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 'bold', color: 'primary.main' }}>
              {storeName}
            </Typography>
            <IconButton onClick={() => setDarkMode(!darkMode)} color="inherit">
              {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Toolbar>
        </AppBar>

        {/* Sidebar Drawer */}
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box', borderRight: '1px solid', borderColor: 'divider' },
          }}
        >
          <Toolbar />
          <Box sx={{ overflow: 'auto', mt: 2 }}>
            <List>
              {navigationItems.map((item) => (
                <ListItem key={item.id} disablePadding>
                  <ListItemButton
                    selected={activePage === item.id}
                    onClick={() => setActivePage(item.id)}
                    sx={{
                      mx: 1,
                      borderRadius: '8px',
                      mb: 0.5,
                      '&.Mui-selected': {
                        bgcolor: 'primary.light',
                        color: 'primary.contrastText',
                        '& .MuiListItemIcon-root': {
                          color: 'primary.contrastText',
                        },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40, color: activePage === item.id ? 'inherit' : 'text.secondary' }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: '14px', fontWeight: activePage === item.id ? 600 : 500 }} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>
        </Drawer>

        {/* Main Content Area */}
        <Box component="main" sx={{ flexGrow: 1, p: 3, display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
          <Toolbar />
          <Box sx={{ flexGrow: 1 }}>
            {activePage === 'dashboard' && <Dashboard />}
            {activePage === 'products' && <Products />}
            {activePage === 'masters' && <Masters />}
            {activePage === 'purchasing' && <Purchasing />}
            {activePage === 'inventory' && <Inventory />}
            {activePage === 'reports' && <Reports />}
            {activePage === 'settings' && <Settings />}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
