import type { ClientField } from '../../types/crm';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cls } from '../../styles/classes';
import { cn } from '../ui/utils';
import {
  fieldsBySection, joinMulti, splitMulti, visibleFields, type ClientFormValues,
} from '../../utils/clientFields';

const NONE = '__none__';

const INPUT_TYPE: Partial<Record<ClientField['type'], string>> = {
  email: 'email', phone: 'tel', number: 'number', date: 'date',
};

function FieldInput({ field, id, value, onChange }: {
  field: ClientField; id: string; value: string | boolean; onChange: (value: string | boolean) => void;
}) {
  const text = typeof value === 'string' ? value : '';
  const options = field.options ?? [];

  if (field.type === 'textarea') {
    return <Textarea id={id} rows={3} maxLength={5000} value={text} onChange={(e) => onChange(e.target.value)} />;
  }
  if (field.type === 'dropdown') {
    return (
      <Select value={text || NONE} onValueChange={(v) => onChange(v === NONE ? '' : v)}>
        <SelectTrigger id={id}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>None</SelectItem>
          {/* a stored value that is no longer an option still shows */}
          {text && !options.includes(text) && <SelectItem value={text}>{text}</SelectItem>}
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  if (field.type === 'multiselect') {
    const { chosen, other } = splitMulti(text, options);
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {options.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={chosen.includes(o)}
                onCheckedChange={(on) => onChange(joinMulti(on ? [...chosen, o] : chosen.filter((c) => c !== o), other))}
              />
              {o}
            </label>
          ))}
        </div>
        <Input id={id} placeholder="Other" aria-label={`${field.label}: other`} value={other} onChange={(e) => onChange(joinMulti(chosen, e.target.value))} />
      </div>
    );
  }
  return (
    <>
      <Input
        id={id}
        type={INPUT_TYPE[field.type] ?? 'text'}
        maxLength={field.type === 'number' ? undefined : 1000}
        list={options.length ? `${id}-options` : undefined}
        value={text}
        onChange={(e) => onChange(e.target.value)}
      />
      {/* text fields with options suggest them but still take any value */}
      {options.length > 0 && <datalist id={`${id}-options`}>{options.map((o) => <option key={o} value={o} />)}</datalist>}
    </>
  );
}

/**
 * The client form generated from the organization's client layout (plan 6.1):
 * its sections, labels, order and required marks. Switched-off fields are left out.
 */
export function ClientFieldsForm({ fields, values, onChange, idPrefix = 'client' }: {
  fields: ClientField[];
  values: ClientFormValues;
  onChange: (values: ClientFormValues) => void;
  idPrefix?: string;
}) {
  const set = (key: string, value: string | boolean) => onChange({ ...values, [key]: value });

  return (
    <>
      {fieldsBySection(visibleFields(fields)).map(({ section, title, fields: list }) => (
        <section key={section} className={cls.section}>
          <h3 className="flex items-center gap-2 border-b pb-2 text-lg font-semibold">
            <span className="h-4 w-1 rounded-full bg-primary" />
            {title}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {list.map((f) => {
              const id = `${idPrefix}-${f.key}`;
              const value = values[f.key] ?? (f.type === 'checkbox' ? false : '');
              if (f.type === 'checkbox') {
                return (
                  <div key={f.key} className="flex items-center gap-2 pt-6">
                    <Checkbox id={id} checked={value === true} onCheckedChange={(v) => set(f.key, v === true)} />
                    <Label htmlFor={id}>{f.label}{f.required && ' *'}</Label>
                  </div>
                );
              }
              return (
                <div key={f.key} className={cn(cls.field, (f.type === 'textarea' || f.type === 'multiselect') && 'md:col-span-2')}>
                  <Label htmlFor={id}>{f.label}{f.required && ' *'}</Label>
                  <FieldInput field={f} id={id} value={value} onChange={(v) => set(f.key, v)} />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
