// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import * as crypto from 'crypto';
import { Builder } from 'xml2js';
import { logger } from '../../../shared/logger';
import axios from 'axios';
import { isEtaSigningEnabled, mockSignedDevTag } from '../../electronic-invoices/services/eta-signing-env';

/**
 * Tax Signature Service
 * Handles digital signature generation for tax compliance (ETA, ZATCA, etc.)
 */

export interface TaxInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  taxAmount: number;
  items: TaxInvoiceItem[];
  seller: TaxSeller;
  buyer: TaxBuyer;
}

export interface TaxInvoiceItem {
  name: string;
  quantity: number;
  price: number;
  taxRate: number;
}

export interface TaxSeller {
  name: string;
  taxId: string;
  address: string;
}

export interface TaxBuyer {
  name: string;
  taxId?: string;
  address: string;
}

export interface SignedInvoice {
  invoice: TaxInvoice;
  signature: string;
  hash: string;
  timestamp: string;
}

export type TaxAuthority = 'ETA' | 'ZATCA' | 'FTA' | 'GENERIC';

export interface TaxSubmissionResult {
  success: boolean;
  submissionId?: string;
  qrCode?: string;
  uuid?: string;
  message?: string;
  error?: string;
}

/**
 * Tax Signature Service
 * Country-specific implementations should extend this base class
 */
export class TaxSignatureService {
  protected privateKey: string;
  protected publicKey: string;
  protected taxAuthorityUrl: string;
  protected taxAuthority: TaxAuthority;

  constructor() {
    // These should be loaded from environment variables or secure storage
    this.privateKey = process.env.TAX_PRIVATE_KEY || '';
    this.publicKey = process.env.TAX_PUBLIC_KEY || '';
    this.taxAuthorityUrl = process.env.TAX_AUTHORITY_URL || '';
    this.taxAuthority = (process.env.TAX_AUTHORITY as TaxAuthority) || 'GENERIC';

    if (!this.privateKey || !this.publicKey) {
      logger.warn('Tax signature keys not configured');
    }
  }

