import type { FieldDefinition } from '../../types/crm';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cls } from '../../styles/classes';

export type CustomFieldValues = Record<string, string | number | boolean>;

const NONE = '__none__';

/**
 * "Additional fields" section of the client forms (plan 6.1), generated from the
 * organization's field definitions in display order. Values are keyed by field name.
 */
export function CustomFieldInputs({ definitions, values, onChange, idPrefix = 'cf' }: {
  definitions: FieldDefinition[];
  values: CustomFieldValues;
  onChange: (values: CustomFieldValues) => void;
  idPrefix?: string;
}) {
  if (!definitions.length) return null;
  const set = (name: string, value: string | boolean) => {
    const next = { ...values };
    if (value === '' || value === false) delete next[name];
    else next[name] = value;
    onChange(next);
  };

  return (
    <section className={cls.section}>
      <h3 className="font-semibold text-lg border-b pb-2">Additional fields</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {definitions.map((def) => {
          const id = `${idPrefix}-${def.id}`;
          const value = values[def.field_name];
          if (def.field_type === 'checkbox') {
            return (
              <div key={def.id} className="flex items-center gap-2 pt-6">
                <Checkbox id={id} checked={value === true} onCheckedChange={(v) => set(def.field_name, v === true)} />
                <Label htmlFor={id}>{def.field_name}</Label>
              </div>
            );
          }
          return (
            <div key={def.id} className={cls.field}>
              <Label htmlFor={id}>{def.field_name}</Label>
              {def.field_type === 'dropdown' ? (
                <Select value={value != null ? String(value) : NONE} onValueChange={(v) => set(def.field_name, v === NONE ? '' : v)}>
                  <SelectTrigger id={id}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {(def.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={id}
                  type={def.field_type === 'number' ? 'number' : def.field_type === 'date' ? 'date' : 'text'}
                  maxLength={def.field_type === 'text' ? 1000 : undefined}
                  value={value != null ? String(value) : ''}
                  onChange={(e) => set(def.field_name, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
