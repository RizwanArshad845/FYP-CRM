import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { DollarSign, Download, Calculator, TrendingUp, TrendingDown, Edit, Search, Plus, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { Employee } from '../../types/crm';
import { DashboardHeader } from '../../components/shared/DashboardHeader';
import { WelcomeHero } from '../../components/shared/WelcomeHero';
import { StatCard } from '../../components/shared/StatCard';
import { cls } from '../../styles/classes';
import { useEmployees } from '../../context/EmployeeContext';
import { LoadingScreen } from '../../components/shared/LoadingScreen';
import { getPortalTheme } from '../../styles/portal-themes';
import { useFinance, Expense as FinanceExpense } from '../../context/FinanceContext';
import { useClients } from '../../context/ClientContext';
import { apiFetch } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { BRAND_NAME } from '../../components/shared/BrandMark';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const theme = getPortalTheme('finance');

// ==========================================
// Types — aligned with backend DB schema
// ==========================================

// payrolls.status can be 'pending' | 'processed' | 'paid'
// Frontend maps 'processed' → 'partial' for display, keeps 'pending'/'paid' as-is
type PaymentStatus = 'paid' | 'pending' | 'partial';
type ExpenseStatus = 'paid' | 'pending';

type Expense = {
  id: number;
  category: string;
  amount: number;
  expense_date: string;
  status: ExpenseStatus;
};

// Shape returned by GET /finance/salary-slip/:id (generateSalarySlip)
type SalarySlip = {
  id: number;
  employeeName: string;
  employeeId: string;
  email: string;
  department: string;
  role: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  baseSalary: number;
  advancePayments: number;
  accruedPayments: number;
  totalSalary: number;
  paymentStatus: PaymentStatus;
  processedAt: string;
};

const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  partial: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
};

const CALC_FIELDS: { k: string; label: string; placeholder: string }[] = [
  { k: 'base', label: 'Base Salary', placeholder: '5000' },
  { k: 'bonus', label: 'Bonuses', placeholder: '500' },
  { k: 'deductions', label: 'Deductions', placeholder: '200' },
  { k: 'advances', label: 'Advances', placeholder: '300' },
];

const PKR = (n: number) => `₨ ${n.toLocaleString()}`;

// One salary slip on the current PDF page (A4, mm); shared by single and bulk downloads.
const drawSlip = (pdf: jsPDF, slip: SalarySlip, orgName: string) => {
  // 1. Header
  pdf.setFontSize(22);
  pdf.setTextColor(44, 62, 80); // #2C3E50
  pdf.text('Official Salary Slip', 20, 25);
  
  pdf.setFontSize(10);
  pdf.setTextColor(128, 128, 128);
  pdf.text('PRIVATE & CONFIDENTIAL', 20, 32);
  
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  // The slip is issued by the employer organization, not the platform
  pdf.text(orgName, 140, 25);
  pdf.text(`Date: ${new Date().toLocaleDateString()}`, 140, 30);

  pdf.setDrawColor(200, 200, 200);
  pdf.line(20, 40, 190, 40);

  // 2. Employee Info Box
  pdf.setFillColor(245, 247, 250);
  pdf.rect(20, 45, 170, 40, 'F');
  
  pdf.setFontSize(9);
  pdf.setTextColor(100, 100, 100);
  pdf.text('Employee Name', 25, 53);
  pdf.text('Employee ID', 110, 53);
  pdf.text('Department', 25, 73);
  pdf.text('Role', 110, 73);
  
  pdf.setFontSize(11);
  pdf.setTextColor(0, 0, 0);
  pdf.text(slip.employeeName, 25, 60);
  pdf.text(slip.employeeId, 110, 60);
  pdf.text(slip.department, 25, 80);
  pdf.text(slip.role, 110, 80);

  // 3. Pay Period
  pdf.setFontSize(10);
  pdf.text(`Pay Period: ${slip.payPeriodStart} to ${slip.payPeriodEnd}`, 20, 100);

  // 4. Salary Breakdown Table
  const startY = 110;
  pdf.setDrawColor(220, 220, 220);
  pdf.rect(20, startY, 170, 60);
  
  // Rows
  const row = (label: string, value: string, y: number, isBold = false) => {
      pdf.setFontSize(10);
      if (isBold) pdf.setFont('helvetica', 'bold');
      else pdf.setFont('helvetica', 'normal');
      
      pdf.text(label, 25, y);
      // Replace the Unicode PKR symbol with safe 'Rs.' for the PDF
      const safeValue = value.replace('₨', 'Rs.');
      pdf.text(safeValue, 185, y, { align: 'right' });
  };

  row('Base Salary', PKR(slip.baseSalary), startY + 15);
  row('Accrued Payments (Bonus)', PKR(slip.accruedPayments || 0), startY + 30);
  row('Advance Payments (Deductions)', `- ${PKR(slip.advancePayments || 0)}`, startY + 45);
  
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  pdf.line(25, startY + 50, 185, startY + 50);
  
  row('Net Payable Amount', PKR(slip.totalSalary), startY + 56, true);

  // 5. Footer
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text('This is a computer generated document and does not require a signature.', 105, 180, { align: 'center' });
  pdf.text(`Generated with ${BRAND_NAME}`, 105, 185, { align: 'center' });
};

