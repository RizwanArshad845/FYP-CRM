import express from 'express';
import { 
    getEmployeesWithPayroll, updateEmployeeSalary, generateSalarySlip,
    getExpenses, createExpense, updateExpense, deleteExpense
} from '../controllers/financeController.js';

const router = express.Router();

// Employee Salary Management (used by Finance Dashboard salary table)
router.get('/employees', getEmployeesWithPayroll);
router.patch('/salary/:id', updateEmployeeSalary);
router.get('/salary-slip/:id', generateSalarySlip);
// Expenses CRUD
router.get('/expenses', getExpenses);
router.post('/expenses', createExpense);
router.put('/expenses/:id', updateExpense);
router.delete('/expenses/:id', deleteExpense);

export default router;
