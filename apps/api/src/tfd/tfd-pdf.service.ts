import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { TfdRequestEntity } from '../entities';

// Type alias for PDFKit document instance
type PDFDoc = InstanceType<typeof PDFDocument>;

interface ITextOptions {
  fontSize?: number;
  bold?: boolean;
  underline?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

@Injectable()
export class TfdPdfService {
  private static readonly PAGE_WIDTH = 595;
  private static readonly PAGE_HEIGHT = 842;
  private static readonly MARGIN = 40;
  private static readonly CONTENT_WIDTH =
    TfdPdfService.PAGE_WIDTH - 2 * TfdPdfService.MARGIN;

  generatePdf(tfdRequest: TfdRequestEntity): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({
          size: 'A4',
          margin: TfdPdfService.MARGIN,
        });

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          resolve(pdfBuffer);
        });
        doc.on('error', reject);

        this.renderHeader(doc, tfdRequest);
        this.renderPatientData(doc, tfdRequest);
        this.renderCompanionData(doc, tfdRequest);
        this.renderMedicalData(doc, tfdRequest);
        this.renderDestinationHospital(doc, tfdRequest);
        this.renderTransportAndHotel(doc, tfdRequest);
        this.renderCosts(doc, tfdRequest);
        this.renderStatus(doc, tfdRequest);
        this.renderFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private renderHeader(doc: PDFDoc, tfdRequest: TfdRequestEntity): void {
    this.addText(doc, 'Relatório TFD', {
      fontSize: 20,
      bold: true,
      align: 'center',
    });

    this.addText(
      doc,
      `Protocolo: ${tfdRequest.protocolNumber}`,
      {
        fontSize: 12,
        align: 'center',
      },
      6,
    );

    const municipalityName = tfdRequest.municipality?.organization?.name || 'N/A';
    this.addText(doc, `Município: ${municipalityName}`, {
      fontSize: 11,
      align: 'center',
    });

    this.addHorizontalRule(doc, 2);
  }

  private renderPatientData(doc: PDFDoc, tfdRequest: TfdRequestEntity): void {
    this.addSectionHeader(doc, 'Dados do Paciente');

    const patient = tfdRequest.patientPerson;
    if (patient) {
      const fullName = `${patient.firstName} ${patient.lastName}`;
      this.addKeyValue(doc, 'Nome:', fullName);

      if (patient.identification) {
        const cpf = patient.identification.cpf;
        const formattedCpf = this.formatCpf(cpf);
        this.addKeyValue(doc, 'CPF:', formattedCpf);

        if (patient.identification.susCardNumber) {
          this.addKeyValue(doc, 'Cartão SUS:', patient.identification.susCardNumber);
        }

        const dateOfBirth = this.formatDate(patient.identification.dateOfBirth);
        this.addKeyValue(doc, 'Data de Nascimento:', dateOfBirth);
      }

      this.addKeyValue(doc, 'Gênero:', this.formatGender(patient.gender));
    }

    this.addVerticalSpacing(doc, 4);
  }

  private renderCompanionData(doc: PDFDoc, tfdRequest: TfdRequestEntity): void {
    if (!tfdRequest.companionPerson) {
      return;
    }

    this.addSectionHeader(doc, 'Acompanhante');

    const companion = tfdRequest.companionPerson;
    const fullName = `${companion.firstName} ${companion.lastName}`;
    this.addKeyValue(doc, 'Nome:', fullName);

    if (companion.identification) {
      const cpf = companion.identification.cpf;
      const formattedCpf = this.formatCpf(cpf);
      this.addKeyValue(doc, 'CPF:', formattedCpf);
    }

    this.addVerticalSpacing(doc, 4);
  }

  private renderMedicalData(doc: PDFDoc, tfdRequest: TfdRequestEntity): void {
    this.addSectionHeader(doc, 'Dados Médicos');

    if (tfdRequest.requestingDoctor) {
      const doctorName = tfdRequest.requestingDoctor.person
        ? `${tfdRequest.requestingDoctor.person.firstName} ${tfdRequest.requestingDoctor.person.lastName}`
        : 'N/A';
      this.addKeyValue(doc, 'Médico Solicitante:', doctorName);

      if (tfdRequest.requestingDoctor.crm) {
        this.addKeyValue(doc, 'CRM:', tfdRequest.requestingDoctor.crm);
      }
    }

    if (tfdRequest.diagnosisCid) {
      this.addKeyValue(doc, 'Diagnóstico (CID):', tfdRequest.diagnosisCid);
    }

    if (tfdRequest.procedureDescription) {
      this.addKeyValue(doc, 'Descrição do Procedimento:', tfdRequest.procedureDescription);
    }

    if (tfdRequest.specialty) {
      this.addKeyValue(doc, 'Especialidade:', tfdRequest.specialty.name || 'N/A');
    }

    if (tfdRequest.justification) {
      this.addKeyValue(doc, 'Justificativa:', tfdRequest.justification);
    }

    this.addVerticalSpacing(doc, 4);
  }

  private renderDestinationHospital(
    doc: PDFDoc,
    tfdRequest: TfdRequestEntity,
  ): void {
    this.addSectionHeader(doc, 'Hospital de Destino');

    if (tfdRequest.destinationHospital) {
      const hospitalName = tfdRequest.destinationHospital.organization?.name || 'N/A';
      this.addKeyValue(doc, 'Hospital:', hospitalName);

      if (tfdRequest.destinationHospital.cnesCode) {
        this.addKeyValue(doc, 'Código CNES:', tfdRequest.destinationHospital.cnesCode);
      }
    } else {
      this.addKeyValue(doc, 'Hospital:', 'N/A');
    }

    this.addVerticalSpacing(doc, 4);
  }

  private renderTransportAndHotel(
    doc: PDFDoc,
    tfdRequest: TfdRequestEntity,
  ): void {
    this.addSectionHeader(doc, 'Transporte e Hospedagem');

    if (tfdRequest.transportType) {
      this.addKeyValue(doc, 'Tipo de Transporte:', tfdRequest.transportType);
    }

    if (tfdRequest.travelDate) {
      const formattedDate = this.formatDate(tfdRequest.travelDate);
      this.addKeyValue(doc, 'Data de Viagem:', formattedDate);
    }

    if (tfdRequest.returnDate) {
      const formattedDate = this.formatDate(tfdRequest.returnDate);
      this.addKeyValue(doc, 'Data de Retorno:', formattedDate);
    }

    if (tfdRequest.pickupAddress) {
      const address = this.formatAddress(tfdRequest.pickupAddress);
      this.addKeyValue(doc, 'Endereço de Saída:', address);
    }

    if (tfdRequest.departureCustomAddress) {
      this.addKeyValue(doc, 'Endereço Customizado de Saída:', tfdRequest.departureCustomAddress);
    }

    if (tfdRequest.returnPickupAddress) {
      const address = this.formatAddress(tfdRequest.returnPickupAddress);
      this.addKeyValue(doc, 'Endereço de Retorno:', address);
    }

    if (tfdRequest.hotel) {
      this.addKeyValue(doc, 'Hotel:', tfdRequest.hotel.organization?.name || 'N/A');
    }

    this.addVerticalSpacing(doc, 4);
  }

  private renderCosts(doc: PDFDoc, tfdRequest: TfdRequestEntity): void {
    this.addSectionHeader(doc, 'Custos');

    if (tfdRequest.estimatedCost) {
      const formatted = this.formatMoney(tfdRequest.estimatedCost);
      this.addKeyValue(doc, 'Custo Estimado:', formatted);
    }

    if (tfdRequest.transportationCost) {
      const formatted = this.formatMoney(tfdRequest.transportationCost);
      this.addKeyValue(doc, 'Custo de Transporte:', formatted);
    }

    if (tfdRequest.foodCost) {
      const formatted = this.formatMoney(tfdRequest.foodCost);
      this.addKeyValue(doc, 'Custo de Alimentação:', formatted);
    }

    if (tfdRequest.hotelCost) {
      const formatted = this.formatMoney(tfdRequest.hotelCost);
      this.addKeyValue(doc, 'Custo de Hospedagem:', formatted);
    }

    const total = this.calculateTotal(tfdRequest);
    if (total > 0) {
      doc.fontSize(11);
      doc.font('Helvetica-Bold');
      const formatted = this.formatMoney(total);
      const y = doc.y;
      doc.text('Total:', TfdPdfService.MARGIN, y);
      doc.text(formatted, TfdPdfService.MARGIN + 100, y, { align: 'left' });
      doc.font('Helvetica');
      doc.moveDown();
    }

    this.addVerticalSpacing(doc, 4);
  }

  private renderStatus(doc: PDFDoc, tfdRequest: TfdRequestEntity): void {
    this.addSectionHeader(doc, 'Status');

    if (tfdRequest.status) {
      this.addKeyValue(doc, 'Status Atual:', tfdRequest.status.label || 'N/A');
    }

    if (tfdRequest.requestDate) {
      const formatted = this.formatDate(tfdRequest.requestDate);
      this.addKeyValue(doc, 'Data da Solicitação:', formatted);
    }

    if (tfdRequest.createdAt) {
      const formatted = this.formatDatetime(tfdRequest.createdAt);
      this.addKeyValue(doc, 'Criado em:', formatted);
    }

    if (tfdRequest.notes) {
      this.addKeyValue(doc, 'Observações:', tfdRequest.notes);
    }

    this.addVerticalSpacing(doc, 4);
  }

  private renderFooter(doc: PDFDoc): void {
    const pageHeight = doc.page.height;
    const pageWidth = doc.page.width;
    const footerY = pageHeight - 40;

    const now = new Date();
    const timestamp = this.formatDatetime(now);
    const footerText = `Gerado em ${timestamp}`;

    doc.fontSize(9);
    doc.fillColor('#666666');
    doc.text(footerText, TfdPdfService.MARGIN, footerY, {
      width: TfdPdfService.CONTENT_WIDTH,
      align: 'center',
    });
    doc.fillColor('#000000');
  }

  // Utility methods

  private addText(
    doc: PDFDoc,
    text: string,
    options?: ITextOptions,
    spacingAfter: number = 0,
  ): void {
    const fontSize = options?.fontSize || 11;
    const bold = options?.bold || false;
    const align = options?.align || 'left';
    const color = options?.color || '#000000';

    const font = bold ? 'Helvetica-Bold' : 'Helvetica';
    doc.fontSize(fontSize);
    doc.font(font);
    doc.fillColor(color);

    doc.text(text, TfdPdfService.MARGIN, doc.y, {
      width: TfdPdfService.CONTENT_WIDTH,
      align,
    });

    if (spacingAfter > 0) {
      doc.moveDown(spacingAfter / 12);
    }

    doc.fillColor('#000000');
  }

  private addSectionHeader(doc: PDFDoc, title: string): void {
    this.addText(doc, title, { fontSize: 12, bold: true, color: '#1F2937' }, 2);
    this.addHorizontalRule(doc, 1);
    this.addVerticalSpacing(doc, 2);
  }

  private addKeyValue(doc: PDFDoc, key: string, value: string): void {
    const fontSize = 10;
    const keyWidth = 130;
    const maxWidth = TfdPdfService.CONTENT_WIDTH - keyWidth;

    doc.fontSize(fontSize);
    doc.font('Helvetica-Bold');
    doc.fillColor('#000000');

    const keyX = TfdPdfService.MARGIN;
    doc.text(key, keyX, doc.y, { width: keyWidth, align: 'left' });

    const valueX = keyX + keyWidth;
    const currentY = doc.y - doc.currentLineHeight();

    doc.font('Helvetica');
    doc.text(value, valueX, currentY, {
      width: maxWidth,
      align: 'left',
    });

    doc.moveDown(0.5);
  }

  private addHorizontalRule(doc: PDFDoc, width: number = 1): void {
    const y = doc.y;
    doc.lineWidth(width);
    doc.strokeColor('#D1D5DB');
    doc.moveTo(TfdPdfService.MARGIN, y);
    doc.lineTo(
      TfdPdfService.PAGE_WIDTH - TfdPdfService.MARGIN,
      y,
    );
    doc.stroke();
    doc.moveDown(2);
  }

  private addVerticalSpacing(doc: PDFDoc, lines: number = 1): void {
    doc.moveDown(lines);
  }

  private formatDate(date: Date | string | null): string {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private formatDatetime(date: Date | string): string {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} às ${hours}:${minutes}`;
  }

  private formatMoney(amount: number | string | null): string {
    if (amount === null || amount === undefined || amount === '') return 'N/A';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  }

  private formatCpf(cpf: string): string {
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length !== 11) return cpf;
    return `${cleaned.substring(0, 3)}.${cleaned.substring(3, 6)}.${cleaned.substring(6, 9)}-${cleaned.substring(9)}`;
  }

  private formatGender(gender: string): string {
    const genderMap: { [key: string]: string } = {
      M: 'Masculino',
      F: 'Feminino',
      O: 'Outro',
      male: 'Masculino',
      female: 'Feminino',
      other: 'Outro',
    };
    return genderMap[gender] || gender;
  }

  private formatAddress(address: any): string {
    if (!address) return 'N/A';
    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.number) parts.push(address.number);
    if (address.complement) parts.push(address.complement);
    if (address.neighborhood) parts.push(address.neighborhood);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.zipCode) parts.push(`CEP: ${address.zipCode}`);
    return parts.join(', ') || 'N/A';
  }

  private calculateTotal(tfdRequest: TfdRequestEntity): number {
    let total = 0;
    if (tfdRequest.transportationCost) {
      total += typeof tfdRequest.transportationCost === 'string'
        ? parseFloat(tfdRequest.transportationCost)
        : tfdRequest.transportationCost;
    }
    if (tfdRequest.foodCost) {
      total += typeof tfdRequest.foodCost === 'string'
        ? parseFloat(tfdRequest.foodCost)
        : tfdRequest.foodCost;
    }
    if (tfdRequest.hotelCost) {
      total += typeof tfdRequest.hotelCost === 'string'
        ? parseFloat(tfdRequest.hotelCost)
        : tfdRequest.hotelCost;
    }
    return total;
  }
}