// Row of GET /finance/salary-slip(s) to the slip shape used by the dialog and PDF
const toSlip = (s: any, id: number): SalarySlip => ({
  id,
  employeeName: s.employee_name,
  employeeId: s.employee_id,
  email: s.email,
  department: s.department,
  role: s.role,
  payPeriodStart: String(s.pay_period_start).split('T')[0],
  payPeriodEnd: String(s.pay_period_end).split('T')[0],
  baseSalary: parseFloat(s.base_salary),
  advancePayments: parseFloat(s.advance_payments),
  accruedPayments: parseFloat(s.accrued_payments),
  totalSalary: parseFloat(s.total_salary),
  paymentStatus: s.payment_status,
  processedAt: s.processed_at,
});

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const EDIT_FIELDS: { k: 'advancePayments' | 'accruedPayments'; label: string }[] = [
  { k: 'advancePayments', label: 'Advance Payments (PKR)' },
  { k: 'accruedPayments', label: 'Bonus (PKR)' },
];

type EditForm = { advancePayments: string; accruedPayments: string; paymentStatus: PaymentStatus };
const EMPTY_EDIT: EditForm = { advancePayments: '', accruedPayments: '', paymentStatus: 'pending' };

/** Helper: get current pay period start/end (matches backend updateEmployeeSalary logic) */
const getCurrentPayPeriod = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
};

