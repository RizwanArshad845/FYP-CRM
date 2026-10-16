export interface Task {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'submitted' | 'approved' | 'rejected' | 'completed' | 'missed';
  priority: 'low' | 'medium' | 'high';
  assignedTo: number;
  department: string;
  dueDate: string;
  category: string;
}

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  name: string; // Combined first + last
  email: string;
  role_id: number;
  role: 'admin' | 'sales' | 'sales_manager' | 'finance' | 'cst' | 'cst_manager';
  department: string;
  status: 'active' | 'inactive' | 'on_leave';
  clockedIn?: boolean;
  clockInTime?: string;
  clockOutTime?: string;
  onBreak?: boolean;
  breakInTime?: string;
}

export interface Event {
  id: number;
  title: string;
  date: string;
  type: 'meeting' | 'training' | 'deadline' | 'celebration' | 'other';
  created_by_user_id: number;
}

export interface Client {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: 'onboarding' | 'active' | 'flagged' | 'deactivated';
  sales_agent_id?: number;
  cst_agent_id?: number;
  healthScore?: number;
  lastInteraction?: string;
  nextCheckIn?: string;
  onboardingProgress?: number;
  isActive: boolean;
}

export interface Employee {
  id: number;
  name: string;
  employee_id: string; // Formatting like EMP001
  email: string;
  department: string;
  role: string;
  status: string;
  base_salary: number;
  advance_payments: number;
  accrued_payments: number;
  total_salary: number;
  hire_date?: string;
  payment_status: 'paid' | 'pending' | 'partial';
}

export interface AttendanceRecord {
  id: number;
  user_id: number;
  user_name: string;
  department: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: 'on-time' | 'tardy' | 'absent';
  total_hours: number | null;
}