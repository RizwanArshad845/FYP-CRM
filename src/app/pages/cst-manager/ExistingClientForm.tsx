import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Checkbox } from '../../components/ui/checkbox';
import { toast } from 'sonner';
import { Send, X, UserPlus } from 'lucide-react';
import { cls } from '../../styles/classes';
import { useClients } from '../../context/ClientContext';
import { CustomFieldInputs, type CustomFieldValues } from '../../components/shared/CustomFieldInputs';
import { useClientInbox } from '../../context/ClientInboxContext';
import { apiFetch } from '../../utils/api';
import { PRODUCTS } from '../../constants/crm';

type FormData = {
  companyName: string; customerName: string; paymentAmount: string; productsSold: string[]; otherProduct: string;
  email: string; email2: string; serviceArea: string; contactNo1: string; contactNo2: string; gbpLink: string;
  websiteLink: string; yelpLink: string; facebook: string; twitter: string;
  linkedin: string; instagram: string; clientConcerns: string; tipsForTech: string; notes: string;
  clientServices: string; cin: string; paymentGateway: string;
};

const EMPTY_FORM: FormData = {
  companyName: '', customerName: '', paymentAmount: '', productsSold: [], otherProduct: '',
  email: '', email2: '', serviceArea: '', contactNo1: '', contactNo2: '', gbpLink: '',
  websiteLink: '', yelpLink: '', facebook: '', twitter: '',
  linkedin: '', instagram: '', clientConcerns: '', tipsForTech: '', notes: '',
  clientServices: '', cin: '', paymentGateway: '',
};

const TEXT_AREAS: { id: keyof FormData; label: string; placeholder: string }[] = [
  { id: 'clientConcerns', label: 'Client Concerns', placeholder: 'Any specific concerns or requirements...' },
  { id: 'tipsForTech', label: 'Tips for CST Team', placeholder: 'Important information for the CST team...' },
  { id: 'notes', label: 'General Notes', placeholder: 'Any additional notes...' },
];

