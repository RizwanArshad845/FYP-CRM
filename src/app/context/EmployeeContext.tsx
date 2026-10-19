import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Employee } from '../types/crm';
import { apiFetch, getToken } from '../utils/api';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface EmployeeContextType {
    employees: Employee[];
    roles: { id: number, name: string }[];
    departments: { id: number, name: string }[];
    /** Resolves to the created result (with a one-time temp password if none was set), or null on failure */
    addEmployee: (emp: any) => Promise<{ tempPassword?: string } | null>;
    updateEmployee: (emp: any) => Promise<boolean>;
    deleteEmployee: (id: number) => Promise<boolean>;
    /** Reloads employees, roles and departments (e.g. after a CSV import) */
    refresh: () => Promise<void>;
    isLoading: boolean;
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

export function EmployeeProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [roles, setRoles] = useState<{ id: number, name: string }[]>([]);
    const [departments, setDepartments] = useState<{ id: number, name: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [usersRes, rolesRes, deptsRes] = await Promise.all([
                apiFetch('/users'),
                apiFetch('/users/roles'),
                apiFetch('/users/departments')
            ]);

            if (usersRes.success) {
                const mapped = usersRes.data.map((u: any) => ({
                    id: u.id,
                    first_name: u.first_name,
                    last_name: u.last_name,
                    name: `${u.first_name} ${u.last_name}`,
                    email: u.email,
                    role: u.role,
                    role_id: u.role_id,
                    tier: u.tier,
                    department: u.department,
                    department_id: u.department_id,
                    status: u.status,
                    base_salary: u.base_salary
                }));
                setEmployees(mapped);
            }

            if (rolesRes.success) setRoles(rolesRes.data);
            if (deptsRes.success) setDepartments(deptsRes.data);
        } catch (error) {
            console.error('Failed to fetch employees:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const token = getToken();
        if (token && user) {
            fetchData();
        } else {
            setEmployees([]);
            setIsLoading(false);
        }
    }, [user]);

    const addEmployee = async (emp: any) => {
        try {
            const res = await apiFetch('/users', {
                method: 'POST',
                body: JSON.stringify({
                    first_name: emp.firstName,
                    last_name: emp.lastName,
                    email: emp.email,
                    role_id: emp.roleId,
                    // Blank means the portal's default tier
                    ...(emp.tier ? { tier: emp.tier } : {}),
                    department_id: emp.departmentId,
                    // Blank means the server generates a one-time temporary password
                    ...(emp.password ? { password: emp.password } : {}),
                    base_salary: emp.baseSalary || 0
                })
            });
            await fetchData();
            toast.success('Employee created');
            return { tempPassword: res.tempPassword ?? undefined };
        } catch (error: any) {
            toast.error(error.message || 'Failed to create employee');
            return null;
        }
    };

    const updateEmployee = async (emp: any) => {
        try {
            const hasNames = emp.firstName && emp.lastName;
            const names = !hasNames && emp.name ? emp.name.split(' ') : [];
            const res = await apiFetch(`/users/${emp.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    first_name: emp.firstName || names[0] || '',
                    last_name: emp.lastName || names.slice(1).join(' ') || '',
                    email: emp.email,
                    role_id: emp.role_id,
                    ...(emp.tier ? { tier: emp.tier } : {}),
                    department_id: emp.department_id,
                    password: emp.password,
                    status: emp.status,
                    base_salary: emp.base_salary
                })
            });

            if (res.success) {
                await fetchData();
                toast.success('Employee updated');
                return true;
            } else {
                toast.error(res.error || 'Failed to update employee');
                return false;
            }
        } catch (error: any) {
            console.error('Update failure:', error);
            toast.error(error.message || 'Failed to update employee');
            return false;
        }
    };

    const deleteEmployee = async (id: number) => {
        try {
            const res = await apiFetch(`/users/${id}`, { method: 'DELETE' });
            if (res.success) {
                await fetchData();
                toast.success('Employee removed');
                return true;
            } else {
                toast.error(res.error || 'Failed to delete employee');
                return false;
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete employee');
            return false;
        }
    };

    return (
        <EmployeeContext.Provider value={{
            refresh: fetchData,
            employees,
            roles,
            departments,
            addEmployee,
            updateEmployee,
            deleteEmployee,
            isLoading
        }}>
            {children}
        </EmployeeContext.Provider>
    );
}

export function useEmployees() {
    const ctx = useContext(EmployeeContext);
    if (!ctx) throw new Error('useEmployees must be used within EmployeeProvider');
    return ctx;
}