export function FinanceDashboard() {
  const { payrolls, expenses, isLoading, addExpense, updateExpense, deleteExpense, updatePayroll, fetchPayrolls: refreshFinance } = useFinance();
  const { user } = useAuth();
  const { clients } = useClients();
  const [filterDept, setFilterDept] = useState('all');
  const [showCalc, setShowCalc] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT);
  const [calc, setCalc] = useState({ base: '', bonus: '', deductions: '', advances: '' });
  const [calcEmployee, setCalcEmployee] = useState('');

  // Payroll run state
  const [runMonth, setRunMonth] = useState(currentMonth());
  const [confirmRunOpen, setConfirmRunOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ month: string; processed: number; skipped: { user_id: number; name: string; reason: string }[] } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');

  // Salary Slip State
  const [isSlipOpen, setIsSlipOpen] = useState(false);
  const [currentSlip, setCurrentSlip] = useState<SalarySlip | null>(null);

  // Expense State
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [expenseForm, setExpenseForm] = useState({ category: '', amount: '', expense_date: '', status: 'pending' as any });

  const active = payrolls; // Backend returns active employees primarily or handles it
  const displayed = (filterDept === 'all' ? payrolls : payrolls.filter(e => e.department.toLowerCase() === filterDept))
    .filter(e => !employeeSearch || e.name.toLowerCase().includes(employeeSearch.toLowerCase()) || e.employee_id.toLowerCase().includes(employeeSearch.toLowerCase()));

  const totalSalaries = payrolls.reduce((s, e) => s + (e.total_salary || 0), 0);
  const totalAdvances = payrolls.reduce((s, e) => s + (e.advance_payments || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  
  // Dynamic Revenue: Sum of payment_amount from active clients
  const totalRevenue = clients
    .filter(c => c.status === 'active')
    .reduce((sum, c) => sum + (Number(c.payment_amount) || 0), 0);

  const calcTotal = Number(calc.base || 0) + Number(calc.bonus || 0) - Number(calc.deductions || 0) - Number(calc.advances || 0);

  // ==========================================
  // Salary Edit — maps to PATCH /finance/salary/:id (updateEmployeeSalary)
  // ==========================================

  const openEdit = (emp: any) => {
    // Standardize ID from multiple sources (table row or slip object)
    const userId = Number(emp.id || emp.user_id || (typeof emp === 'object' && emp.id));
    if (!userId) {
        console.error('No employee ID found for editing', emp);
        toast.error('Could not identify employee record');
        return;
    }
    
    setEditingEmp({ ...emp, id: userId });
    setEditForm({
      advancePayments: String(emp.advancePayments ?? emp.advance_payments ?? 0),
      accruedPayments: String(emp.accruedPayments ?? emp.accrued_payments ?? 0),
      paymentStatus: (emp.paymentStatus ?? emp.payment_status ?? 'pending') as PaymentStatus,
    });
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingEmp || isSaving) return;
    setIsSaving(true);
    try {
      await updatePayroll(editingEmp.id, {
        base_salary: Number(editingEmp.base_salary ?? editingEmp.baseSalary ?? 0),
        advance_payments: Number(editForm.advancePayments),
        accrued_payments: Number(editForm.accruedPayments),
        payment_status: editForm.paymentStatus
      });
      setIsEditOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!currentSlip) return;
    
    try {
        toast.loading('Generating PDF...', { id: 'pdf-loading' });
        
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        drawSlip(pdf, currentSlip, user?.organization?.name ?? BRAND_NAME);

        const filename = `Salary_Slip_${currentSlip.employeeName.replace(/\s+/g, '_')}_${currentSlip.payPeriodStart}.pdf`;
        pdf.save(filename);
        
        toast.success('Salary slip downloaded!', { id: 'pdf-loading' });
    } catch (error: any) {
        console.error('PDF Error:', error);
        toast.error(`Failed to generate PDF: ${error.message || 'Unknown error'}`, { id: 'pdf-loading' });
    }
  };

  // ==========================================
  // Salary Slip — maps to GET /finance/salary-slip/:id (generateSalarySlip)
  // ==========================================

  const openSalarySlip = async (emp: any) => {
    try {
        const res = await apiFetch(`/finance/salary-slip/${emp.id}`);
        if (res.success) {
            setCurrentSlip(toSlip(res.data, emp.id));
            setIsSlipOpen(true);
        }
    } catch (error) {
        toast.error('Failed to generate salary slip');
    }
  };

  // ==========================================
  // Payroll run (UC6) — POST /finance/payroll/run, GET /finance/salary-slips
  // ==========================================

  const runPayroll = async () => {
    setConfirmRunOpen(false);
    setIsRunning(true);
    try {
      const res = await apiFetch('/finance/payroll/run', { method: 'POST', body: JSON.stringify({ month: runMonth }) });
      setRunResult({ month: runMonth, processed: res.data.processed.length, skipped: res.data.skipped });
      refreshFinance();
      toast.success(`Payroll saved for ${res.data.processed.length} employee(s)`);
    } catch (error: any) {
      toast.error(error.message || 'Payroll run failed');
    } finally {
      setIsRunning(false);
    }
  };

  // One PDF, one slip per page, in the existing slip layout
  const downloadAllSlips = async () => {
    if (!runResult) return;
    try {
      toast.loading('Generating PDF...', { id: 'pdf-all' });
      const res = await apiFetch(`/finance/salary-slips?month=${runResult.month}`);
      if (!res.data.length) { toast.error('No slips for this month', { id: 'pdf-all' }); return; }
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      res.data.forEach((row: any, i: number) => {
        if (i > 0) pdf.addPage();
        drawSlip(pdf, toSlip(row, row.user_id), user?.organization?.name ?? BRAND_NAME);
      });
      pdf.save(`Salary_Slips_${runResult.month}.pdf`);
      toast.success(`${res.data.length} slip(s) downloaded`, { id: 'pdf-all' });
    } catch (error: any) {
      toast.error(error.message || 'Could not download slips', { id: 'pdf-all' });
    }
  };

  // The calculator saves through the same PATCH /finance/salary/:id as the edit dialog:
  // deductions and advances are both stored as advances, so net = base + bonus - deductions - advances.
  const saveCalculation = async () => {
    const emp = payrolls.find(e => String(e.id) === calcEmployee);
    if (!emp) { toast.error('Choose an employee first'); return; }
    setIsSaving(true);
    try {
      await updatePayroll(emp.id, {
        base_salary: Number(calc.base || 0),
        advance_payments: Number(calc.deductions || 0) + Number(calc.advances || 0),
        accrued_payments: Number(calc.bonus || 0),
        payment_status: (emp.payment_status ?? 'pending') as PaymentStatus,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // Expense CRUD — maps to /finance/expenses endpoints
  // ==========================================

  const openExpenseModal = (exp?: Expense) => {
    if (exp) {
      setEditingExpenseId(exp.id);
      setExpenseForm({ category: exp.category, amount: String(exp.amount), expense_date: exp.expense_date, status: exp.status });
    } else {
      setEditingExpenseId(null);
      setExpenseForm({ category: '', amount: '', expense_date: new Date().toISOString().split('T')[0], status: 'pending' });
    }
    setIsExpenseOpen(true);
  };

  const handleExpenseSubmit = async () => {
    if (!expenseForm.category || !expenseForm.amount || !expenseForm.expense_date) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (isSaving) return;

    setIsSaving(true);
    try {
      if (editingExpenseId !== null) {
        await updateExpense(editingExpenseId, {
            category: expenseForm.category,
            amount: Number(expenseForm.amount),
            expense_date: expenseForm.expense_date,
            status: expenseForm.status
        });
      } else {
        await addExpense({
            category: expenseForm.category,
            amount: Number(expenseForm.amount),
            expense_date: expenseForm.expense_date,
            status: expenseForm.status
        });
      }
      setIsExpenseOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteExpenseRow = async (id: number) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    await deleteExpense(id);
  };

  if (isLoading) return <LoadingScreen message="Auditing Financial Records..." />;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader title="Finance Team Portal" theme={theme} />
      <main className="px-6 py-5 space-y-6">
        {/* Welcome Hero */}
        <WelcomeHero theme={theme}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold mb-1 text-foreground">Financial Overview</h2>
              <p className="text-sm text-muted-foreground">Manage payroll, expenses, and financial metrics</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{active.length}</p>
                <p className="text-xs text-muted-foreground">Active Employees</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">$ {(totalRevenue / 1000).toFixed(1)}k</p>
                <p className="text-xs text-muted-foreground">Revenue</p>
              </div>
            </div>
          </div>
        </WelcomeHero>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<DollarSign className="h-5 w-5 text-violet-500" />} title="Total Salaries" value={PKR(totalSalaries)} subtitle={`${active.length} active employees`} accentColor={theme.accent} />
          <StatCard icon={<TrendingDown className="h-5 w-5 text-orange-500" />} title="Advance Payments" value={PKR(totalAdvances)} subtitle="Paid in advance" valueClassName="text-orange-600" accentColor={theme.accent} />
        <StatCard icon={<TrendingUp className="h-5 w-5 text-green-500" />} title="Total Incoming" value={`$ ${totalRevenue.toLocaleString()}`} subtitle="Revenue this month" valueClassName="text-green-600" accentColor={theme.accent} trend={{ value: 8 }} />
        <StatCard icon={<Calculator className="h-5 w-5 text-blue-500" />} title="Monthly Expenses" value={PKR(totalSalaries + totalExpenses)} subtitle="Total outgoing" valueClassName="text-blue-600" accentColor={theme.accent} trend={{ value: -3 }} />
        </div>

        {/* Auto Salary Calculator — standalone tool, maps to processPayroll formula */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className={cls.row}>
              <div>
                <CardTitle>Auto Salary Calculator</CardTitle>
                <CardDescription>Calculate salary with bonuses and deductions</CardDescription>
              </div>
              <Button onClick={() => setShowCalc(v => !v)}>
                <Calculator className="h-4 w-4 mr-2" />{showCalc ? 'Hide' : 'Show'} Calculator
              </Button>
            </div>
          </CardHeader>
          {showCalc && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {CALC_FIELDS.map(({ k, label, placeholder }) => (
                  <div key={k} className={cls.field}>
                    <Label>{label}</Label>
                    <Input type="number" placeholder={placeholder}
                      value={calc[k as keyof typeof calc]}
                      onChange={e => setCalc(prev => ({ ...prev, [k]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div className={`mt-4 ${cls.mutedLg}`}>
                <p className={cls.hint}>Total Calculated</p>
                <p className="text-3xl font-bold">₨ {calcTotal.toLocaleString()}</p>
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div className={cls.field}>
                  <Label>Employee</Label>
                  <Select value={calcEmployee} onValueChange={(v) => {
                    setCalcEmployee(v);
                    const emp = payrolls.find(e => String(e.id) === v);
                    if (emp) setCalc(prev => ({ ...prev, base: String(emp.base_salary || '') }));
                  }}>
                    <SelectTrigger className="w-[240px]"><SelectValue placeholder="Choose an employee" /></SelectTrigger>
                    <SelectContent>{payrolls.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button disabled={!calcEmployee || isSaving} onClick={saveCalculation}>Save to employee</Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Payroll run (UC6): pay every active employee for a month, then download all slips */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Payroll run</CardTitle>
            <CardDescription>Calculate and save the pay of every active employee for a month, then download all salary slips.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className={cls.field}>
                <Label htmlFor="run-month">Month</Label>
                <Input id="run-month" type="month" value={runMonth} onChange={e => setRunMonth(e.target.value)} className="w-[200px]" />
              </div>
              <Button disabled={!runMonth || isRunning} onClick={() => setConfirmRunOpen(true)}>
                <FileText className="h-4 w-4 mr-2" />{isRunning ? 'Generating…' : 'Generate all slips'}
              </Button>
            </div>
            {runResult && (
              <div className="rounded-[10px] border border-border p-4 space-y-3">
                <p className="text-sm">
                  <strong>{runResult.processed}</strong> employee{runResult.processed === 1 ? '' : 's'} processed for {runResult.month}
                  {runResult.skipped.length > 0 && <>, <strong>{runResult.skipped.length}</strong> skipped</>}.
                </p>
                {runResult.skipped.length > 0 && (
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {runResult.skipped.map(s => <li key={s.user_id}>{s.name}: {s.reason}</li>)}
                  </ul>
                )}
                <Button variant="outline" disabled={!runResult.processed} onClick={downloadAllSlips}>
                  <Download className="h-4 w-4 mr-2" />Download all slips
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={confirmRunOpen} onOpenChange={setConfirmRunOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Generate all slips for {runMonth}?</AlertDialogTitle>
              <AlertDialogDescription>
                The pay of every active employee is calculated and saved for this month. Running it again for the same month updates the records instead of duplicating them.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={runPayroll}>Generate</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Employee Salary Table — data from GET /finance/employees (getEmployeesWithPayroll) */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className={cls.row}>
              <div>
                <CardTitle>Employee Salary Management</CardTitle>
                <CardDescription>Payroll syncs automatically with Admin employee additions</CardDescription>
              </div>
              <div className={`${cls.actions} flex-wrap`}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search employee..." value={employeeSearch} onChange={e => setEmployeeSearch(e.target.value)} className="pl-9 h-9 text-sm w-[200px]" />
                </div>
                <Select value={filterDept} onValueChange={setFilterDept}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Departments" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {['sales', 'cst', 'finance'].map(d => <SelectItem key={d} value={d}>{d.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />Export</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="w-full text-sm">
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    {['Employee', 'ID', 'Dept', 'Status', 'Base', 'Advances', 'Bonus', 'Total', 'Payment', 'Actions'].map(h => (
                      <TableHead key={h} className={cls.tableHead}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y">
                  {displayed.map((emp, i) => (
                    <TableRow key={emp.id} className={`${cls.tableRow} ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                      <TableCell className={`${cls.tableCell} ${cls.heading}`}>{emp.name}</TableCell>
                      <TableCell className={`${cls.tableCell} ${cls.mono}`}>{emp.employee_id}</TableCell>
                      <TableCell className={cls.tableCell}>{emp.department}</TableCell>
                      <TableCell className={cls.tableCell}>
                        <Badge variant={emp.is_active ? 'default' : 'secondary'}>{emp.is_active ? 'Active' : 'Inactive'}</Badge>
                      </TableCell>
                      <TableCell className={cls.tableCell}>{PKR(emp.base_salary)}</TableCell>
                      <TableCell className={`${cls.tableCell} text-orange-600`}>{PKR(emp.advance_payments)}</TableCell>
                      <TableCell className={`${cls.tableCell} text-green-600`}>{PKR(emp.accrued_payments || 0)}</TableCell>
                      <TableCell className={`${cls.tableCell} ${cls.heading}`}>{PKR(emp.total_salary)}</TableCell>
                      <TableCell className={cls.tableCell}>
                        <Badge className={PAYMENT_COLORS[emp.payment_status as PaymentStatus] || PAYMENT_COLORS.pending}>{emp.payment_status}</Badge>
                      </TableCell>
                      <TableCell className={cls.tableCell}>
                        <div className={cls.iconRow}>
                          <Button variant="outline" size="sm" onClick={() => openEdit({
                              id: emp.id,
                              name: emp.name,
                              baseSalary: emp.base_salary,
                              advancePayments: emp.advance_payments,
                              accruedPayments: emp.accrued_payments,
                              paymentStatus: emp.payment_status
                          } as any)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="outline" size="sm" onClick={() => openSalarySlip(emp)}>
                            <FileText className="h-4 w-4 mr-1" />Slip
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Expenses Table — data from GET /finance/expenses (getExpenses) */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className={cls.row}>
              <div>
                <CardTitle>Monthly Expenses</CardTitle>
                <CardDescription>Operational expenses for the current month</CardDescription>
              </div>
              <Button onClick={() => openExpenseModal()} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg">
                <Plus className="h-5 w-5 mr-2" /> ADD NEW EXPENSE
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <p className={`${cls.hint} text-center py-6`}>No expenses recorded yet.</p>
            ) : (
            <div className="overflow-x-auto">
              <Table className="w-full text-sm">
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    {['Category', 'Amount (PKR)', 'Date', 'Status', 'Actions'].map(h => (
                      <TableHead key={h} className={cls.tableHead}>{h}</TableHead>
                    ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map(exp => (
                      <TableRow key={exp.id} className={cls.tableRow}>
                        <TableCell className={`${cls.tableCell} ${cls.heading}`}>{exp.category}</TableCell>
                        <TableCell className={`${cls.tableCell} font-mono`}>{PKR(Number(exp.amount))}</TableCell>
                        <TableCell className={`${cls.tableCell} ${cls.mono} text-xs`}>{exp.expense_date?.split('T')[0]}</TableCell>
                        <TableCell className={cls.tableCell}>
                          <Badge className={exp.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                            {exp.status}
                          </Badge>
                        </TableCell>
                        <TableCell className={cls.tableCell}>
                          <div className="flex gap-2 items-center">
                            <Button variant="outline" size="sm" className="border-blue-500 text-blue-700 hover:bg-blue-50" onClick={() => openExpenseModal(exp as any)}>
                              <Edit className="h-4 w-4 mr-1" /> Edit
                            </Button>
                            <Button variant="outline" size="sm" className="border-red-500 text-red-700 hover:bg-red-50" onClick={() => handleDeleteExpenseRow(exp.id)}>
                              <Trash2 className="h-4 w-4 mr-1" /> Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 font-semibold">
                      <TableCell className={`${cls.tableCell} ${cls.heading}`}>Total</TableCell>
                      <TableCell className={`${cls.tableCell} font-mono`}>{PKR(totalExpenses)}</TableCell>
                      <TableCell colSpan={3} />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ==========================================
            Salary Edit Dialog — PATCH /finance/salary/:id
            ========================================== */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Salary</DialogTitle>
              <DialogDescription>{editingEmp && `Update salary for ${editingEmp.name}`}</DialogDescription>
            </DialogHeader>
            <div className={cls.section}>
              <div className={cls.muted}>
                <p className={cls.hint}>Base Salary (Set by Admin)</p>
                <p className="font-semibold text-lg">{PKR(Number(editingEmp?.base_salary ?? editingEmp?.baseSalary ?? 0))}</p>
              </div>
              {EDIT_FIELDS.map(({ k, label }) => (
                <div key={k} className={cls.field}>
                  <Label>{label}</Label>
                  <Input type="number" value={editForm[k as keyof EditForm]}
                    onChange={e => setEditForm(prev => ({ ...prev, [k]: e.target.value }))} />
                </div>
              ))}
              <div className={cls.field}>
                <Label>Payment Status *</Label>
                <Select value={editForm.paymentStatus} onValueChange={(v: PaymentStatus) => setEditForm(prev => ({ ...prev, paymentStatus: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className={cls.muted}>
                <p className={cls.hint}>Total Salary (Base + Bonus − Advances)</p>
                <p className={cls.metric}>{PKR(Number(editingEmp?.base_salary ?? editingEmp?.baseSalary ?? 0) + Number(editForm.accruedPayments) - Number(editForm.advancePayments))}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSaving}>Cancel</Button>
              <Button onClick={handleUpdate} disabled={isSaving}>
                {isSaving ? 'Saving Changes...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ==========================================
            Salary Slip Dialog — GET /finance/salary-slip/:id
            ========================================== */}
        <Dialog open={isSlipOpen} onOpenChange={setIsSlipOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> Salary Slip
              </DialogTitle>
              <DialogDescription>
                {currentSlip && `Pay period: ${currentSlip.payPeriodStart} to ${currentSlip.payPeriodEnd}`}
              </DialogDescription>
            </DialogHeader>
            {currentSlip && (
              <div id="salary-slip-content" className="space-y-4 p-6 bg-white rounded-xl text-gray-900 border border-gray-200 shadow-xl">
                <div className="flex justify-between items-start border-b pb-4">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-bold text-[#2C3E50]">Official Salary Slip</h2>
                        <p className="text-sm font-medium text-muted-foreground uppercase opacity-75">Private & Confidential</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-semibold">CRM PORTAL FINANCE</p>
                        <p className="text-xs text-muted-foreground">Generated on {new Date(currentSlip.processedAt).toLocaleDateString()}</p>
                    </div>
                </div>
                {/* Employee Info */}
                <div className="grid grid-cols-2 gap-3 p-4 rounded-lg bg-muted/50 border">
                  <div>
                    <p className="text-xs text-muted-foreground">Employee Name</p>
                    <p className="font-bold text-gray-900">{currentSlip.employeeName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Employee ID</p>
                    <p className="font-mono text-sm font-bold text-gray-900">{currentSlip.employeeId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Department</p>
                    <p className="text-sm font-semibold text-gray-800">{currentSlip.department}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Role</p>
                    <p className="text-sm font-semibold text-gray-800">{currentSlip.role}</p>
                  </div>
                </div>

                {/* Salary Breakdown */}
                <div className="space-y-2 p-4 rounded-lg border">
                  <div className="flex justify-between items-center py-1.5 border-b">
                    <span className="text-sm text-muted-foreground">Base Salary</span>
                    <span className="font-mono font-bold text-gray-900">{PKR(currentSlip.baseSalary)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                    <span className="text-sm text-green-600 font-medium">+ Bonus</span>
                    <span className="font-mono font-bold text-green-600">{PKR(currentSlip.accruedPayments || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                    <span className="text-sm text-orange-600 font-medium">− Advance Payments</span>
                    <span className="font-mono font-bold text-orange-600">{PKR(currentSlip.advancePayments || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-t-2 border-gray-200 mt-2">
                    <span className="font-bold text-gray-900">Net Pay</span>
                    <span className="font-mono font-bold text-xl text-gray-900">{PKR(currentSlip.totalSalary)}</span>
                  </div>
                </div>

                {/* Status & Meta */}
                <div className="flex justify-between items-center px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Status:</span>
                    <Badge className={PAYMENT_COLORS[currentSlip.paymentStatus]}>{currentSlip.paymentStatus}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Generated: {new Date(currentSlip.processedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )}
            <DialogFooter className="border-t pt-4 flex items-center justify-between gap-2">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsSlipOpen(false)}>Close</Button>
                <Button variant="outline" onClick={() => { setIsSlipOpen(false); openEdit(currentSlip); }}>
                  <Edit className="h-4 w-4 mr-2" /> Edit Salary
                </Button>
              </div>
              <Button onClick={handleDownloadPDF} className="bg-[#2C3E50] hover:bg-[#1a252f] text-white">
                <Download className="h-4 w-4 mr-2" />Download PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ==========================================
            Expense Edit Dialog — POST /finance/expenses or PUT /finance/expenses/:id
            ========================================== */}
        <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingExpenseId ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
              <DialogDescription>Record an operational expense</DialogDescription>
            </DialogHeader>
            <div className={cls.section}>
              <div className={cls.field}>
                <Label>Category / Description *</Label>
                <Input value={expenseForm.category} placeholder="e.g. Office Rent" onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))} />
              </div>
              <div className={cls.field}>
                <Label>Amount (PKR) *</Label>
                <Input type="number" value={expenseForm.amount} placeholder="150000" onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div className={cls.field}>
                <Label>Date *</Label>
                <Input type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm(p => ({ ...p, expense_date: e.target.value }))} />
              </div>
              <div className={cls.field}>
                <Label>Status *</Label>
                <Select value={expenseForm.status} onValueChange={(v: ExpenseStatus) => setExpenseForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsExpenseOpen(false)} disabled={isSaving}>Cancel</Button>
              <Button onClick={handleExpenseSubmit} disabled={isSaving}>
                {isSaving ? 'Processing...' : (editingExpenseId ? 'Save Changes' : 'Add Expense')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
}
