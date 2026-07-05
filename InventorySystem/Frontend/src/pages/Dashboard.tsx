import { useEffect, useRef, useState } from 'react';
import { Box, Card, Grid, Typography, CircularProgress, Alert, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import InventoryIcon from '@mui/icons-material/Inventory';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { api } from '../api';
import * as echarts from 'echarts';

interface DashboardStats {
  totalProducts: number;
  totalQuantity: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  recentTransactions: {
    id: number;
    transactionDate: string;
    productName: string;
    transactionType: string;
    quantity: number;
  }[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [dashData, prodData] = await Promise.all([
          api.getDashboardData(),
          api.getProducts()
        ]);
        setStats(dashData);
        setProducts(prodData);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch dashboard data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!chartRef.current || loading || error || !products.length) return;

    // Calculate valuation by category
    const valuationMap: { [key: string]: number } = {};
    products.forEach((p) => {
      const catName = p.category?.name || 'Uncategorized';
      const val = p.currentQuantity * p.costPrice;
      valuationMap[catName] = (valuationMap[catName] || 0) + val;
    });

    const chartData = Object.keys(valuationMap).map((name) => ({
      name,
      value: parseFloat(valuationMap[name].toFixed(2)),
    }));

    const chartInstance = echarts.init(chartRef.current);
    const option = {
      title: {
        text: 'Stock Value by Category',
        left: 'center',
        textStyle: {
          color: '#333',
          fontFamily: 'Inter',
        },
      },
      tooltip: {
        trigger: 'item',
        formatter: '{b}: ${c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        textStyle: {
          fontFamily: 'Inter',
        },
      },
      series: [
        {
          name: 'Valuation',
          type: 'pie',
          radius: '50%',
          data: chartData,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    };

    chartInstance.setOption(option);

    const handleResize = () => chartInstance.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.dispose();
    };
  }, [loading, error, products]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
        Dashboard
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ display: 'flex', alignItems: 'center', p: 2, boxShadow: 'var(--shadow-md)' }}>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'primary.light', mr: 2 }}>
              <InventoryIcon color="primary" />
            </Box>
            <Box>
              <Typography variant="body2" color="textSecondary">Total Products</Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{stats?.totalProducts}</Typography>
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ display: 'flex', alignItems: 'center', p: 2, boxShadow: 'var(--shadow-md)' }}>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'success.light', mr: 2 }}>
              <AttachMoneyIcon color="success" />
            </Box>
            <Box>
              <Typography variant="body2" color="textSecondary">Stock Valuation</Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                ${stats?.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ display: 'flex', alignItems: 'center', p: 2, boxShadow: 'var(--shadow-md)' }}>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'warning.light', mr: 2 }}>
              <WarningAmberIcon color="warning" />
            </Box>
            <Box>
              <Typography variant="body2" color="textSecondary">Low Stock Items</Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'warning.main' }}>{stats?.lowStockCount}</Typography>
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ display: 'flex', alignItems: 'center', p: 2, boxShadow: 'var(--shadow-md)' }}>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'error.light', mr: 2 }}>
              <ErrorOutlineIcon color="error" />
            </Box>
            <Box>
              <Typography variant="body2" color="textSecondary">Out of Stock</Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'error.main' }}>{stats?.outOfStockCount}</Typography>
            </Box>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 400, display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-md)' }}>
            <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 400, display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-md)' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Recent Transactions
            </Typography>
            <TableContainer sx={{ flexGrow: 1, overflowY: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats?.recentTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{tx.productName}</TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            color: tx.transactionType === 'Purchase' || tx.transactionType === 'Opening' || tx.transactionType === 'Adjustment+'
                              ? 'success.main'
                              : 'error.main',
                            fontWeight: 500
                          }}
                        >
                          {tx.transactionType}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 500 }}>
                        {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                      </TableCell>
                      <TableCell color="textSecondary">
                        {new Date(tx.transactionDate).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {stats?.recentTransactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">No transactions recorded yet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
