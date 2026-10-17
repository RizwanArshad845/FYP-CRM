import express from 'express';
import { 
    getEmployeesWithPayroll, updateEmployeeSalary, generateSalarySlip,
    getExpenses, createExpense, updateExpense, deleteExpense
} from '../controllers/financeController.js';

import { allow } from '../policy/index.js';

const router = express.Router();

// Employee Salary Management (used by Finance Dashboard salary table)
router.get('/employees', allow('payroll.manage'), getEmployeesWithPayroll);
router.patch('/salary/:id', allow('payroll.manage'), updateEmployeeSalary);
router.get('/salary-slip/:id', allow('payroll.manage'), generateSalarySlip);
// Expenses CRUD
router.get('/expenses', allow('expense.manage'), getExpenses);
router.post('/expenses', allow('expense.manage'), createExpense);
router.put('/expenses/:id', allow('expense.manage'), updateExpense);
router.delete('/expenses/:id', allow('expense.manage'), deleteExpense);

export default router;
