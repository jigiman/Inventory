import { useEffect, useRef, useState } from 'react';
import { 
  AlertTriangle, 
  AlertOctagon,
  Clock,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import { api } from '../api';
import * as echarts from 'echarts';

interface DashboardStats {
  totalProducts: number;
  totalQuantity: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalDebtors: number;
  totalCreditors: number;
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
        setProducts(prodData.items);
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

    const isDark = document.documentElement.classList.contains('dark');

    const chartInstance = echarts.init(chartRef.current, isDark ? 'dark' : undefined);
    const option = {
      backgroundColor: 'transparent',
      title: {
        text: 'Stock Value Distribution',
        left: 'center',
        top: 10,
        textStyle: {
          color: isDark ? '#f8fafc' : '#0f172a',
          fontFamily: 'Plus Jakarta Sans',
          fontWeight: '800',
          fontSize: 16,
        },
      },
      tooltip: {
        trigger: 'item',
        formatter: '{b}: <b>${c}</b> ({d}%)',
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderColor: isDark ? '#1e293b' : '#e2e8f0',
        textStyle: {
          color: isDark ? '#cbd5e1' : '#475569',
          fontFamily: 'Plus Jakarta Sans',
        },
        borderRadius: 8,
        shadowColor: 'rgba(0, 0, 0, 0.05)',
        shadowBlur: 10,
      },
      legend: {
        orient: 'horizontal',
        bottom: '0%',
        left: 'center',
        textStyle: {
          color: isDark ? '#cbd5e1' : '#475569',
          fontFamily: 'Plus Jakarta Sans',
          fontWeight: '600',
          fontSize: 11,
        },
        itemWidth: 10,
        itemHeight: 10,
        icon: 'circle',
      },
      color: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6'],
      series: [
        {
          name: 'Valuation',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '48%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: isDark ? '#0f172a' : '#ffffff',
            borderWidth: 2,
          },
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
              fontFamily: 'Plus Jakarta Sans',
              formatter: '{b}'
            }
          },
          labelLine: {
            show: false
          },
          data: chartData,
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
      <div className="flex h-[70vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent dark:border-indigo-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 text-sm text-red-650 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 pb-4">
        <div className="flex items-center space-x-4.5 py-3">
          <div className="rounded-2xl bg-amber-50 p-3.5 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-405">Low Stock Items</p>
            <h3 className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{stats?.lowStockCount}</h3>
          </div>
        </div>

        <div className="flex items-center space-x-4.5 py-3">
          <div className="rounded-2xl bg-rose-50 p-3.5 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
            <AlertOctagon size={24} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-455">Out of Stock</p>
            <h3 className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">{stats?.outOfStockCount}</h3>
          </div>
        </div>

        <div className="flex items-center space-x-4.5 py-3">
          <div className="rounded-2xl bg-cyan-50 p-3.5 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400">
            <ArrowDownLeft size={24} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-455">Total Debtors</p>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
              ${stats?.totalDebtors.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
        </div>

        <div className="flex items-center space-x-4.5 py-3">
          <div className="rounded-2xl bg-orange-50 p-3.5 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
            <ArrowUpRight size={24} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-455">Total Creditors</p>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
              ${stats?.totalCreditors.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
        </div>
      </div>

      {/* Grid for Chart & Table */}
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 pt-4">
        <div className="flex h-[420px] flex-col">
          <div ref={chartRef} className="h-full w-full" />
        </div>

        <div className="flex h-[420px] flex-col">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Recent Activity
            </h3>
            <span className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-400">
              <Clock size={12} />
              <span>Live Updates</span>
            </span>
          </div>
          <div className="flex-1 overflow-y-auto pr-1">
            <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
              <thead className="sticky top-0 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400 dark:bg-[#070b13] pb-3 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-3">Product</th>
                  <th className="py-3">Type</th>
                  <th className="py-3 text-right">Qty</th>
                  <th className="py-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80 dark:divide-slate-800/80">
                {stats?.recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="py-3.5 font-bold text-slate-800 dark:text-slate-200">{tx.productName}</td>
                    <td className="py-3.5">
                      <span
                        className={`text-2xs font-extrabold uppercase tracking-wide px-2.5 py-0.5 rounded-full ${
                          tx.transactionType === 'Purchase' || tx.transactionType === 'Opening' || tx.transactionType === 'Adjustment+'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/20'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200/20'
                        }`}
                      >
                        {tx.transactionType}
                      </span>
                    </td>
                    <td className="py-3.5 text-right font-extrabold text-slate-700 dark:text-slate-350">
                      {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                    </td>
                    <td className="py-3.5 text-right text-xs text-slate-405">
                      {new Date(tx.transactionDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                    </td>
                  </tr>
                ))}
                {stats?.recentTransactions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                      No transactions recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
