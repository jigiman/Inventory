import React, { useState, useEffect } from 'react';
import { Box, Button, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography, CircularProgress, Alert, Card, CardContent, Divider } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import BackupIcon from '@mui/icons-material/Backup';
import RestoreIcon from '@mui/icons-material/Restore';
import { api } from '../api';

export default function Settings() {
  const [storeName, setStoreName] = useState('');
  const [backups, setBackups] = useState<string[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function loadSettings() {
    setLoadingSettings(true);
    try {
      const settings = await api.getSettings();
      const nameSetting = settings.find(s => s.key === 'StoreName');
      if (nameSetting) setStoreName(nameSetting.value);
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoadingSettings(false);
    }
  }

  async function loadBackups() {
    setLoadingBackups(true);
    try {
      const files = await api.getBackups();
      setBackups(files);
    } catch (err: any) {
      setError(err.message || 'Failed to load backup files');
    } finally {
      setLoadingBackups(false);
    }
  }

  useEffect(() => {
    loadSettings();
    loadBackups();
  }, []);

  const handleSaveStoreName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setError('');
    try {
      await api.saveSetting({ key: 'StoreName', value: storeName });
      setSuccessMsg('Store Name updated successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to save store name');
    }
  };

  const handleCreateBackup = async () => {
    setSuccessMsg('');
    setError('');
    try {
      const res = await api.createBackup();
      setSuccessMsg(`Backup created successfully: ${res.file}`);
      loadBackups();
    } catch (err: any) {
      setError(err.message || 'Failed to create backup');
    }
  };

  const handleRestoreBackup = async (fileName: string) => {
    if (!confirm(`WARNING: Restoring will overwrite the current database with backup file: ${fileName}. Are you sure you want to proceed?`)) return;
    setSuccessMsg('');
    setError('');
    try {
      await api.restoreBackup(fileName);
      setSuccessMsg('Database restored successfully from backup.');
      loadSettings();
    } catch (err: any) {
      setError(err.message || 'Failed to restore backup');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 3 }}>Settings & Database Maintenance</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}

      <Card sx={{ mb: 4, boxShadow: 'var(--shadow-md)' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>Store Configuration</Typography>
          <Divider sx={{ mb: 3 }} />
          {loadingSettings ? (
            <CircularProgress size={24} />
          ) : (
            <form onSubmit={handleSaveStoreName} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <TextField
                label="Store Name"
                variant="outlined"
                size="small"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                sx={{ minWidth: 300 }}
              />
              <Button type="submit" variant="contained" startIcon={<SaveIcon />}>
                Save Settings
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card sx={{ boxShadow: 'var(--shadow-md)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Database Backups & Restore</Typography>
            <Button variant="contained" color="secondary" startIcon={<BackupIcon />} onClick={handleCreateBackup}>
              Create Backup
            </Button>
          </Box>
          <Divider sx={{ mb: 3 }} />

          {loadingBackups ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress /></Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Backup Filename</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {backups.map((file) => (
                    <TableRow key={file}>
                      <TableCell>{file}</TableCell>
                      <TableCell align="right">
                        <Button
                          variant="outlined"
                          size="small"
                          color="warning"
                          startIcon={<RestoreIcon />}
                          onClick={() => handleRestoreBackup(file)}
                        >
                          Restore
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {backups.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} align="center">No database backups exist.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
