import { useState } from 'react';
import { Box, Card, CardContent, CardActions, Button, Grid, Typography, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import GridOnIcon from '@mui/icons-material/GridOn';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import { api } from '../api';

export default function Reports() {
  const [formats, setFormats] = useState<{ [key: string]: string }>({
    CurrentStock: 'pdf',
    InventoryLedger: 'pdf',
    InventoryValuation: 'pdf',
    LowStock: 'pdf',
    OutOfStock: 'pdf',
    DeadStock: 'pdf',
    FastMoving: 'pdf',
    SlowMoving: 'pdf',
    SupplierReport: 'pdf',
    PurchaseReport: 'pdf',
  });

  const handleFormatChange = (reportKey: string, format: string) => {
    setFormats({ ...formats, [reportKey]: format });
  };

  const handleExport = (reportKey: string) => {
    const format = formats[reportKey] || 'pdf';
    const url = api.getExportUrl(reportKey, format);
    window.open(url, '_blank');
  };

  const reportsList = [
    {
      key: 'CurrentStock',
      title: 'Current Stock Report',
      description: 'Generates a full list of all active products, their current quantities, cost prices, and current valuations.'
    },
    {
      key: 'InventoryLedger',
      title: 'Inventory Ledger Report',
      description: 'Generates a chronological statement of all stock movements, including opening stock, purchases, and adjustments.'
    },
    {
      key: 'InventoryValuation',
      title: 'Inventory Valuation Report',
      description: 'Details product valuations by both cost price and selling price, displaying margins and inventory capital distribution.'
    },
    {
      key: 'LowStock',
      title: 'Low Stock Alert Report',
      description: 'Generates a detailed report identifying items that have fallen below their configured reorder levels.'
    },
    {
      key: 'OutOfStock',
      title: 'Out of Stock Report',
      description: 'Highlights items with zero or negative inventory balances requiring immediate purchasing actions.'
    },
    {
      key: 'DeadStock',
      title: 'Dead Stock Report',
      description: 'Identifies items with zero transaction and movement history over the past 90 days.'
    },
    {
      key: 'FastMoving',
      title: 'Fast Moving Items',
      description: 'Analyses the top 10 fastest selling/moving inventory items based on outgoing volume in the last 30 days.'
    },
    {
      key: 'SlowMoving',
      title: 'Slow Moving Items',
      description: 'Identifies products with very low sales/adjustments volume (less than 5 units) in the last 30 days.'
    },
    {
      key: 'SupplierReport',
      title: 'Supplier Performance Report',
      description: 'Aggregates counts of items supplied, and active Purchase Orders per Supplier.'
    },
    {
      key: 'PurchaseReport',
      title: 'Purchase Orders Summary',
      description: 'Lists all Purchase Orders, order dates, status, total items ordered, and total transaction costs.'
    }
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 3 }}>Reports & Exports</Typography>

      <Grid container spacing={3}>
        {reportsList.map((report) => (
          <Grid item xs={12} sm={6} md={4} key={report.key}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: 'var(--shadow-md)' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>{report.title}</Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 3, minHeight: 60 }}>
                  {report.description}
                </Typography>

                <FormControl fullWidth size="small">
                  <InputLabel>Format</InputLabel>
                  <Select
                    value={formats[report.key] || 'pdf'}
                    label="Format"
                    onChange={(e) => handleFormatChange(report.key, e.target.value)}
                  >
                    <MenuItem value="pdf">PDF Document</MenuItem>
                    <MenuItem value="excel">Excel Spreadsheet</MenuItem>
                    <MenuItem value="csv">CSV (Comma-Separated Values)</MenuItem>
                  </Select>
                </FormControl>
              </CardContent>

              <CardActions sx={{ p: 2, pt: 0 }}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => handleExport(report.key)}
                  startIcon={
                    formats[report.key] === 'pdf' ? <PictureAsPdfIcon /> :
                    formats[report.key] === 'excel' ? <GridOnIcon /> : <TextSnippetIcon />
                  }
                >
                  Export Report
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
