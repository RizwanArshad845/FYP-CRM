import express from 'express';
import { 
    getEmployeesWithPayroll, updateEmployeeSalary, generateSalarySlip, getSalarySlips, runPayroll, payrollRunSchema,
    getExpenses, createExpense, updateExpense, deleteExpense
} from '../controllers/financeController.js';

import { allow } from '../policy/index.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

// Employee Salary Management (used by Finance Dashboard salary table)
router.get('/employees', allow('payroll.manage'), getEmployeesWithPayroll);
router.patch('/salary/:id', allow('payroll.manage'), updateEmployeeSalary);
router.get('/salary-slip/:id', allow('payroll.manage'), generateSalarySlip);
router.get('/salary-slips', allow('payroll.manage'), getSalarySlips);
router.post('/payroll/run', allow('payroll.manage'), validate(payrollRunSchema), runPayroll);
// Expenses CRUD
router.get('/expenses', allow('expense.manage'), getExpenses);
router.post('/expenses', allow('expense.manage'), createExpense);
router.put('/expenses/:id', allow('expense.manage'), updateExpense);
router.delete('/expenses/:id', allow('expense.manage'), deleteExpense);

export default router;
