import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TfdRequestEntity } from '../entities';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly instance: string;

  constructor(private readonly config: ConfigService) {
    this.apiUrl = config.get('WHATSAPP_API_URL', '');
    this.apiKey = config.get('WHATSAPP_API_KEY', '');
    this.instance = config.get('WHATSAPP_INSTANCE', 'default');
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return digits.startsWith('55') ? digits : `55${digits}`;
  }

  private formatDateBR(date: Date | string | null | undefined): string {
    if (!date) return '-';
    const str = typeof date === 'string' ? date : date.toISOString();
    const [y, m, d] = str.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  }

  buildMessage(tfd: TfdRequestEntity): string {
    const patientName = tfd.patientPerson
      ? `${tfd.patientPerson.firstName} ${tfd.patientPerson.lastName}`
      : '-';

    const hospital =
      tfd.destinationHospital?.organization?.name ??
      tfd.destinationHospital?.cnesCode ??
      '-';

    const hospitalCity =
      tfd.destinationHospital?.organization?.address?.city ?? null;

    const hospitalFull = hospitalCity ? `${hospital} — ${hospitalCity}` : hospital;

    const departureAddress = tfd.departureCustomAddress
      ? tfd.departureCustomAddress
      : tfd.pickupAddress
        ? `${tfd.pickupAddress.name} — ${tfd.pickupAddress.street}, ${tfd.pickupAddress.number}, ${tfd.pickupAddress.city}/${tfd.pickupAddress.state}`
        : null;

    const returnAddress = tfd.returnPickupAddress
      ? `${tfd.returnPickupAddress.name} — ${tfd.returnPickupAddress.street}, ${tfd.returnPickupAddress.number}, ${tfd.returnPickupAddress.city}/${tfd.returnPickupAddress.state}`
      : hospitalFull;

    const lines: string[] = [
      `🏥 *Solicitação TFD Registrada*`,
      ``,
      `*Protocolo:* ${tfd.protocolNumber}`,
      `*Paciente:* ${patientName}`,
      `*Hospital de Destino:* ${hospitalFull}`,
    ];

    if (tfd.specialty) {
      lines.push(`*Especialidade:* ${tfd.specialty.name}`);
    }

    lines.push(``);
    lines.push(`📍 *Viagem de Ida*`);
    lines.push(`📅 Data: ${this.formatDateBR(tfd.travelDate)}`);
    if (departureAddress) {
      lines.push(`🚌 Embarque: ${departureAddress}`);
    }

    lines.push(``);
    lines.push(`📍 *Retorno*`);
    lines.push(`📅 Data: ${this.formatDateBR(tfd.returnDate)}`);
    lines.push(`🚌 Embarque: ${returnAddress}`);

    lines.push(``);
    lines.push(`Em caso de dúvidas, entre em contato com a prefeitura.`);

    return lines.join('\n');
  }

  async sendTfdNotification(tfd: TfdRequestEntity): Promise<void> {
    if (!this.apiUrl || !this.apiKey || !tfd.contactPhone) return;

    const phone = this.normalizePhone(tfd.contactPhone);
    const text = this.buildMessage(tfd);

    try {
      const response = await fetch(
        `${this.apiUrl}/message/sendText/${this.instance}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: this.apiKey,
          },
          body: JSON.stringify({ number: phone, text }),
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `WhatsApp notification failed for ${phone}: ${response.status}`,
        );
      } else {
        this.logger.log(`WhatsApp sent to ${phone} for TFD ${tfd.protocolNumber}`);
      }
    } catch (err) {
      this.logger.error(`WhatsApp send error: ${err}`);
    }
  }
}
