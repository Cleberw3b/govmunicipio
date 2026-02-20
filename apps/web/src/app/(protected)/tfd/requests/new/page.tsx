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
  name: string;
  crm: string;
  specialties?: { id: string; name: string }[];
}

interface HospitalResult {
  id: string;
  name: string;
  cnes: string;
  city?: string;
  specialties?: { id: string; name: string }[];
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
  diagnosisCid: string;
  procedureDescription: string;
  justification: string;
  requestDate: string;
  travelDate: string;
  returnDate: string;
  transportType: TransportType | '';
  estimatedCost: string;
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
  diagnosisCid: '',
  procedureDescription: '',
  justification: '',
  requestDate: '',
  travelDate: '',
  returnDate: '',
  transportType: '',
  estimatedCost: '',
  notes: '',
};

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
          phone: phone || undefined,
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
              {new Date(
                selectedPerson.identification.dateOfBirth,
              ).toLocaleDateString('pt-BR')}
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
                  onChange={(e) => setCpf(e.target.value)}
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
                <Input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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

  useEffect(() => {
    apiClient<DoctorResult[]>('/doctors')
      .then(setDoctors)
      .catch(() => setDoctors([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = doctors.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.crm.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (selectedDoctor) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Médico selecionado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <strong>Nome:</strong> {selectedDoctor.name}
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
    <Card>
      <CardHeader>
        <CardTitle>Selecionar Médico Solicitante</CardTitle>
        <CardDescription>
          Busque pelo nome ou CRM do médico
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Buscar por nome ou CRM..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando médicos...
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Nenhum médico encontrado.
          </p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {filtered.map((doctor) => (
              <div
                key={doctor.id}
                className="flex cursor-pointer items-center justify-between rounded-md border p-3 hover:bg-accent"
                onClick={() => onSelect(doctor)}
              >
                <div>
                  <p className="font-medium">{doctor.name}</p>
                  <p className="text-sm text-muted-foreground">
                    CRM: {doctor.crm}
                    {doctor.specialties &&
                      doctor.specialties.length > 0 &&
                      ` • ${doctor.specialties.map((s) => s.name).join(', ')}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Step 3 - Hospital selection
// ---------------------------------------------------------------------------

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

  useEffect(() => {
    apiClient<HospitalResult[]>('/hospitals')
      .then(setHospitals)
      .catch(() => setHospitals([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = hospitals.filter(
    (h) =>
      h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.cnes.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (h.city && h.city.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  if (selectedHospital) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hospital selecionado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <strong>Nome:</strong> {selectedHospital.name}
          </p>
          <p>
            <strong>CNES:</strong> {selectedHospital.cnes}
          </p>
          {selectedHospital.city && (
            <p>
              <strong>Cidade:</strong> {selectedHospital.city}
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
          <p className="py-4 text-sm text-muted-foreground">
            Nenhum hospital encontrado.
          </p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {filtered.map((hospital) => (
              <div
                key={hospital.id}
                className="flex cursor-pointer items-center justify-between rounded-md border p-3 hover:bg-accent"
                onClick={() => onSelect(hospital)}
              >
                <div>
                  <p className="font-medium">{hospital.name}</p>
                  <p className="text-sm text-muted-foreground">
                    CNES: {hospital.cnes}
                    {hospital.city && ` • ${hospital.city}`}
                    {hospital.specialties &&
                      hospital.specialties.length > 0 &&
                      ` • ${hospital.specialties.map((s) => s.name).join(', ')}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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
          Preencha as informações clínicas da solicitação
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Código CID-10 *</Label>
            <Input
              placeholder="Ex: J45.0"
              value={formData.diagnosisCid}
              onChange={(e) => onChange({ diagnosisCid: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Data da Solicitação *</Label>
            <Input
              type="date"
              value={formData.requestDate}
              onChange={(e) => onChange({ requestDate: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Descrição do Procedimento *</Label>
          <textarea
            className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-20 w-full rounded-md border px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Descreva o procedimento..."
            value={formData.procedureDescription}
            onChange={(e) =>
              onChange({ procedureDescription: e.target.value })
            }
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Data da Viagem</Label>
            <Input
              type="date"
              value={formData.travelDate}
              onChange={(e) => onChange({ travelDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Data de Retorno</Label>
            <Input
              type="date"
              value={formData.returnDate}
              onChange={(e) => onChange({ returnDate: e.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
          <div className="space-y-2">
            <Label>Custo Estimado (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={formData.estimatedCost}
              onChange={(e) => onChange({ estimatedCost: e.target.value })}
            />
          </div>
        </div>

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
                <strong>Nome:</strong> {formData.doctorInfo.name}
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
                <strong>Nome:</strong> {formData.hospitalInfo.name}
              </p>
              <p>
                <strong>CNES:</strong> {formData.hospitalInfo.cnes}
              </p>
              {formData.hospitalInfo.city && (
                <p>
                  <strong>Cidade:</strong> {formData.hospitalInfo.city}
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
          <p>
            <strong>Data da Solicitação:</strong>{' '}
            {formData.requestDate
              ? new Date(formData.requestDate + 'T00:00:00').toLocaleDateString('pt-BR')
              : '-'}
          </p>
          {formData.travelDate && (
            <p>
              <strong>Data da Viagem:</strong>{' '}
              {new Date(formData.travelDate + 'T00:00:00').toLocaleDateString('pt-BR')}
            </p>
          )}
          {formData.returnDate && (
            <p>
              <strong>Data de Retorno:</strong>{' '}
              {new Date(formData.returnDate + 'T00:00:00').toLocaleDateString('pt-BR')}
            </p>
          )}
          <p>
            <strong>Transporte:</strong>{' '}
            {formData.transportType
              ? TRANSPORT_LABELS[formData.transportType as TransportType]
              : '-'}
          </p>
          {formData.estimatedCost && (
            <p>
              <strong>Custo Estimado:</strong> R${' '}
              {Number(formData.estimatedCost).toFixed(2)}
            </p>
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

export default function NewTfdRequestPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [submitting, setSubmitting] = useState(false);

  const updateFormData = useCallback((partial: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...partial }));
  }, []);

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0:
        return !!formData.patientPersonId;
      case 1:
        return true; // companion is optional
      case 2:
        return !!formData.requestingDoctorId;
      case 3:
        return !!formData.destinationHospitalId;
      case 4:
        return (
          !!formData.diagnosisCid &&
          !!formData.procedureDescription &&
          !!formData.justification &&
          !!formData.requestDate &&
          !!formData.transportType
        );
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleSkipCompanion = () => {
    updateFormData({
      companionPersonId: null,
      companionInfo: null,
    });
    setCurrentStep(2);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const dto: CreateTfdRequestDto = {
        patientPersonId: formData.patientPersonId,
        companionPersonId: formData.companionPersonId || undefined,
        requestingDoctorId: formData.requestingDoctorId,
        destinationHospitalId: formData.destinationHospitalId,
        diagnosisCid: formData.diagnosisCid,
        procedureDescription: formData.procedureDescription,
        justification: formData.justification,
        requestDate: formData.requestDate,
        travelDate: formData.travelDate || undefined,
        returnDate: formData.returnDate || undefined,
        transportType: formData.transportType as TransportType,
        estimatedCost: formData.estimatedCost
          ? Number(formData.estimatedCost)
          : undefined,
        notes: formData.notes || undefined,
      };

      await apiClient('/tfd/requests', {
        method: 'POST',
        body: JSON.stringify(dto),
      });

      toast.success('Solicitação TFD criada com sucesso!');
      router.push('/tfd/requests');
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Erro ao criar solicitação.',
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Nova Solicitação TFD</h1>

      <StepIndicator steps={STEPS} currentStep={currentStep} />

      {/* Step content */}
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

      {currentStep === 5 && <ReviewStep formData={formData} />}

      {/* Navigation */}
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