function Field({ id, label, type = 'text', required = false, placeholder = '', value, onChange }: {
  id: string; label: string; type?: string; required?: boolean; placeholder?: string;
  value: string; onChange: (val: string) => void;
}) {
  return (
    <div className={cls.field}>
      <Label htmlFor={id}>{label}{required && ' *'}</Label>
      <Input id={id} type={type} required={required} placeholder={placeholder}
        value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

export function ExistingClientForm() {
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { fetchData: fetchClients, fieldDefinitions } = useClients();
  const [customFields, setCustomFields] = useState<CustomFieldValues>({});
  const { fetchData: fetchInbox } = useClientInbox();
  const [states, setStates] = useState<string[]>([]);
  const [showStates, setShowStates] = useState(false);

  useEffect(() => {
    fetch('https://countriesnow.space/api/v0.1/countries/states', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country: 'United States' })
    })
      .then(r => r.json())
      .then(res => {
        if (res.data && res.data.states) {
          setStates(res.data.states.map((s: any) => s.name));
        }
      })
      .catch(err => console.error('Failed to fetch states', err));
  }, []);

  const set = (field: keyof FormData, value: string) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName || !formData.customerName || (formData.productsSold.length === 0 && !formData.otherProduct.trim())) {
      toast.error('Please fill required fields (Company, Customer, Product)');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/clients', {
        method: 'POST',
        body: JSON.stringify({
          companyName: formData.companyName,
          customerName: formData.customerName,
          email: formData.email,
          email_2: formData.email2 || null,
          paymentAmount: parseFloat(formData.paymentAmount),
          productSold: [...formData.productsSold, formData.otherProduct.trim()].filter(Boolean).join(', '),
          serviceArea: formData.serviceArea,
          contactNo1: formData.contactNo1,
          contactNo2: formData.contactNo2,
          clientConcerns: formData.clientConcerns,
          tipsForTech: formData.tipsForTech,
          notes: formData.notes,
          clientServices: formData.clientServices,
          digitalPresence: formData.websiteLink || formData.gbpLink || formData.yelpLink || formData.facebook || formData.twitter || formData.linkedin || formData.instagram,
          cin: formData.cin,
          paymentGateway: formData.paymentGateway,
          customFields,
        })
      });

      if (res.success) {
        toast.success('Existing client added successfully!');
        setFormData(EMPTY_FORM);
      setCustomFields({});
        fetchClients();
        fetchInbox();
      } else {
        toast.error(res.error || 'Failed to add client');
      }
    } catch (error: any) {
      toast.error(error.message || 'Connection error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    if (confirm('Clear the form?')) {
      setFormData(EMPTY_FORM);
      setCustomFields({});
      toast.info('Form cleared');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto py-4">
      <Card className="shadow-lg border-primary/30 ">
        <CardHeader className="bg-primary-soft/50 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-soft rounded-lg">
                <UserPlus className="h-6 w-6 text-primary" />
            </div>
            <div>
                <CardTitle>Add Existing Client</CardTitle>
                <CardDescription>Enter details for a client who is already with us. Status will be set to 'existing'.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          {/* Client Information */}
          <section className="space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-wider text-primary flex items-center gap-2">
              <div className="h-4 w-1 rounded-full bg-primary" />
              Client Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field id="companyName" label="Company Name" required placeholder="ABC Corporation" value={formData.companyName} onChange={v => set('companyName', v)} />
              <Field id="customerName" label="Customer Name" required placeholder="John Doe" value={formData.customerName} onChange={v => set('customerName', v)} />
              <Field id="paymentAmount" label="Payment Amount ($)" type="number" required placeholder="5000" value={formData.paymentAmount} onChange={v => set('paymentAmount', v)} />
              <Field id="email" label="Email 1" type="email" required placeholder="contact@company.com" value={formData.email} onChange={v => set('email', v)} />
              <Field id="email2" label="Email 2" type="email" placeholder="secondary@company.com" value={formData.email2} onChange={v => set('email2', v)} />
              
              <div className="space-y-2 relative">
                <Label htmlFor="serviceArea">Service Area (USA State) *</Label>
                <Input
                  id="serviceArea"
                  placeholder="Search state..."
                  value={formData.serviceArea}
                  onChange={e => {
                    set('serviceArea', e.target.value);
                    setShowStates(true);
                  }}
                  onFocus={() => setShowStates(true)}
                  onBlur={() => setTimeout(() => setShowStates(false), 200)}
                />
                {showStates && (
                  <div className="absolute z-50 w-full mt-1 max-h-60 overflow-auto bg-white border rounded-md shadow-xl ">
                    {states
                      .filter(s => s.toLowerCase().includes(formData.serviceArea.toLowerCase()))
                      .map(s => (
                        <div
                          key={s}
                          className="px-4 py-2 cursor-pointer hover:bg-primary-soft text-sm"
                          onMouseDown={() => {
                            set('serviceArea', s);
                            setShowStates(false);
                          }}
                        >
                          {s}
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <Field id="clientServices" label="Client Services" placeholder="Handyman, General Contractor..." value={formData.clientServices} onChange={v => set('clientServices', v)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Products / Categories *</Label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-muted/30 rounded-lg border">
                  {PRODUCTS.map(p => (
                    <div key={p} className="flex items-center space-x-2">
                      <Checkbox
                        id={`product-${p}`}
                        checked={formData.productsSold.includes(p)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData(prev => ({ ...prev, productsSold: [...prev.productsSold, p] }));
                          } else {
                            setFormData(prev => ({ ...prev, productsSold: prev.productsSold.filter(item => item !== p) }));
                          }
                        }}
                      />
                      <label htmlFor={`product-${p}`} className="text-xs font-medium leading-none">{p}</label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="otherProduct">Other / Additional Demand</Label>
                    <Input id="otherProduct" placeholder="Enter any other product..." value={formData.otherProduct} onChange={e => set('otherProduct', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="paymentGateway">Payment Gateway</Label>
                    <Select value={formData.paymentGateway} onValueChange={v => set('paymentGateway', v)}>
                        <SelectTrigger id="paymentGateway"><SelectValue placeholder="Select gateway" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Zelle">Zelle</SelectItem>
                            <SelectItem value="Cash App">Cash App</SelectItem>
                            <SelectItem value="Stripe">Stripe</SelectItem>
                            <SelectItem value="Square">Square</SelectItem>
                            <SelectItem value="Card Charge">Card Charge</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">Which payment provider was used for this transaction?</p>
                </div>
              </div>
            </div>
            <div className="mt-4">
                <Field id="cin" label="CIN (Client ID/Number)" placeholder="e.g. 12345678" value={formData.cin} onChange={v => set('cin', v)} />
            </div>
          </section>

          {/* Contact & Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t">
            <section className="space-y-4">
                <h3 className="font-bold text-sm uppercase tracking-wider text-primary flex items-center gap-2">
                    <div className="h-4 w-1 rounded-full bg-primary" />
                    Contact Details
                </h3>
                <div className="space-y-4">
                    <Field id="contactNo1" label="Contact No. 1 (Primary)" type="tel" required placeholder="+1 (555) 123-4567" value={formData.contactNo1} onChange={v => set('contactNo1', v)} />
                    <Field id="contactNo2" label="Contact No. 2 (Secondary)" type="tel" placeholder="+1 (555) 987-6543" value={formData.contactNo2} onChange={v => set('contactNo2', v)} />
                </div>
            </section>

            <section className="space-y-4">
                <h3 className="font-bold text-sm uppercase tracking-wider text-primary flex items-center gap-2">
                    <div className="h-4 w-1 rounded-full bg-primary" />
                    Digital Presence
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field id="websiteLink" label="Website" type="url" placeholder="https://www.company.com" value={formData.websiteLink} onChange={v => set('websiteLink', v)} />
                    <Field id="gbpLink" label="Google Business Profile" type="url" placeholder="https://g.page/..." value={formData.gbpLink} onChange={v => set('gbpLink', v)} />
                    <Field id="yelpLink" label="Yelp" type="url" placeholder="https://www.yelp.com/..." value={formData.yelpLink} onChange={v => set('yelpLink', v)} />
                    <Field id="facebook" label="Facebook" type="url" placeholder="https://facebook.com/..." value={formData.facebook} onChange={v => set('facebook', v)} />
                    <Field id="twitter" label="Twitter/X" type="url" placeholder="https://twitter.com/..." value={formData.twitter} onChange={v => set('twitter', v)} />
                    <Field id="linkedin" label="LinkedIn" type="url" placeholder="https://linkedin.com/..." value={formData.linkedin} onChange={v => set('linkedin', v)} />
                    <Field id="instagram" label="Instagram" type="url" placeholder="https://instagram.com/..." value={formData.instagram} onChange={v => set('instagram', v)} />
                </div>
            </section>
          </div>

          {/* Additional Info */}
          <section className="space-y-4 pt-4 border-t">
            <h3 className="font-bold text-sm uppercase tracking-wider text-primary flex items-center gap-2">
              <div className="h-4 w-1 rounded-full bg-primary" />
              Additional Information
            </h3>
            <div className="grid grid-cols-1 gap-4">
                {TEXT_AREAS.map(({ id, label, placeholder }) => (
                <div key={id} className="space-y-2">
                    <Label htmlFor={id}>{label}</Label>
                    <Textarea id={id} rows={3} placeholder={placeholder} value={formData[id]} onChange={e => set(id, e.target.value)} className="text-sm" />
                </div>
                ))}
            </div>
          </section>

          <CustomFieldInputs definitions={fieldDefinitions} values={customFields} onChange={setCustomFields} />

          {/* Actions */}
          <div className="flex gap-4 pt-6 border-t">
            <Button type="button" variant="outline" onClick={handleClear} className="flex-1" disabled={isSubmitting}>
              <X className="h-4 w-4 mr-2" />Clear Form
            </Button>
            <Button type="submit" className="flex-1 bg-primary hover:bg-primary text-white" disabled={isSubmitting}>
              <Send className="h-4 w-4 mr-2" />{isSubmitting ? 'Adding Client...' : 'Add Existing Client'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