  /**
   * Generate UBL XML from invoice data
   * Enhanced implementation following UBL 2.1 standard
   */
  generateUBL(invoice: TaxInvoice): string {
    const xmlBuilder = new Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8' },
      renderOpts: { pretty: false },
    });

    // Calculate totals
    const lineTotal = invoice.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const taxExclusiveAmount = lineTotal;
    const taxInclusiveAmount = invoice.totalAmount;

    const ublDocument = {
      Invoice: {
        $: {
          xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
          'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
          'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        },
        'cbc:CustomizationID': '2.1',
        'cbc:ProfileID': 'reporting:1.0',
        'cbc:ID': invoice.invoiceNumber,
        'cbc:IssueDate': invoice.invoiceDate.split('T')[0],
        'cbc:IssueTime': invoice.invoiceDate.includes('T')
          ? invoice.invoiceDate.split('T')[1]
          : '00:00:00',
        'cbc:InvoiceTypeCode': {
          $: { listID: 'UNCL1001' },
          _: '388', // Tax Invoice
        },
        'cac:AccountingSupplierParty': {
          'cac:Party': {
            'cac:PartyName': {
              'cbc:Name': invoice.seller.name,
            },
            'cac:PostalAddress': {
              'cbc:StreetName': invoice.seller.address,
            },
            'cac:PartyTaxScheme': {
              'cbc:CompanyID': invoice.seller.taxId,
              'cac:TaxScheme': {
                'cbc:ID': 'VAT',
              },
            },
          },
        },
        'cac:AccountingCustomerParty': {
          'cac:Party': {
            'cac:PartyName': {
              'cbc:Name': invoice.buyer.name,
            },
            'cac:PostalAddress': {
              'cbc:StreetName': invoice.buyer.address,
            },
            ...(invoice.buyer.taxId
              ? {
                  'cac:PartyTaxScheme': {
                    'cbc:CompanyID': invoice.buyer.taxId,
                    'cac:TaxScheme': {
                      'cbc:ID': 'VAT',
                    },
                  },
                }
              : {}),
          },
        },
        'cac:TaxTotal': {
          'cbc:TaxAmount': {
            $: { currencyID: 'EGP' },
            _: invoice.taxAmount.toString(),
          },
          'cac:TaxSubtotal': invoice.items.map((item) => ({
            'cbc:TaxableAmount': {
              $: { currencyID: 'EGP' },
              _: (item.price * item.quantity).toString(),
            },
            'cbc:TaxAmount': {
              $: { currencyID: 'EGP' },
              _: (item.price * item.quantity * (item.taxRate / 100)).toString(),
            },
            'cac:TaxCategory': {
              'cbc:ID': 'S',
              'cbc:Percent': item.taxRate.toString(),
              'cac:TaxScheme': {
                'cbc:ID': 'VAT',
              },
            },
          })),
        },
        'cac:LegalMonetaryTotal': {
          'cbc:TaxExclusiveAmount': {
            $: { currencyID: 'EGP' },
            _: taxExclusiveAmount.toString(),
          },
          'cbc:TaxInclusiveAmount': {
            $: { currencyID: 'EGP' },
            _: taxInclusiveAmount.toString(),
          },
          'cbc:PayableAmount': {
            $: { currencyID: 'EGP' },
            _: taxInclusiveAmount.toString(),
          },
        },
        'cac:InvoiceLine': invoice.items.map((item, index) => ({
          'cbc:ID': (index + 1).toString(),
          'cbc:InvoicedQuantity': {
            $: { unitCode: 'C62' },
            _: item.quantity.toString(),
          },
          'cbc:LineExtensionAmount': {
            $: { currencyID: 'EGP' },
            _: (item.price * item.quantity).toString(),
          },
          'cac:Item': {
            'cbc:Name': item.name,
          },
          'cac:Price': {
            'cbc:PriceAmount': {
              $: { currencyID: 'EGP' },
              _: item.price.toString(),
            },
          },
          'cac:TaxTotal': {
            'cbc:TaxAmount': {
              $: { currencyID: 'EGP' },
              _: (item.price * item.quantity * (item.taxRate / 100)).toString(),
            },
            'cac:TaxSubtotal': {
              'cbc:TaxableAmount': {
                $: { currencyID: 'EGP' },
                _: (item.price * item.quantity).toString(),
              },
              'cbc:TaxAmount': {
                $: { currencyID: 'EGP' },
                _: (item.price * item.quantity * (item.taxRate / 100)).toString(),
              },
              'cac:TaxCategory': {
                'cbc:ID': 'S',
                'cbc:Percent': item.taxRate.toString(),
                'cac:TaxScheme': {
                  'cbc:ID': 'VAT',
                },
              },
            },
          },
        })),
      },
    };

    return xmlBuilder.buildObject(ublDocument);
  }

  /**
   * Generate SHA-256 hash of invoice
   */
  generateHash(invoice: TaxInvoice): string {
    const ubl = this.generateUBL(invoice);
    return crypto.createHash('sha256').update(ubl).digest('hex');
  }

  /**
   * Generate digital signature
   */
  generateSignature(hash: string): string {
    if (!this.privateKey) {
      throw new Error('Private key not configured');
    }

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(hash);
    sign.end();

    return sign.sign(this.privateKey, 'base64');
  }

  /**
   * Sign invoice
   */
  signInvoice(invoice: TaxInvoice): SignedInvoice {
    try {
      const hash = this.generateHash(invoice);
      const signature = this.generateSignature(hash);
      const timestamp = new Date().toISOString();

      logger.info(
        { invoiceNumber: invoice.invoiceNumber },
        'Invoice signed successfully'
      );

      return {
        invoice,
        signature,
        hash,
        timestamp,
      };
    } catch (error) {
      logger.error({ error, invoice }, 'Error signing invoice');
      throw new Error('Failed to sign invoice');
    }
  }

  /**
   * Verify signature
   */
  verifySignature(signedInvoice: SignedInvoice): boolean {
    try {
      const hash = this.generateHash(signedInvoice.invoice);
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(hash);
      verify.end();

      return verify.verify(this.publicKey, signedInvoice.signature, 'base64');
    } catch (error) {
      logger.error({ error }, 'Error verifying signature');
      return false;
    }
  }

  /**
   * Submit invoice to tax authority
   * Country-specific implementations
   */
  async submitInvoice(signedInvoice: SignedInvoice): Promise<TaxSubmissionResult> {
    logger.info(
      {
        invoiceNumber: signedInvoice.invoice.invoiceNumber,
        authority: this.taxAuthority,
      },
      'Submitting invoice to tax authority'
    );

    try {
      switch (this.taxAuthority) {
        case 'ETA':
          return await this.submitToETA(signedInvoice);
        case 'ZATCA':
          return await this.submitToZATCA(signedInvoice);
        case 'FTA':
          return await this.submitToFTA(signedInvoice);
        default:
          return await this.submitGeneric(signedInvoice);
      }
    } catch (error) {
      logger.error({ error, invoiceNumber: signedInvoice.invoice.invoiceNumber }, 'Error submitting invoice');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Submit to Egypt Electronic Tax Authority (ETA)
   */
  private async submitToETA(signedInvoice: SignedInvoice): Promise<TaxSubmissionResult> {
    if (!isEtaSigningEnabled()) {
      const tag = mockSignedDevTag();
      return {
        success: true,
        submissionId: tag,
        uuid: tag,
        message: 'MOCK_SIGNED_DEV: ETA signing disabled (sandbox/dev)',
      };
    }

    const ubl = this.generateUBL(signedInvoice.invoice);
    const apiUrl = this.taxAuthorityUrl || process.env.ETA_API_URL || 'https://api.invoicing.eta.gov.eg';

    try {
      const response = await axios.post(
        `${apiUrl}/api/v1/documentsubmissions`,
        {
          documents: [
            {
              documentType: 'I',
              documentTypeVersion: '1.0',
              document: Buffer.from(ubl).toString('base64'),
              signature: signedInvoice.signature,
            },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.ETA_ACCESS_TOKEN || ''}`,
          },
          timeout: 30000,
        }
      );

      return {
        success: true,
        submissionId: response.data.submissionId || response.data.uuid,
        uuid: response.data.uuid,
        qrCode: response.data.qrCode,
        message: 'Invoice submitted successfully to ETA',
      };
    } catch (error) {
      logger.error({ error }, 'ETA submission failed');
      if (process.env.NODE_ENV !== 'production') {
        const tag = mockSignedDevTag();
        return {
          success: true,
          submissionId: tag,
          uuid: tag,
          message: 'MOCK_SIGNED_DEV: ETA submission simulated (development mode)',
        };
      }
      throw error;
    }
  }

  /**
   * Submit to Saudi Arabia ZATCA (Zakat, Tax and Customs Authority)
   */
  private async submitToZATCA(signedInvoice: SignedInvoice): Promise<TaxSubmissionResult> {
    // ZATCA SDK integration placeholder
    // Real implementation would use ZATCA SDK
    // Documentation: https://zatca.gov.sa/

    const ubl = this.generateUBL(signedInvoice.invoice);
    const apiUrl = this.taxAuthorityUrl || process.env.ZATCA_API_URL || 'https://api.zatca.gov.sa';

    try {
      // Placeholder API call - replace with actual ZATCA API
      const response = await axios.post(
        `${apiUrl}/invoices`,
        {
          invoiceHash: signedInvoice.hash,
          invoice: Buffer.from(ubl).toString('base64'),
          uuid: crypto.randomUUID(),
          invoiceSignature: signedInvoice.signature,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.ZATCA_ACCESS_TOKEN || ''}`,
            'Accept-Language': 'ar',
          },
          timeout: 30000,
        }
      );

      return {
        success: true,
        submissionId: response.data.uuid || response.data.invoiceId,
        uuid: response.data.uuid,
        qrCode: response.data.qrCode,
        message: 'Invoice submitted successfully to ZATCA',
      };
    } catch (error) {
      logger.error({ error }, 'ZATCA submission failed');
      // In development/test mode, return success
      if (process.env.NODE_ENV !== 'production') {
        return {
          success: true,
          submissionId: `ZATCA-${Date.now()}`,
          message: 'ZATCA submission simulated (development mode)',
        };
      }
      throw error;
    }
  }

  /**
   * Submit to UAE Federal Tax Authority (FTA)
   */
  private async submitToFTA(signedInvoice: SignedInvoice): Promise<TaxSubmissionResult> {
    // FTA API integration placeholder
    // Real implementation would use FTA API
    // Documentation: https://www.tax.gov.ae/

    const ubl = this.generateUBL(signedInvoice.invoice);
    const apiUrl = this.taxAuthorityUrl || process.env.FTA_API_URL || 'https://api.tax.gov.ae';

    try {
      // Placeholder API call - replace with actual FTA API
      const response = await axios.post(
        `${apiUrl}/api/v1/tax-invoices`,
        {
          invoice: Buffer.from(ubl).toString('base64'),
          signature: signedInvoice.signature,
          hash: signedInvoice.hash,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.FTA_ACCESS_TOKEN || ''}`,
          },
          timeout: 30000,
        }
      );

      return {
        success: true,
        submissionId: response.data.invoiceId || response.data.uuid,
        uuid: response.data.uuid,
        qrCode: response.data.qrCode,
        message: 'Invoice submitted successfully to FTA',
      };
    } catch (error) {
      logger.error({ error }, 'FTA submission failed');
      // In development/test mode, return success
      if (process.env.NODE_ENV !== 'production') {
        return {
          success: true,
          submissionId: `FTA-${Date.now()}`,
          message: 'FTA submission simulated (development mode)',
        };
      }
      throw error;
    }
  }

  /**
   * Generic submission (fallback)
   */
  private async submitGeneric(signedInvoice: SignedInvoice): Promise<TaxSubmissionResult> {
    logger.info(
      { invoiceNumber: signedInvoice.invoice.invoiceNumber },
      'Using generic tax submission'
    );

    // Generic submission - just log and return success
    return {
      success: true,
      submissionId: `GEN-${Date.now()}`,
      message: 'Invoice signed and ready for submission',
    };
  }
}

export const taxSignatureService = new TaxSignatureService();
