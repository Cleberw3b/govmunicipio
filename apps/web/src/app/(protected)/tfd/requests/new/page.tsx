'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  SkipForward,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  TransportType,
  Gender,
  ContactType,
  type CreateTfdRequestDto,
} from '@govmunicipio/shared';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

function maskBRL(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 13);
  if (!digits) return '';
  const padded = digits.padStart(3, '0');
  const intPart = padded.slice(0, -2).replace(/^0+/, '') || '0';
  const decPart = padded.slice(-2);
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${formatted},${decPart}`;
}

function parseBRL(masked: string): number | null {
  if (!masked) return null;
  const clean = masked.replace(/[R$\s.]/g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

function numToBRL(val: number | string | null | undefined): string {
  if (val == null || val === '') return '';
  const n = Number(val);
  if (isNaN(n)) return '';
  return maskBRL(Math.round(n * 100).toString());
}

function maskCpf(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function maskPhone(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 120 }, (_, i) => String(CURRENT_YEAR - i));
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PersonResult {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  identification?: {
    cpf: string;
    susCardNumber?: string | null;
    dateOfBirth: string;
  };
}

interface DoctorResult {
  id: string;
  crm: string;
  person?: {
    firstName: string;
    lastName: string;
    identification?: { cpf: string };
  };
  specialties?: { id: string; name: string }[];
}

function doctorDisplayName(d: DoctorResult): string {
  if (!d.person) return d.crm;
  return `${d.person.firstName} ${d.person.lastName}`;
}

interface HospitalResult {
  id: string;
  cnesCode: string;
  organization?: {
    name: string;
    address?: { city?: string };
  };
  specialties?: { id: string; name: string }[];
}

function hospitalDisplayName(h: HospitalResult): string {
  return h.organization?.name ?? h.cnesCode;
}

function hospitalCity(h: HospitalResult): string | undefined {
  return h.organization?.address?.city;
}

interface FormData {
  patientPersonId: string;
  patientInfo: PersonResult | null;
  companionPersonId: string | null;
  companionInfo: PersonResult | null;
  requestingDoctorId: string;
  doctorInfo: DoctorResult | null;
  destinationHospitalId: string;
  hospitalInfo: HospitalResult | null;
  specialtyId: string;
  diagnosisCid: string;
  procedureDescription: string;
  justification: string;
  requestDate: string;
  travelDate: string;
  returnDate: string;
  transportType: TransportType | '';
  departureType: 'patient' | 'address';
  departureCustomAddress: string;
  pickupAddressId: string;
  returnType: 'hospital' | 'address';
  returnPickupAddressId: string;
  estimatedCost: string;
  transportationCost: string;
  foodCost: string;
  hotelCost: string;
  notes: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = [
  'Paciente',
  'Acompanhante',
  'Médico Solicitante',
  'Hospital Destino',
  'Dados Clínicos',
  'Viagem',
  'Revisão',
];

const TRANSPORT_LABELS: Record<TransportType, string> = {
  [TransportType.BUS]: 'Ônibus',
  [TransportType.VAN]: 'Van',
  [TransportType.AMBULANCE]: 'Ambulância',
  [TransportType.AIR]: 'Aéreo',
  [TransportType.OWN_VEHICLE]: 'Veículo Próprio',
  [TransportType.OTHER]: 'Outro',
};

const GENDER_LABELS: Record<string, string> = {
  [Gender.MALE]: 'Masculino',
  [Gender.FEMALE]: 'Feminino',
  [Gender.OTHER]: 'Outro',
  [Gender.NOT_INFORMED]: 'Não Informado',
};

const INITIAL_FORM_DATA: FormData = {
  patientPersonId: '',
  patientInfo: null,
  companionPersonId: null,
  companionInfo: null,
  requestingDoctorId: '',
  doctorInfo: null,
  destinationHospitalId: '',
  hospitalInfo: null,
  specialtyId: '',
  diagnosisCid: '',
  procedureDescription: '',
  justification: '',
  requestDate: todayISO(),
  travelDate: todayISO(),
  returnDate: todayISO(),
  transportType: '',
  departureType: 'patient',
  departureCustomAddress: '',
  pickupAddressId: '',
  returnType: 'hospital',
  returnPickupAddressId: '',
  estimatedCost: '',
  transportationCost: '',
  foodCost: '',
  hotelCost: '',
  notes: '',
};

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Date select (day / month / year in pt-BR)
// ---------------------------------------------------------------------------

function DateSelect({
  value,
  onChange,
  future = false,
}: {
  value: string; // YYYY-MM-DD or ''
  onChange: (v: string) => void;
  future?: boolean;
}) {
  const fromValue = value ? value.split('-') : ['', '', ''];
  const [y, setY] = useState(fromValue[0]);
  const [m, setM] = useState(fromValue[1]);
  const [d, setD] = useState(fromValue[2]);

  useEffect(() => {
    const parts = value ? value.split('-') : ['', '', ''];
    setY(parts[0]);
    setM(parts[1]);
    setD(parts[2]);
  }, [value]);

  const emit = (newY: string, newM: string, newD: string) => {
    if (newY && newM && newD) onChange(`${newY}-${newM}-${newD}`);
    else onChange('');
  };

  const today = new Date();
  const todayY = String(today.getFullYear());
  const todayM = String(today.getMonth() + 1).padStart(2, '0');
  const todayD = String(today.getDate()).padStart(2, '0');

  const availableYears = future
    ? YEARS.filter((yr) => yr >= todayY)
    : YEARS;

  const availableMonths = MONTHS.map((name, i) => ({
    name,
    value: String(i + 1).padStart(2, '0'),
  })).filter(({ value: mv }) =>
    future && y === todayY ? mv >= todayM : true
  );

  const availableDays = DAYS.filter((day) =>
    future && y === todayY && m === todayM ? day >= todayD : true
  );

  return (
    <div className="flex gap-1">
      <Select value={d} onValueChange={(day) => { setD(day); emit(y, m, day); }}>
        <SelectTrigger className="w-[72px]">
          <SelectValue placeholder="Dia" />
        </SelectTrigger>
        <SelectContent>
          {availableDays.map((day) => (
            <SelectItem key={day} value={day}>{day}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={m} onValueChange={(month) => { setM(month); emit(y, month, d); }}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          {availableMonths.map(({ name, value: mv }) => (
            <SelectItem key={mv} value={mv}>{name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={y} onValueChange={(year) => { setY(year); emit(year, m, d); }}>
        <SelectTrigger className="w-[90px]">
          <SelectValue placeholder="Ano" />
        </SelectTrigger>
        <SelectContent>
          {availableYears.map((year) => (
            <SelectItem key={year} value={year}>{year}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({
  steps,
  currentStep,
}: {
  steps: string[];
  currentStep: number;
}) {
  return (
    <nav aria-label="Progresso" className="mb-8">
      <ol className="flex items-center gap-2">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;

          return (
            <li key={step} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  isCompleted
                    ? 'bg-primary text-primary-foreground'
                    : isActive
                      ? 'border-2 border-primary text-primary'
                      : 'border border-muted-foreground/30 text-muted-foreground'
                }`}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={`hidden text-sm lg:inline ${
                  isActive
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {step}
              </span>
              {index < steps.length - 1 && (
                <Separator className="mx-1 hidden w-6 lg:block" />
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-sm text-muted-foreground lg:hidden">
        Etapa {currentStep + 1} de {steps.length}: {steps[currentStep]}
      </p>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Person search + create sub-component
// ---------------------------------------------------------------------------

function PersonSearchStep({
  label,
  selectedPerson,
  onSelect,
}: {
  label: string;
  selectedPerson: PersonResult | null;
  onSelect: (person: PersonResult) => void;
}) {
  const [searchValue, setSearchValue] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [foundPerson, setFoundPerson] = useState<PersonResult | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // create form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<string>('');
  const [cpf, setCpf] = useState('');
  const [susCardNumber, setSusCardNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSearch = async () => {
    if (!searchValue.trim()) return;
    setSearching(true);
    setSearchDone(false);
    setFoundPerson(null);
    setShowCreateForm(false);

    try {
      const cleanValue = searchValue.replace(/\D/g, '');
      const param = cleanValue.length === 11 ? 'cpf' : 'sus';
      const data = await apiClient<PersonResult>(
        `/persons/search?${param}=${cleanValue}`,
      );
      setFoundPerson(data);
    } catch {
      setFoundPerson(null);
    } finally {
      setSearching(false);
      setSearchDone(true);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const person = await apiClient<PersonResult>('/persons', {
        method: 'POST',
        body: JSON.stringify({
          firstName,
          lastName,
          gender,
          cpf: cpf.replace(/\D/g, ''),
          susCardNumber: susCardNumber.replace(/\D/g, '') || undefined,
          dateOfBirth,
          contacts: phone
            ? [{ type: ContactType.PHONE, value: phone.replace(/\D/g, '') }]
            : undefined,
          address:
            street && addressNumber && neighborhood && city && addressState && zipCode
              ? {
                  street,
                  number: addressNumber,
                  complement: complement || undefined,
                  neighborhood,
                  city,
                  state: addressState,
                  zipCode: zipCode.replace(/\D/g, ''),
                }
              : undefined,
        }),
      });
      onSelect(person);
      toast.success(`${label} cadastrado(a) com sucesso!`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Erro ao cadastrar pessoa.',
      );
    } finally {
      setCreating(false);
    }
  };

  if (selectedPerson) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{label} selecionado(a)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <strong>Nome:</strong> {selectedPerson.firstName}{' '}
            {selectedPerson.lastName}
          </p>
          {selectedPerson.identification?.cpf && (
            <p>
              <strong>CPF:</strong> {selectedPerson.identification.cpf}
            </p>
          )}
          {selectedPerson.identification?.susCardNumber && (
            <p>
              <strong>Cartão SUS:</strong>{' '}
              {selectedPerson.identification.susCardNumber}
            </p>
          )}
          {selectedPerson.identification?.dateOfBirth && (
            <p>
              <strong>Data de Nascimento:</strong>{' '}
              {fmtDate(selectedPerson.identification.dateOfBirth)}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => onSelect(null as unknown as PersonResult)}
          >
            Alterar {label.toLowerCase()}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Buscar {label}</CardTitle>
          <CardDescription>
            Informe o CPF ou número do Cartão SUS
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="CPF ou Cartão SUS"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Buscar
            </Button>
          </div>

          {searching && (
            <p className="text-sm text-muted-foreground">Buscando...</p>
          )}

          {searchDone && foundPerson && (
            <div className="rounded-md border p-4 space-y-2">
              <p className="font-medium">
                {foundPerson.firstName} {foundPerson.lastName}
              </p>
              {foundPerson.identification?.cpf && (
                <p className="text-sm text-muted-foreground">
                  CPF: {foundPerson.identification.cpf}
                </p>
              )}
              {foundPerson.identification?.susCardNumber && (
                <p className="text-sm text-muted-foreground">
                  SUS: {foundPerson.identification.susCardNumber}
                </p>
              )}
              <Button size="sm" onClick={() => onSelect(foundPerson)}>
                Selecionar
              </Button>
            </div>
          )}

          {searchDone && !foundPerson && !showCreateForm && (
            <div className="rounded-md border border-dashed p-4 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Nenhuma pessoa encontrada.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCreateForm(true);
                  const cleanVal = searchValue.replace(/\D/g, '');
                  if (cleanVal.length === 11) {
                    setCpf(cleanVal);
                  } else if (cleanVal.length > 0) {
                    setSusCardNumber(cleanVal);
                  }
                }}
              >
                Cadastrar nova pessoa
              </Button>
            </div>
          )}

          {!showCreateForm && !(searchDone && !foundPerson) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateForm(true)}
            >
              + Cadastrar nova pessoa
            </Button>
          )}
        </CardContent>
      </Card>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Cadastrar {label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  placeholder="Nome"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Sobrenome</Label>
                <Input
                  placeholder="Sobrenome"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Sexo</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GENDER_LABELS).map(([value, lbl]) => (
                      <SelectItem key={value} value={value}>
                        {lbl}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(maskCpf(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Cartão SUS</Label>
                <Input
                  placeholder="Número do cartão SUS"
                  value={susCardNumber}
                  onChange={(e) => setSusCardNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Nascimento</Label>
                <div className="flex gap-1">
                  <Select
                    value={dateOfBirth ? dateOfBirth.split('-')[2] : ''}
                    onValueChange={(day) => {
                      const [y, m] = dateOfBirth ? dateOfBirth.split('-') : [String(CURRENT_YEAR), '01'];
                      setDateOfBirth(`${y || CURRENT_YEAR}-${m || '01'}-${day}`);
                    }}
                  >
                    <SelectTrigger className="w-[72px]">
                      <SelectValue placeholder="Dia" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={dateOfBirth ? dateOfBirth.split('-')[1] : ''}
                    onValueChange={(month) => {
                      const [y, , d] = dateOfBirth ? dateOfBirth.split('-') : [String(CURRENT_YEAR), '', '01'];
                      setDateOfBirth(`${y || CURRENT_YEAR}-${month}-${d || '01'}`);
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Mês" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((name, i) => (
                        <SelectItem key={i} value={String(i + 1).padStart(2, '0')}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={dateOfBirth ? dateOfBirth.split('-')[0] : ''}
                    onValueChange={(year) => {
                      const [, m, d] = dateOfBirth ? dateOfBirth.split('-') : ['', '01', '01'];
                      setDateOfBirth(`${year}-${m || '01'}-${d || '01'}`);
                    }}
                  >
                    <SelectTrigger className="w-[88px]">
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map((y) => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                />
              </div>
            </div>

            <p className="text-sm font-medium text-muted-foreground pt-2">Endereço <span className="font-normal">(opcional)</span></p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Rua / Logradouro</Label>
                <Input
                  placeholder="Nome da rua"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                <Input
                  placeholder="Nº"
                  value={addressNumber}
                  onChange={(e) => setAddressNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Complemento</Label>
                <Input
                  placeholder="Apto, bloco… (opcional)"
                  value={complement}
                  onChange={(e) => setComplement(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input
                  placeholder="Bairro"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input
                  placeholder="Cidade"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Estado (UF)</Label>
                <Input
                  placeholder="SP"
                  maxLength={2}
                  value={addressState}
                  onChange={(e) => setAddressState(e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input
                  placeholder="00000-000"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                />
              </div>
            </div>

            <Button
              onClick={handleCreate}
              disabled={
                creating || !firstName || !lastName || !gender || !cpf || !dateOfBirth
              }
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Cadastrar
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Step 2 - Doctor selection
// ---------------------------------------------------------------------------

const GENDER_LABELS_DOCTOR: Record<string, string> = {
  male: 'Masculino',
  female: 'Feminino',
  other: 'Outro',
  not_informed: 'Não informado',
};

function DoctorStep({
  selectedDoctor,
  onSelect,
}: {
  selectedDoctor: DoctorResult | null;
  onSelect: (doctor: DoctorResult) => void;
}) {
  const [doctors, setDoctors] = useState<DoctorResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // create form state
  const [crm, setCrm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [cpf, setCpf] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    apiClient<DoctorResult[]>('/doctors')
      .then(setDoctors)
      .catch(() => setDoctors([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = doctors.filter((d) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      d.crm.toLowerCase().includes(term) ||
      (d.person?.firstName ?? '').toLowerCase().includes(term) ||
      (d.person?.lastName ?? '').toLowerCase().includes(term)
    );
  });

  const handleCreate = async () => {
    setCreating(true);
    try {
      const doctor = await apiClient<DoctorResult>('/doctors', {
        method: 'POST',
        body: JSON.stringify({
          crm: crm.trim(),
          firstName,
          lastName,
          gender,
          cpf: cpf.replace(/\D/g, ''),
          dateOfBirth,
        }),
      });
      setDoctors((prev) => [...prev, doctor]);
      onSelect(doctor);
      toast.success('Médico cadastrado com sucesso!');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Erro ao cadastrar médico.',
      );
    } finally {
      setCreating(false);
    }
  };

  if (selectedDoctor) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Médico selecionado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <strong>Nome:</strong> {doctorDisplayName(selectedDoctor)}
          </p>
          <p>
            <strong>CRM:</strong> {selectedDoctor.crm}
          </p>
          {selectedDoctor.specialties && selectedDoctor.specialties.length > 0 && (
            <p>
              <strong>Especialidades:</strong>{' '}
              {selectedDoctor.specialties.map((s) => s.name).join(', ')}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => onSelect(null as unknown as DoctorResult)}
          >
            Alterar médico
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Selecionar Médico Solicitante</CardTitle>
          <CardDescription>Busque pelo CRM ou nome do médico</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Buscar por CRM ou nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando médicos...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Nenhum médico encontrado.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCreateForm(true);
                  setCrm(searchTerm.trim());
                }}
              >
                Cadastrar médico
              </Button>
            </div>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {filtered.map((d) => (
                <div
                  key={d.id}
                  className="flex cursor-pointer items-center justify-between rounded-md border p-3 hover:bg-accent"
                  onClick={() => onSelect(d)}
                >
                  <div>
                    <p className="font-medium">{doctorDisplayName(d)}</p>
                    <p className="text-sm text-muted-foreground">
                      CRM: {d.crm}
                      {d.specialties && d.specialties.length > 0 &&
                        ` • ${d.specialties.map((s) => s.name).join(', ')}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCreateForm((v) => !v);
                setCrm(searchTerm.trim());
              }}
            >
              + Cadastrar novo médico
            </Button>
          )}
        </CardContent>
      </Card>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Cadastrar Médico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>CRM</Label>
                <Input
                  placeholder="Ex: 12345-BA"
                  value={crm}
                  onChange={(e) => setCrm(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  placeholder="Nome"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Sobrenome</Label>
                <Input
                  placeholder="Sobrenome"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Sexo</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GENDER_LABELS_DOCTOR).map(([value, lbl]) => (
                      <SelectItem key={value} value={value}>{lbl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(maskCpf(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Nascimento</Label>
                <div className="flex gap-1">
                  <Select
                    value={dateOfBirth ? dateOfBirth.split('-')[2] : ''}
                    onValueChange={(day) => {
                      const [y, m] = dateOfBirth ? dateOfBirth.split('-') : [String(CURRENT_YEAR), '01'];
                      setDateOfBirth(`${y || CURRENT_YEAR}-${m || '01'}-${day}`);
                    }}
                  >
                    <SelectTrigger className="w-[72px]">
                      <SelectValue placeholder="Dia" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select
                    value={dateOfBirth ? dateOfBirth.split('-')[1] : ''}
                    onValueChange={(month) => {
                      const [y, , d] = dateOfBirth ? dateOfBirth.split('-') : [String(CURRENT_YEAR), '', '01'];
                      setDateOfBirth(`${y || CURRENT_YEAR}-${month}-${d || '01'}`);
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Mês" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((name, i) => (
                        <SelectItem key={i} value={String(i + 1).padStart(2, '0')}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={dateOfBirth ? dateOfBirth.split('-')[0] : ''}
                    onValueChange={(year) => {
                      const [, m, d] = dateOfBirth ? dateOfBirth.split('-') : ['', '01', '01'];
                      setDateOfBirth(`${year}-${m || '01'}-${d || '01'}`);
                    }}
                  >
                    <SelectTrigger className="w-[88px]">
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <Button
              onClick={handleCreate}
              disabled={creating || !crm || !firstName || !lastName || !gender || !cpf || !dateOfBirth}
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Cadastrar
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Step 3 - Hospital selection
// ---------------------------------------------------------------------------

function maskCnpj(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function HospitalStep({
  selectedHospital,
  onSelect,
}: {
  selectedHospital: HospitalResult | null;
  onSelect: (hospital: HospitalResult) => void;
}) {
  const [hospitals, setHospitals] = useState<HospitalResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // create form state
  const [hospName, setHospName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [cnesCode, setCnesCode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [street, setStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    apiClient<HospitalResult[]>('/hospitals')
      .then(setHospitals)
      .catch(() => setHospitals([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = hospitals.filter(
    (h) =>
      hospitalDisplayName(h).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (h.cnesCode ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (hospitalCity(h) ?? '').toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleCreate = async () => {
    setCreating(true);
    try {
      const hospital = await apiClient<HospitalResult>('/municipality/hospitals', {
        method: 'POST',
        body: JSON.stringify({
          name: hospName.trim(),
          cnpj: cnpj.replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5'),
          cnesCode: cnesCode.trim(),
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          street: street.trim() || undefined,
          number: addressNumber.trim() || undefined,
          neighborhood: neighborhood.trim() || undefined,
          zipCode: zipCode.replace(/\D/g, '') || undefined,
        }),
      });
      setHospitals((prev) => [...prev, hospital]);
      onSelect(hospital);
      toast.success('Hospital cadastrado com sucesso!');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Erro ao cadastrar hospital.',
      );
    } finally {
      setCreating(false);
    }
  };

  if (selectedHospital) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hospital selecionado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <strong>Nome:</strong> {hospitalDisplayName(selectedHospital)}
          </p>
          <p>
            <strong>CNES:</strong> {selectedHospital.cnesCode}
          </p>
          {hospitalCity(selectedHospital) && (
            <p>
              <strong>Cidade:</strong> {hospitalCity(selectedHospital)}
            </p>
          )}
          {selectedHospital.specialties &&
            selectedHospital.specialties.length > 0 && (
              <p>
                <strong>Especialidades:</strong>{' '}
                {selectedHospital.specialties.map((s) => s.name).join(', ')}
              </p>
            )}
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => onSelect(null as unknown as HospitalResult)}
          >
            Alterar hospital
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Selecionar Hospital Destino</CardTitle>
          <CardDescription>
            Busque pelo nome, CNES ou cidade do hospital
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Buscar por nome, CNES ou cidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando hospitais...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Nenhum hospital encontrado.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCreateForm(true);
                  setCnesCode(searchTerm.trim());
                }}
              >
                Cadastrar hospital
              </Button>
            </div>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {filtered.map((hospital) => (
                <div
                  key={hospital.id}
                  className="flex cursor-pointer items-center justify-between rounded-md border p-3 hover:bg-accent"
                  onClick={() => onSelect(hospital)}
                >
                  <div>
                    <p className="font-medium">{hospitalDisplayName(hospital)}</p>
                    <p className="text-sm text-muted-foreground">
                      CNES: {hospital.cnesCode}
                      {hospitalCity(hospital) && ` • ${hospitalCity(hospital)}`}
                      {hospital.specialties &&
                        hospital.specialties.length > 0 &&
                        ` • ${hospital.specialties.map((s) => s.name).join(', ')}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCreateForm((v) => !v);
                setCnesCode(searchTerm.trim());
              }}
            >
              + Cadastrar novo hospital
            </Button>
          )}
        </CardContent>
      </Card>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Cadastrar Hospital</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Nome do Hospital *</Label>
                <Input
                  placeholder="Nome completo"
                  value={hospName}
                  onChange={(e) => setHospName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>CNPJ *</Label>
                <Input
                  placeholder="00.000.000/0000-00"
                  value={cnpj}
                  onChange={(e) => setCnpj(maskCnpj(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Código CNES *</Label>
                <Input
                  placeholder="Ex: 2345678"
                  value={cnesCode}
                  onChange={(e) => setCnesCode(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input
                  placeholder="Cidade"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Estado (UF)</Label>
                <Input
                  placeholder="SP"
                  maxLength={2}
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label>Rua / Logradouro</Label>
                <Input
                  placeholder="Nome da rua"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                <Input
                  placeholder="Nº"
                  value={addressNumber}
                  onChange={(e) => setAddressNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input
                  placeholder="Bairro"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input
                  placeholder="00000-000"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                />
              </div>
            </div>
            <Button
              onClick={handleCreate}
              disabled={creating || !hospName.trim() || cnpj.replace(/\D/g, '').length < 14 || !cnesCode.trim()}
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Cadastrar
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Step 4 - Clinical data
// ---------------------------------------------------------------------------

function ClinicalDataStep({
  formData,
  onChange,
}: {
  formData: FormData;
  onChange: (partial: Partial<FormData>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados Clínicos</CardTitle>
        <CardDescription>
          Diagnóstico, procedimento e justificativa médica
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {formData.hospitalInfo?.specialties && formData.hospitalInfo.specialties.length > 0 && (
          <div className="space-y-2">
            <Label>Especialidade</Label>
            <Select
              value={formData.specialtyId}
              onValueChange={(v) => onChange({ specialtyId: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a especialidade" />
              </SelectTrigger>
              <SelectContent>
                {formData.hospitalInfo.specialties.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Código CID-10 *</Label>
          <Input
            placeholder="Ex: J45.0"
            value={formData.diagnosisCid}
            onChange={(e) => onChange({ diagnosisCid: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Descrição do Procedimento *</Label>
          <textarea
            className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-20 w-full rounded-md border px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Descreva o procedimento..."
            value={formData.procedureDescription}
            onChange={(e) => onChange({ procedureDescription: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Justificativa *</Label>
          <textarea
            className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-20 w-full rounded-md border px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Justifique a necessidade de TFD..."
            value={formData.justification}
            onChange={(e) => onChange({ justification: e.target.value })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 5 - Travel & costs
// ---------------------------------------------------------------------------

const TRANSPORT_NEEDS_ADDRESS: (TransportType | string)[] = [
  TransportType.BUS,
  TransportType.VAN,
  TransportType.AMBULANCE,
];

interface PickupAddress {
  id: string;
  name: string;
  street: string;
  number: string;
  city: string;
  state: string;
}

function TravelCostsStep({
  formData,
  onChange,
}: {
  formData: FormData;
  onChange: (partial: Partial<FormData>) => void;
}) {
  const [addresses, setAddresses] = useState<PickupAddress[]>([]);
  const showAddressPicker = TRANSPORT_NEEDS_ADDRESS.includes(formData.transportType);

  useEffect(() => {
    apiClient<PickupAddress[]>('/municipality/pickup-addresses')
      .then(setAddresses)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Viagem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Transporte *</Label>
            <Select
              value={formData.transportType}
              onValueChange={(value) =>
                onChange({ transportType: value as TransportType })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o transporte" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TRANSPORT_LABELS).map(([value, lbl]) => (
                  <SelectItem key={value} value={value}>
                    {lbl}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Data da Viagem</Label>
              <DateSelect
                value={formData.travelDate}
                onChange={(v) => onChange({ travelDate: v })}
                future
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Retorno</Label>
              <DateSelect
                value={formData.returnDate}
                onChange={(v) => onChange({ returnDate: v })}
                future
              />
            </div>
          </div>

          {showAddressPicker && (
            <div className="space-y-3 rounded-md border p-4">
              <Label className="text-sm font-semibold">Embarque (Ida)</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={formData.departureType === 'patient' ? 'default' : 'outline'}
                  onClick={() => onChange({ departureType: 'patient', departureCustomAddress: '', pickupAddressId: '' })}
                >
                  Endereço do Paciente
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={formData.departureType === 'address' ? 'default' : 'outline'}
                  onClick={() => onChange({ departureType: 'address', departureCustomAddress: '' })}
                >
                  Ponto de Embarque
                </Button>
              </div>
              {formData.departureType === 'patient' ? (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Endereço do paciente (opcional)</Label>
                  <Input
                    placeholder="Ex: Rua das Flores, 123, Centro"
                    value={formData.departureCustomAddress}
                    onChange={(e) => onChange({ departureCustomAddress: e.target.value })}
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  {addresses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum ponto cadastrado.{' '}
                      <a href="/dashboard/addresses" target="_blank" className="underline">
                        Cadastrar ponto
                      </a>
                    </p>
                  ) : (
                    <Select
                      value={formData.pickupAddressId}
                      onValueChange={(v) => onChange({ pickupAddressId: v })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o ponto de embarque" />
                      </SelectTrigger>
                      <SelectContent>
                        {addresses.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} — {a.street}, {a.number}, {a.city}/{a.state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3 rounded-md border p-4">
            <Label className="text-sm font-semibold">Embarque (Retorno)</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={formData.returnType === 'hospital' ? 'default' : 'outline'}
                onClick={() => onChange({ returnType: 'hospital', returnPickupAddressId: '' })}
              >
                Hospital de Destino
              </Button>
              <Button
                type="button"
                size="sm"
                variant={formData.returnType === 'address' ? 'default' : 'outline'}
                onClick={() => onChange({ returnType: 'address' })}
              >
                Ponto de Embarque
              </Button>
            </div>
            {formData.returnType === 'address' && (
              <div className="space-y-1">
                {addresses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum ponto cadastrado.{' '}
                    <a href="/dashboard/addresses" target="_blank" className="underline">
                      Cadastrar ponto
                    </a>
                  </p>
                ) : (
                  <Select
                    value={formData.returnPickupAddressId}
                    onValueChange={(v) => onChange({ returnPickupAddressId: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o ponto de retorno" />
                    </SelectTrigger>
                    <SelectContent>
                      {addresses.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} — {a.street}, {a.number}, {a.city}/{a.state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custos</CardTitle>
          <CardDescription>
            Transporte, alimentação e hospedagem cobertos pelo município
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Transporte</Label>
              <Input
                placeholder="R$ 0,00"
                value={formData.transportationCost}
                onChange={(e) => onChange({ transportationCost: maskBRL(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Alimentação</Label>
              <Input
                placeholder="R$ 0,00"
                value={formData.foodCost}
                onChange={(e) => onChange({ foodCost: maskBRL(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Hospedagem</Label>
              <Input
                placeholder="R$ 0,00"
                value={formData.hotelCost}
                onChange={(e) => onChange({ hotelCost: maskBRL(e.target.value) })}
              />
            </div>
          </div>
          {(formData.transportationCost || formData.foodCost || formData.hotelCost) && (
            <p className="text-sm font-medium text-right">
              Total: {maskBRL(
                Math.round(
                  ((parseBRL(formData.transportationCost) ?? 0) +
                    (parseBRL(formData.foodCost) ?? 0) +
                    (parseBRL(formData.hotelCost) ?? 0)) * 100
                ).toString()
              )}
            </p>
          )}

          <div className="space-y-2">
            <Label>Observações</Label>
            <textarea
              className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-20 w-full rounded-md border px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Observações adicionais..."
              value={formData.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5 - Review
// ---------------------------------------------------------------------------

function ReviewStep({ formData }: { formData: FormData }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Paciente</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          {formData.patientInfo ? (
            <>
              <p>
                <strong>Nome:</strong> {formData.patientInfo.firstName}{' '}
                {formData.patientInfo.lastName}
              </p>
              {formData.patientInfo.identification?.cpf && (
                <p>
                  <strong>CPF:</strong>{' '}
                  {formData.patientInfo.identification.cpf}
                </p>
              )}
              {formData.patientInfo.identification?.susCardNumber && (
                <p>
                  <strong>Cartão SUS:</strong>{' '}
                  {formData.patientInfo.identification.susCardNumber}
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Nenhum paciente selecionado</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Acompanhante</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          {formData.companionInfo ? (
            <p>
              <strong>Nome:</strong> {formData.companionInfo.firstName}{' '}
              {formData.companionInfo.lastName}
            </p>
          ) : (
            <p className="text-muted-foreground">Sem acompanhante</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Médico Solicitante</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          {formData.doctorInfo ? (
            <>
              <p>
                <strong>Nome:</strong> {doctorDisplayName(formData.doctorInfo)}
              </p>
              <p>
                <strong>CRM:</strong> {formData.doctorInfo.crm}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">Nenhum médico selecionado</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hospital Destino</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          {formData.hospitalInfo ? (
            <>
              <p>
                <strong>Nome:</strong> {hospitalDisplayName(formData.hospitalInfo)}
              </p>
              <p>
                <strong>CNES:</strong> {formData.hospitalInfo.cnesCode}
              </p>
              {hospitalCity(formData.hospitalInfo) && (
                <p>
                  <strong>Cidade:</strong> {hospitalCity(formData.hospitalInfo)}
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Nenhum hospital selecionado</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados Clínicos</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>
            <strong>CID-10:</strong> {formData.diagnosisCid || '-'}
          </p>
          <p>
            <strong>Procedimento:</strong>{' '}
            {formData.procedureDescription || '-'}
          </p>
          <p>
            <strong>Justificativa:</strong> {formData.justification || '-'}
          </p>
          {formData.travelDate && (
            <p>
              <strong>Data da Viagem:</strong>{' '}
              {fmtDate(formData.travelDate)}
            </p>
          )}
          {formData.returnDate && (
            <p>
              <strong>Data de Retorno:</strong>{' '}
              {fmtDate(formData.returnDate)}
            </p>
          )}
          <p>
            <strong>Transporte:</strong>{' '}
            {formData.transportType
              ? TRANSPORT_LABELS[formData.transportType as TransportType]
              : '-'}
          </p>
          {formData.departureCustomAddress && (
            <p>
              <strong>Embarque (Ida):</strong> {formData.departureCustomAddress}
            </p>
          )}
          {(formData.transportationCost || formData.foodCost || formData.hotelCost) && (
            <>
              <p className="mt-1 font-medium">Custos:</p>
              {formData.transportationCost && (
                <p className="ml-2">Transporte: {formData.transportationCost}</p>
              )}
              {formData.foodCost && (
                <p className="ml-2">Alimentação: {formData.foodCost}</p>
              )}
              {formData.hotelCost && (
                <p className="ml-2">Hospedagem: {formData.hotelCost}</p>
              )}
            </>
          )}
          {formData.notes && (
            <p>
              <strong>Observações:</strong> {formData.notes}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

const DRAFT_KEY = 'tfd_draft_id';

interface TfdDraftResponse {
  id: string;
  patientPerson?: PersonResult;
  companionPerson?: PersonResult | null;
  requestingDoctor?: DoctorResult | null;
  destinationHospital?: HospitalResult | null;
  diagnosisCid?: string | null;
  procedureDescription?: string | null;
  justification?: string | null;
  requestDate?: string | null;
  travelDate?: string | null;
  returnDate?: string | null;
  transportType?: string | null;
  departureCustomAddress?: string | null;
  pickupAddress?: { id: string } | null;
  returnPickupAddress?: { id: string } | null;
  estimatedCost?: number | string | null;
  transportationCost?: number | string | null;
  foodCost?: number | string | null;
  hotelCost?: number | string | null;
  notes?: string | null;
  specialty?: { id: string; name: string } | null;
}

function getResumeStep(draft: TfdDraftResponse): number {
  if (!draft.requestingDoctor?.id) return 2;
  if (!draft.destinationHospital?.id) return 3;
  if (!draft.diagnosisCid || !draft.procedureDescription || !draft.justification) return 4;
  if (!draft.requestDate || !draft.transportType) return 5;
  return 6;
}

function toDateStr(val: string | null | undefined): string {
  if (!val) return '';
  return val.split('T')[0];
}

export default function NewTfdRequestPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(true);

  const updateFormData = useCallback((partial: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...partial }));
  }, []);

  // On mount: check localStorage for a saved draft
  useEffect(() => {
    const savedId = localStorage.getItem(DRAFT_KEY);
    if (!savedId) {
      setLoadingDraft(false);
      return;
    }
    apiClient<TfdDraftResponse>(`/tfd/requests/${savedId}`)
      .then((draft) => {
        setDraftId(savedId);
        setFormData((prev) => ({
          ...prev,
          patientPersonId: draft.patientPerson?.id ?? '',
          patientInfo: draft.patientPerson ?? null,
          companionPersonId: draft.companionPerson?.id ?? null,
          companionInfo: draft.companionPerson ?? null,
          requestingDoctorId: draft.requestingDoctor?.id ?? '',
          doctorInfo: draft.requestingDoctor ?? null,
          destinationHospitalId: draft.destinationHospital?.id ?? '',
          hospitalInfo: draft.destinationHospital ?? null,
          specialtyId: draft.specialty?.id ?? '',
          diagnosisCid: draft.diagnosisCid ?? '',
          procedureDescription: draft.procedureDescription ?? '',
          justification: draft.justification ?? '',
          requestDate: toDateStr(draft.requestDate) || todayISO(),
          travelDate: toDateStr(draft.travelDate) || todayISO(),
          returnDate: toDateStr(draft.returnDate) || todayISO(),
          transportType: (draft.transportType as TransportType | '') ?? '',
          departureCustomAddress: draft.departureCustomAddress ?? '',
          departureType: draft.departureCustomAddress ? 'patient' : (draft.pickupAddress?.id ? 'address' : 'patient'),
          pickupAddressId: draft.pickupAddress?.id ?? '',
          returnPickupAddressId: draft.returnPickupAddress?.id ?? '',
          returnType: draft.returnPickupAddress?.id ? 'address' : 'hospital',
          estimatedCost: numToBRL(draft.estimatedCost),
          transportationCost: numToBRL(draft.transportationCost),
          foodCost: numToBRL(draft.foodCost),
          hotelCost: numToBRL(draft.hotelCost),
          notes: draft.notes ?? '',
        }));
        setCurrentStep(getResumeStep(draft));
      })
      .catch(() => {
        localStorage.removeItem(DRAFT_KEY);
      })
      .finally(() => setLoadingDraft(false));
  }, []);

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0:
        return !!formData.patientPersonId;
      case 1:
        return true;
      case 2:
        return !!formData.requestingDoctorId;
      case 3:
        return !!formData.destinationHospitalId;
      case 4:
        return (
          !!formData.diagnosisCid &&
          !!formData.procedureDescription &&
          !!formData.justification
        );
      case 5:
        return !!formData.requestDate && !!formData.transportType;
      case 6:
        return true;
      default:
        return false;
    }
  };

  const getPatchDataForStep = (step: number): Record<string, unknown> => {
    switch (step) {
      case 1:
        return { companionPersonId: formData.companionPersonId ?? null };
      case 2:
        return { requestingDoctorId: formData.requestingDoctorId };
      case 3:
        return { destinationHospitalId: formData.destinationHospitalId };
      case 4:
        return {
          specialtyId: formData.specialtyId || null,
          diagnosisCid: formData.diagnosisCid,
          procedureDescription: formData.procedureDescription,
          justification: formData.justification,
        };
      case 5:
        return {
          requestDate: formData.requestDate,
          travelDate: formData.travelDate || null,
          returnDate: formData.returnDate || null,
          transportType: formData.transportType || undefined,
          departureCustomAddress: formData.departureType === 'patient'
            ? formData.departureCustomAddress || null
            : null,
          pickupAddressId: TRANSPORT_NEEDS_ADDRESS.includes(formData.transportType) && formData.departureType === 'address'
            ? formData.pickupAddressId || null
            : null,
          returnPickupAddressId: formData.returnType === 'address'
            ? formData.returnPickupAddressId || null
            : null,
          transportationCost: parseBRL(formData.transportationCost),
          foodCost: parseBRL(formData.foodCost),
          hotelCost: parseBRL(formData.hotelCost),
          notes: formData.notes || null,
        };
      default:
        return {};
    }
  };

  const handleNext = async () => {
    if (!canProceed()) return;
    try {
      if (currentStep === 0 && !draftId) {
        const draft = await apiClient<TfdDraftResponse>('/tfd/requests', {
          method: 'POST',
          body: JSON.stringify({ patientPersonId: formData.patientPersonId }),
        });
        setDraftId(draft.id);
        localStorage.setItem(DRAFT_KEY, draft.id);
      } else if (draftId && currentStep > 0) {
        await apiClient(`/tfd/requests/${draftId}`, {
          method: 'PATCH',
          body: JSON.stringify(getPatchDataForStep(currentStep)),
        });
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Erro ao salvar rascunho.',
      );
      return;
    }
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleSkipCompanion = async () => {
    updateFormData({ companionPersonId: null, companionInfo: null });
    if (draftId) {
      try {
        await apiClient(`/tfd/requests/${draftId}`, {
          method: 'PATCH',
          body: JSON.stringify({ companionPersonId: null }),
        });
      } catch {
        // non-fatal
      }
    }
    setCurrentStep(2);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let id = draftId;
      if (!id) {
        // No draft yet (edge case: user completed all steps without Next)
        const draft = await apiClient<TfdDraftResponse>('/tfd/requests', {
          method: 'POST',
          body: JSON.stringify({ patientPersonId: formData.patientPersonId }),
        });
        id = draft.id;
        localStorage.setItem(DRAFT_KEY, id);
        setDraftId(id);
        await apiClient(`/tfd/requests/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            companionPersonId: formData.companionPersonId ?? null,
            requestingDoctorId: formData.requestingDoctorId,
            destinationHospitalId: formData.destinationHospitalId,
            diagnosisCid: formData.diagnosisCid,
            procedureDescription: formData.procedureDescription,
            justification: formData.justification,
            requestDate: formData.requestDate,
            travelDate: formData.travelDate || null,
            returnDate: formData.returnDate || null,
            transportType: formData.transportType || undefined,
            departureCustomAddress: formData.departureType === 'patient'
              ? formData.departureCustomAddress || null
              : null,
            pickupAddressId: TRANSPORT_NEEDS_ADDRESS.includes(formData.transportType) && formData.departureType === 'address'
              ? formData.pickupAddressId || null
              : null,
            returnPickupAddressId: formData.returnType === 'address'
              ? formData.returnPickupAddressId || null
              : null,
            estimatedCost: formData.estimatedCost
              ? Number(formData.estimatedCost)
              : null,
            transportationCost: formData.transportationCost
              ? Number(formData.transportationCost)
              : null,
            foodCost: formData.foodCost ? Number(formData.foodCost) : null,
            hotelCost: formData.hotelCost ? Number(formData.hotelCost) : null,
            notes: formData.notes || null,
          }),
        });
      }
      await apiClient(`/tfd/requests/${id}/submit`, { method: 'POST' });
      localStorage.removeItem(DRAFT_KEY);
      toast.success('Solicitação TFD criada com sucesso!');
      router.push('/tfd/requests');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Erro ao criar solicitação.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handlePatientSelect = (person: PersonResult | null) => {
    if (person) {
      updateFormData({ patientPersonId: person.id, patientInfo: person });
    } else {
      updateFormData({ patientPersonId: '', patientInfo: null });
    }
  };

  const handleCompanionSelect = (person: PersonResult | null) => {
    if (person) {
      updateFormData({ companionPersonId: person.id, companionInfo: person });
    } else {
      updateFormData({ companionPersonId: null, companionInfo: null });
    }
  };

  const handleDoctorSelect = (doctor: DoctorResult | null) => {
    if (doctor) {
      updateFormData({ requestingDoctorId: doctor.id, doctorInfo: doctor });
    } else {
      updateFormData({ requestingDoctorId: '', doctorInfo: null });
    }
  };

  const handleHospitalSelect = (hospital: HospitalResult | null) => {
    if (hospital) {
      updateFormData({
        destinationHospitalId: hospital.id,
        hospitalInfo: hospital,
      });
    } else {
      updateFormData({ destinationHospitalId: '', hospitalInfo: null });
    }
  };

  if (loadingDraft) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Carregando rascunho...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nova Solicitação TFD</h1>
        {draftId && (
          <span className="text-xs text-muted-foreground">
            Rascunho salvo automaticamente
          </span>
        )}
      </div>

      <StepIndicator steps={STEPS} currentStep={currentStep} />

      {currentStep === 0 && (
        <PersonSearchStep
          label="Paciente"
          selectedPerson={formData.patientInfo}
          onSelect={handlePatientSelect}
        />
      )}

      {currentStep === 1 && (
        <PersonSearchStep
          label="Acompanhante"
          selectedPerson={formData.companionInfo}
          onSelect={handleCompanionSelect}
        />
      )}

      {currentStep === 2 && (
        <DoctorStep
          selectedDoctor={formData.doctorInfo}
          onSelect={handleDoctorSelect}
        />
      )}

      {currentStep === 3 && (
        <HospitalStep
          selectedHospital={formData.hospitalInfo}
          onSelect={handleHospitalSelect}
        />
      )}

      {currentStep === 4 && (
        <ClinicalDataStep formData={formData} onChange={updateFormData} />
      )}

      {currentStep === 5 && (
        <TravelCostsStep formData={formData} onChange={updateFormData} />
      )}

      {currentStep === 6 && <ReviewStep formData={formData} />}

      <Separator />
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 0}
        >
          <ChevronLeft />
          Anterior
        </Button>

        <div className="flex gap-2">
          {currentStep === 1 && (
            <Button variant="ghost" onClick={handleSkipCompanion}>
              <SkipForward />
              Pular
            </Button>
          )}

          {currentStep < STEPS.length - 1 && (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Próximo
              <ChevronRight />
            </Button>
          )}

          {currentStep === STEPS.length - 1 && (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send />
              )}
              Enviar Solicitação
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
