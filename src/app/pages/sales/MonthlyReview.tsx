import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { DollarSign, Clock, Target, CalendarDays } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

export function MonthlyReview() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const currentYear = String(new Date().getFullYear());
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);

  useEffect(() => {
    fetchReview();
  }, [month, year]);

  const fetchReview = async () => {
    setLoading(true);
    const res = await apiFetch(`/sales/monthly-review?month=${month}&year=${year}`);
    if (res.success) {
      setData(res.data);
    }
    setLoading(false);
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading review...</div>;
  if (!data) return <div className="p-8 text-center text-destructive">Failed to load data.</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap gap-4 items-center justify-between bg-card p-4 rounded-xl border">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Monthly Performance Review
          </h2>
          <p className="text-sm text-muted-foreground">Select a month to view historical performance</p>
        </div>
        <div className="flex gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Month" /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => {
                const m = String(i + 1).padStart(2, '0');
                const name = new Date(2000, i, 1).toLocaleString('default', { month: 'long' });
                return <SelectItem key={m} value={m}>{name}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px]"><SelectValue placeholder="Year" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className=" border-success/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-success flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Achieved Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success ">${Number(data.totalAchieved).toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className=" border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Attendance %
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary ">{data.attendancePct}%</div>
          </CardContent>
        </Card>

        <Card className=" border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
              <Target className="h-4 w-4" />
              Performance %
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary ">{data.performancePct}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Client Services Sold</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.servicesSold?.length === 0 && (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No data found.</TableCell></TableRow>
                )}
                {data.servicesSold?.map((item: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{item.client_services}</TableCell>
                    <TableCell className="text-right">{item.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service Areas Sold</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Area</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.areasSold?.length === 0 && (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No data found.</TableCell></TableRow>
                )}
                {data.areasSold?.map((item: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{item.service_area}</TableCell>
                    <TableCell className="text-right">{item.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
