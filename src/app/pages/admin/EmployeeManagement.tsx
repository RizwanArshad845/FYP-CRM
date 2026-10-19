import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Search, UserPlus, Mail, Shield, Banknote, Clock, Pencil, Trash2, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '../../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Label } from '../../components/ui/label';
import { useEmployees } from '../../context/EmployeeContext';
import { usePortals } from '../../hooks/usePortals';
import { TierSelect } from '../../components/shared/TierSelect';
import { EmployeesStep } from '../onboarding/EmployeesStep';
import { cls } from '../../styles/classes';
import { toast } from 'sonner';
import { AlertCircle, ShieldAlert } from 'lucide-react';

export function EmployeeManagement() {
  const { employees, isLoading, addEmployee, updateEmployee, deleteEmployee, roles, departments, refresh } = useEmployees();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newEmp, setNewEmp] = useState({ firstName: '', lastName: '', email: '', roleId: '', tier: '', departmentId: '', password: '', baseSalary: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEmp, setEditingEmp] = useState<any>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // One-time display of a server-generated temporary password
  const [issuedPassword, setIssuedPassword] = useState<{ email: string; password: string } | null>(null);
  const { labelFor, tierLabel, portals } = usePortals();
  const roleKey = (roleId: string) => roles.find(r => r.id.toString() === roleId)?.name;

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmp.firstName || !newEmp.lastName || !newEmp.email || !newEmp.roleId || !newEmp.departmentId) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (newEmp.password && newEmp.password.length < 8) {
      toast.error('Initial password must be at least 8 characters');
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const created = await addEmployee(newEmp);
      if (created) {
        setIsAddDialogOpen(false);
        if (created.tempPassword) {
          setIssuedPassword({ email: newEmp.email, password: created.tempPassword });
        }
        setNewEmp({ firstName: '', lastName: '', email: '', roleId: '', tier: '', departmentId: '', password: '', baseSalary: '' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (emp: any) => {
    setEditingEmp({
      id: emp.id,
      firstName: emp.first_name,
      lastName: emp.last_name,
      email: emp.email,
      roleId: emp.role_id?.toString() || '',
      tier: emp.tier || '',
      departmentId: emp.department_id?.toString() || '',
      password: '',
      status: emp.status,
      base_salary: emp.base_salary || 0
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp.firstName || !editingEmp.lastName || !editingEmp.roleId || !editingEmp.departmentId) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const success = await updateEmployee({
        id: editingEmp.id,
        firstName: editingEmp.firstName,
        lastName: editingEmp.lastName,
        email: editingEmp.email,
        role_id: parseInt(editingEmp.roleId),
        tier: editingEmp.tier,
        department_id: parseInt(editingEmp.departmentId),
        password: editingEmp.password,
        status: editingEmp.status,
        base_salary: editingEmp.base_salary
      });
      if (success) {
        setIsEditDialogOpen(false);
        setEditingEmp(null);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployee = (id: number) => {
    setUserToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmHardDelete = async () => {
    if (!userToDelete) return;

    // Final Stage: Standard JS confirm for ultimate security
    const finalConfirm = window.confirm(
      "FINAL CONFIRMATION:\n\nAre you absolutely sure? This action cannot be undone and will permanently delete all history for this employee."
    );

    if (finalConfirm) {
      setIsDeleting(true);
      try {
        const success = await deleteEmployee(userToDelete);
        if (success) {
          setIsDeleteModalOpen(false);
          setUserToDelete(null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase()) ||
    e.role.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleStatus = (emp: any) => {
    const newStatus = emp.status === 'active' ? 'inactive' : 'active';
    updateEmployee({ ...emp, status: newStatus });
    toast.success(`Employee ${newStatus === 'active' ? 'activated' : 'deactivated'}.`);
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading employees...</div>;

  return (
    <div className={cls.page}>
      <Card>
        <CardHeader>
          <div className={cls.row}>
            <div>
              <CardTitle>Employee Directory</CardTitle>
              <CardDescription>Manage your team, roles, and access controls</CardDescription>
            </div>
            <div className="flex gap-2">
            {/* Same CSV component as the onboarding Employees step (plan 5.4) */}
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />Import CSV
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Import employees</DialogTitle>
                  <DialogDescription>Valid rows are saved; rows with problems are skipped and listed.</DialogDescription>
                </DialogHeader>
                {isImportOpen && (
                  <EmployeesStep
                    portals={portals}
                    departments={departments}
                    endpoint="/users/import"
                    onCreated={() => { setIsImportOpen(false); refresh(); }}
                  />
                )}
              </DialogContent>
            </Dialog>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />Add Employee
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add New Employee</DialogTitle>
                  <DialogDescription>
                    Enter employee details. Leave the password blank to generate a one-time temporary password; they'll choose their own at first sign-in.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddEmployee} className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={newEmp.firstName}
                        onChange={e => setNewEmp({ ...newEmp, firstName: e.target.value })}
                        placeholder="John"
                        autoComplete="off"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={newEmp.lastName}
                        onChange={e => setNewEmp({ ...newEmp, lastName: e.target.value })}
                        placeholder="Doe"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="baseSalary">Base Salary (₨) *</Label>
                    <Input
                      id="baseSalary"
                      type="number"
                      value={newEmp.baseSalary}
                      onChange={e => setNewEmp({ ...newEmp, baseSalary: e.target.value })}
                      placeholder="e.g. 50000"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={newEmp.email}
                      onChange={e => setNewEmp({ ...newEmp, email: e.target.value })}
                      placeholder="name@company.com"
                      autoComplete="off"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="role">Role *</Label>
                    <Select value={newEmp.roleId} onValueChange={v => setNewEmp({ ...newEmp, roleId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map(r => (
                          <SelectItem key={r.id} value={r.id.toString()}>{labelFor(r.name)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="tier">Tier</Label>
                    <TierSelect id="tier" portalKey={roleKey(newEmp.roleId)} value={newEmp.tier} onChange={tier => setNewEmp({ ...newEmp, tier })} />
                    <p className="text-xs text-muted-foreground">Member: own records · Manager: their team · Admin: whole organization</p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dept">Department *</Label>
                    <Select value={newEmp.departmentId} onValueChange={v => setNewEmp({ ...newEmp, departmentId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map(d => (
                          <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Temporary Password (optional)</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      value={newEmp.password}
                      onChange={e => setNewEmp({ ...newEmp, password: e.target.value })}
                      placeholder="Blank = generate one"
                    />
                  </div>
                  <DialogFooter className="mt-4">
                    <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Creating...' : 'Create Employee'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            </div>
            <Dialog open={!!issuedPassword} onOpenChange={(open) => { if (!open) setIssuedPassword(null); }}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Temporary password</DialogTitle>
                  <DialogDescription>
                    Shown only once. Share it privately with {issuedPassword?.email}; they'll choose their own password at first sign-in.
                  </DialogDescription>
                </DialogHeader>
                <div className="rounded-lg border bg-muted/50 p-4 font-mono text-lg text-center select-all">{issuedPassword?.password}</div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => navigator.clipboard.writeText(issuedPassword?.password ?? '').then(() => toast.success('Copied'))}
                  >
                    Copy
                  </Button>
                  <Button onClick={() => setIssuedPassword(null)}>Done</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Edit Employee</DialogTitle>
                  <DialogDescription>Update details for {editingEmp?.firstName} {editingEmp?.lastName}.</DialogDescription>
                </DialogHeader>
                {editingEmp && (
                  <form onSubmit={handleUpdateEmployee} className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="edit-firstName">First Name *</Label>
                        <Input
                          id="edit-firstName"
                          value={editingEmp.firstName}
                          onChange={e => setEditingEmp({ ...editingEmp, firstName: e.target.value })}
                          autoComplete="off"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="edit-lastName">Last Name *</Label>
                        <Input
                          id="edit-lastName"
                          value={editingEmp.lastName}
                          onChange={e => setEditingEmp({ ...editingEmp, lastName: e.target.value })}
                          autoComplete="off"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-email">Email</Label>
                      <Input
                        id="edit-email"
                        type="email"
                        value={editingEmp.email}
                        onChange={e => setEditingEmp({ ...editingEmp, email: e.target.value })}
                        autoComplete="off"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-salary">Base Salary (₨)</Label>
                      <Input
                        id="edit-salary"
                        type="number"
                        value={editingEmp.base_salary}
                        onChange={e => setEditingEmp({ ...editingEmp, base_salary: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-role">Role *</Label>
                      <Select value={editingEmp.roleId} onValueChange={v => setEditingEmp({ ...editingEmp, roleId: v, tier: '' })}>
                        <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                        <SelectContent>
                          {roles.map(r => <SelectItem key={r.id} value={r.id.toString()}>{labelFor(r.name)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-tier">Tier</Label>
                      <TierSelect id="edit-tier" portalKey={roleKey(editingEmp.roleId)} value={editingEmp.tier} onChange={tier => setEditingEmp({ ...editingEmp, tier })} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-dept">Department *</Label>
                      <Select value={editingEmp.departmentId} onValueChange={v => setEditingEmp({ ...editingEmp, departmentId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select a department" /></SelectTrigger>
                        <SelectContent>
                          {departments.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-password">Reset Password (optional)</Label>
                      <Input
                        id="edit-password"
                        name="password"
                        type="password"
                        value={editingEmp.password}
                        onChange={e => setEditingEmp({ ...editingEmp, password: e.target.value })}
                        placeholder="Temporary; they must change it at next sign-in"
                        autoComplete="new-password"
                      />
                    </div>
                    <DialogFooter className="mt-4">
                      <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </DialogFooter>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or role..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(emp => (
              <Card key={emp.id} className={`${cls.itemHover} transition-all border-l-4 ${emp.status === 'active' ? 'border-l-blue-500' : 'border-l-muted'}`}>
                <CardContent className="pt-6">
                  <div className={cls.row}>
                    <div className="flex-1">
                      <h4 className={cls.heading}>{emp.name}</h4>
                      <div className={`${cls.inline} ${cls.hint} text-xs mt-1`}>
                        <Mail className="h-3 w-3" />
                        <span>{emp.email}</span>
                      </div>
                    </div>
                    <Badge variant={emp.status === 'active' ? 'default' : 'secondary'}>
                      {emp.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className={cls.muted}>
                      <p className={cls.hintXs}>Role</p>
                      <div className={`${cls.inline} font-semibold text-xs mt-0.5`}>
                        <Shield className="h-3 w-3 text-blue-500" />
                        <span>{labelFor(emp.role)}{emp.tier ? ` · ${tierLabel(emp.role, emp.tier)}` : ''}</span>
                      </div>
                    </div>
                    <div className={cls.muted}>
                      <p className={cls.hintXs}>Dept</p>
                      <div className="font-semibold text-xs mt-0.5">{emp.department}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t">
                    <div>
                      <p className={cls.hintXs}>Base Salary</p>
                      <div className={`${cls.inline} font-bold text-sm text-green-600`}>
                        <Banknote className="h-3.5 w-3.5" />
                        <span>₨ {emp.base_salary?.toLocaleString('en-PK') ?? 0}</span>
                      </div>
                    </div>
                    <div>
                      <p className={cls.hintXs}>Status</p>
                      <div className={`${cls.inline} text-xs mt-1`}>
                        <Clock className="h-3 w-3" />
                        <span className="capitalize">{emp.status}</span>
                      </div>
                    </div>
                  </div>

                  <div className={`${cls.actions} mt-4 pt-2 border-t justify-end`}>
                    <Button variant="ghost" size="sm" className="text-xs h-8 text-blue-600" onClick={() => handleEditClick(emp)}>
                      <Pencil className="h-3 w-3 mr-1" />Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8 text-red-600"
                      onClick={() => handleDeleteEmployee(emp.id)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />Delete
                    </Button>
                    <Button
                      variant={emp.status === 'active' ? 'outline' : 'default'}
                      size="sm"
                      className="text-xs h-8 ml-2"
                      onClick={() => handleToggleStatus(emp)}
                    >
                      {emp.status === 'active' ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No employees found matching your search.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Premium Deletion Warning Modal */}
      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <ShieldAlert className="h-6 w-6" />
              <AlertDialogTitle className="text-xl">Critical Security Warning</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg">
                <p className="font-bold text-red-800 dark:text-red-400 mb-2">
                  This is a PERMANENT Hard-Delete / Purge action.
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-700 dark:text-red-300">
                  <li>ALL Attendance logs will be permanently erased.</li>
                  <li>ALL Payroll and Salary history will be wiped.</li>
                  <li>ALL Performance Reviews will be destroyed.</li>
                  <li>All Tasks and Client Strategies will be orphaned/removed.</li>
                </ul>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-lg">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-800 dark:text-blue-400 text-sm">Recommendation</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Use <span className="font-bold">Deactivate</span> if this employee is leaving the company but you want to keep their history for legal or reporting records.
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Use <span className="font-bold">Delete</span> <u>only</u> to remove duplicate or accidental entries.
                    </p>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmHardDelete();
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isDeleting}
            >
              {isDeleting ? 'Purging...' : 'Proceed to Purge'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
