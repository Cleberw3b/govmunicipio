import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TfdRequestEntity } from '../entities';

const RETRY_DELAY_MS = 2000;
const MAX_RETRIES = 1;

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly instance: string;
  private readonly isConfigured: boolean;

  constructor(private readonly config: ConfigService) {
    this.apiUrl = config.get('WHATSAPP_API_URL', '');
    this.apiKey = config.get('WHATSAPP_API_KEY', '');
    this.instance = config.get('WHATSAPP_INSTANCE', 'default');

    this.isConfigured = !!(this.apiUrl && this.apiKey);
    if (!this.isConfigured) {
      this.logger.warn(
        'WhatsApp service not fully configured. Set WHATSAPP_API_URL and WHATSAPP_API_KEY to enable notifications.',
      );
    }
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
      tfd.destinationHospital?.organization?.addressLinks?.[0]?.address?.city ?? null;

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
    const patientPhone = tfd.patientPerson?.contactLinks?.find(
      (cl) => cl.contact?.type === 'phone',
    )?.contact?.value;

    if (!patientPhone) {
      this.logger.debug(
        `No phone contact found for TFD ${tfd.protocolNumber}. Skipping notification.`,
      );
      return;
    }

    if (!this.isConfigured) {
      this.logger.debug(
        `WhatsApp not configured. Skipping notification for TFD ${tfd.protocolNumber}.`,
      );
      return;
    }

    const phone = this.normalizePhone(patientPhone);
    const text = this.buildMessage(tfd);

    await this.sendWithRetry(tfd.protocolNumber, phone, text);
  }

  private async sendWithRetry(
    protocolNumber: string,
    phone: string,
    text: string,
    attempt: number = 1,
  ): Promise<void> {
    const timestamp = new Date().toISOString();

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
        const responseBody = await response.text();
        const logContext = {
          protocol: protocolNumber,
          phone,
          statusCode: response.status,
          attempt,
          timestamp,
        };

        if (attempt < MAX_RETRIES + 1) {
          this.logger.warn(
            `WhatsApp notification failed (attempt ${attempt}/${MAX_RETRIES + 1}): ` +
              `protocol=${protocolNumber}, phone=${phone}, status=${response.status}. ` +
              `Response: ${responseBody.substring(0, 200)}`,
            logContext,
          );

          await this.delay(RETRY_DELAY_MS);
          await this.sendWithRetry(protocolNumber, phone, text, attempt + 1);
        } else {
          this.logger.error(
            `WhatsApp notification failed after ${MAX_RETRIES + 1} attempts: ` +
              `protocol=${protocolNumber}, phone=${phone}, status=${response.status}. ` +
              `Response: ${responseBody.substring(0, 200)}`,
            logContext,
          );
        }
      } else {
        this.logger.log(
          `WhatsApp notification sent: protocol=${protocolNumber}, phone=${phone}, timestamp=${timestamp}`,
          { protocol: protocolNumber, phone, timestamp },
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const logContext = {
        protocol: protocolNumber,
        phone,
        error: errorMessage,
        attempt,
        timestamp,
      };

      if (attempt < MAX_RETRIES + 1) {
        this.logger.warn(
          `WhatsApp send error (attempt ${attempt}/${MAX_RETRIES + 1}): ` +
            `protocol=${protocolNumber}, phone=${phone}, error=${errorMessage}`,
          logContext,
        );

        await this.delay(RETRY_DELAY_MS);
        await this.sendWithRetry(protocolNumber, phone, text, attempt + 1);
      } else {
        this.logger.error(
          `WhatsApp send error after ${MAX_RETRIES + 1} attempts: ` +
            `protocol=${protocolNumber}, phone=${phone}, error=${errorMessage}`,
          logContext,
        );
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
