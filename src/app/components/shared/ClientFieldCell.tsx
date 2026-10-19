import type { ClientField } from '../../types/crm';
import { TableCell } from '../ui/table';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import { formatValue, visibleFields } from '../../utils/clientFields';

/** Table columns for the client layout: switched-on fields, long text left to the detail view. */
export const tableFields = (fields: ClientField[]) => visibleFields(fields).filter((f) => f.type !== 'textarea');

/** One client value in a table, styled by what the field is. */
export function ClientFieldCell({ field, client, className }: { field: ClientField; client: Record<string, any>; className?: string }) {
  const text = formatValue(field, client);
  if (field.key === 'company_name') {
    return (
      <TableCell className={cn(className, 'font-bold text-foreground sticky left-0 bg-inherit shadow-[1px_0_0_0_rgba(0,0,0,0.1)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.1)]')}>
        {text}
      </TableCell>
    );
  }
  if (field.key === 'payment_amount') return <TableCell className={cn(className, 'font-bold text-success')}>{text}</TableCell>;
  if (field.type === 'dropdown' && text !== '—') {
    return <TableCell className={className}><Badge variant="outline">{text}</Badge></TableCell>;
  }
  return <TableCell className={cn(className, 'max-w-[220px] truncate')} title={text}>{text}</TableCell>;
}
