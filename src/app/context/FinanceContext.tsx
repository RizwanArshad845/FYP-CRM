import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch } from '../utils/api';
import { toast } from 'sonner';

export interface Expense {
    id: number;
    category: string;
    amount: number;
    expense_date: string;
    status: 'pending' | 'paid';
}

export interface Payroll {
    id: number;
    user_id: number;
    name: string;
    employee_id: string;
    email: string;
    department: string;
    role: string;
    base_salary: number;
    advance_payments: number;
    accrued_payments: number;
    total_salary: number;
    payment_status: 'paid' | 'pending' | 'partial';
    hire_date: string;
    is_active: boolean;
}

interface FinanceContextType {
    expenses: Expense[];
    payrolls: Payroll[];
    isLoading: boolean;
    fetchExpenses: () => Promise<void>;
    fetchPayrolls: () => Promise<void>;
    addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
    updateExpense: (id: number, data: Partial<Expense>) => Promise<void>;
    deleteExpense: (id: number) => Promise<void>;
    updatePayroll: (userId: number, data: any) => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export function FinanceProvider({ children }: { children: ReactNode }) {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [payrolls, setPayrolls] = useState<Payroll[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchExpenses = async () => {
        try {
            const res = await apiFetch('/finance/expenses');
            if (res.success) setExpenses(res.data);
        } catch (error) {
            console.error('Failed to fetch expenses:', error);
        }
    };

    const fetchPayrolls = async () => {
        try {
            const res = await apiFetch('/finance/employees');
            if (res.success) {
                const mapped = res.data.map((p: any) => ({
                    id: p.id,
                    user_id: p.id,
                    name: p.name,
                    employee_id: p.employee_id,
                    email: p.email,
                    department: p.department,
                    role: p.role,
                    base_salary: parseFloat(p.base_salary),
                    advance_payments: parseFloat(p.advance_payments),
                    accrued_payments: parseFloat(p.accrued_payments),
                    total_salary: parseFloat(p.total_salary),
                    payment_status: p.payment_status,
                    hire_date: p.hire_date,
                    is_active: p.is_active
                }));
                setPayrolls(mapped);
            }
        } catch (error) {
            console.error('Failed to fetch payrolls:', error);
        }
    };

    useEffect(() => {
        const token = sessionStorage.getItem('crm_token');
        if (!token) {
            setIsLoading(false);
            return;
        }

        const init = async () => {
            setIsLoading(true);
            await Promise.all([fetchExpenses(), fetchPayrolls()]);
            setIsLoading(false);
        };
        init();
    }, []);

    const addExpense = async (expense: Omit<Expense, 'id'>) => {
        try {
            const res = await apiFetch('/finance/expenses', {
                method: 'POST',
                body: JSON.stringify(expense)
            });
            if (res.success) {
                fetchExpenses();
                toast.success('Expense added');
            }
        } catch (error) {
            toast.error('Failed to add expense');
        }
    };

    const updateExpense = async (id: number, data: Partial<Expense>) => {
        try {
            const res = await apiFetch(`/finance/expenses/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            if (res.success) {
                setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
                toast.success('Expense updated');
            }
        } catch (error) {
            toast.error('Failed to update expense');
        }
    };

    const deleteExpense = async (id: number) => {
        try {
            const res = await apiFetch(`/finance/expenses/${id}`, { method: 'DELETE' });
            if (res.success) {
                setExpenses(prev => prev.filter(e => e.id !== id));
                toast.success('Expense deleted');
            }
        } catch (error) {
            toast.error('Failed to delete expense');
        }
    };

    const updatePayroll = async (userId: number, data: any) => {
        try {
            const res = await apiFetch(`/finance/salary/${userId}`, {
                method: 'PATCH',
                body: JSON.stringify(data)
            });
            if (res.success) {
                fetchPayrolls();
                toast.success('Payroll updated');
            }
        } catch (error) {
            toast.error('Failed to update payroll');
        }
    };

    return (
        <FinanceContext.Provider value={{ 
            expenses, payrolls, isLoading, 
            fetchExpenses, fetchPayrolls, 
            addExpense, updateExpense, deleteExpense,
            updatePayroll 
        }}>
            {children}
        </FinanceContext.Provider>
    );
}

export function useFinance() {
    const context = useContext(FinanceContext);
    if (!context) throw new Error('useFinance must be used within FinanceProvider');
    return context;
}
