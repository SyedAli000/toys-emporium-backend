import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { formatPrice } from '../common/currency';

export type OrderLineForEmail = {
  name: string;
  quantity: number;
  price: number;
};

export type OrderEmailPayload = {
  orderId: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  status: string;
  items: OrderLineForEmail[];
  trackingNumber?: string;
  frontendUrl: string;
};

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly from: string;
  private readonly enabled: boolean;

  constructor(private config: ConfigService) {
    this.from =
      this.config.get<string>('MAIL_FROM') ||
      '"Toys Emporium" <noreply@toysemporium.local>';
    this.enabled = this.config.get<string>('MAIL_ENABLED') !== 'false';

    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT') || 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log(`SMTP configured (${host}:${port})`);
    } else if (!pass) {
      this.logger.warn(
        'SMTP_PASS is empty in .env — emails print in this terminal only, NOT sent to Gmail/inbox.',
      );
    } else {
      this.logger.warn(
        'SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in toys-emporium-backend/.env',
      );
    }
  }

  async onModuleInit() {
    if (!this.transporter) return;
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified — order emails will be delivered to inbox');
    } catch (err) {
      this.logger.error(
        `SMTP verify failed: ${(err as Error).message}. Fix SMTP_USER/SMTP_PASS in .env (use Gmail App Password, not normal password).`,
      );
    }
  }

  private async send(to: string, subject: string, html: string, text: string) {
    if (!this.enabled) {
      this.logger.debug(`Mail disabled, skipped: ${subject} → ${to}`);
      return;
    }

    if (!this.transporter) {
      this.logger.warn(
        `\n========== ORDER EMAIL (NOT SENT TO INBOX) ==========\n` +
          `To: ${to}\nSubject: ${subject}\n\n${text}\n\n` +
          `>>> Add SMTP_PASS (Gmail App Password) to toys-emporium-backend/.env then restart backend.\n` +
          `========================================================\n`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html,
        text,
      });
      this.logger.log(`Email sent: "${subject}" → ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${(err as Error).message}`);
    }
  }

  private itemsTableHtml(items: OrderLineForEmail[]) {
    const rows = items
      .map(
        (i) =>
          `<tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">${i.name}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${i.quantity}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${formatPrice(i.price * i.quantity)}</td>
          </tr>`,
      )
      .join('');
    return `<table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead><tr style="background:#f5f5f5;">
        <th style="padding:8px;text-align:left;">Product</th>
        <th style="padding:8px;">Qty</th>
        <th style="padding:8px;text-align:right;">Total</th>
      </tr></thead><tbody>${rows}</tbody></table>`;
  }

  private wrapHtml(title: string, body: string, ctaUrl?: string, ctaLabel?: string) {
    const cta = ctaUrl
      ? `<p style="margin-top:24px;"><a href="${ctaUrl}" style="background:#0d9488;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;">${ctaLabel || 'View order'}</a></p>`
      : '';
    return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#222;max-width:560px;margin:0 auto;padding:24px;">
      <div style="background:linear-gradient(135deg,#0d9488,#14b8a6);color:#fff;padding:20px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:20px;">Toys Emporium</h1>
      </div>
      <div style="border:1px solid #e5e5e5;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
        <h2 style="margin-top:0;">${title}</h2>
        ${body}
        ${cta}
        <p style="margin-top:32px;font-size:12px;color:#888;">Thank you for shopping with Toys Emporium.</p>
      </div>
    </body></html>`;
  }

  async sendOrderPlaced(payload: OrderEmailPayload) {
    const shortId = payload.orderId.slice(-8);
    const orderUrl = `${payload.frontendUrl}/user/orders/${payload.orderId}`;
    const body = `
      <p>Hi ${payload.customerName},</p>
      <p>We received your order <strong>#${shortId}</strong>. It is <strong>pending</strong> and our team will confirm it soon.</p>
      <p><strong>Total:</strong> ${formatPrice(payload.totalAmount)} (Cash on Delivery)</p>
      ${this.itemsTableHtml(payload.items)}
    `;
    const text = `Order #${shortId} placed. Total ${formatPrice(payload.totalAmount)}. Status: pending.`;
    await this.send(
      payload.customerEmail,
      `Order placed — #${shortId} | Toys Emporium`,
      this.wrapHtml('Your order was placed', body, orderUrl, 'View your order'),
      text,
    );
  }

  async sendOrderConfirmed(payload: OrderEmailPayload) {
    const shortId = payload.orderId.slice(-8);
    const orderUrl = `${payload.frontendUrl}/user/orders/${payload.orderId}`;
    const body = `
      <p>Hi ${payload.customerName},</p>
      <p>Good news! Your order <strong>#${shortId}</strong> has been <strong>confirmed</strong> by our team.</p>
      <p>We will notify you when it ships.</p>
      <p><strong>Total:</strong> ${formatPrice(payload.totalAmount)}</p>
    `;
    await this.send(
      payload.customerEmail,
      `Order confirmed — #${shortId} | Toys Emporium`,
      this.wrapHtml('Order confirmed', body, orderUrl, 'View your order'),
      `Order #${shortId} confirmed.`,
    );
  }

  async sendOrderShipped(payload: OrderEmailPayload) {
    const shortId = payload.orderId.slice(-8);
    const orderUrl = `${payload.frontendUrl}/user/orders/${payload.orderId}`;
    const tracking = payload.trackingNumber
      ? `<p><strong>Tracking:</strong> ${payload.trackingNumber}</p>`
      : '';
    const body = `
      <p>Hi ${payload.customerName},</p>
      <p>Your order <strong>#${shortId}</strong> has been <strong>shipped</strong>!</p>
      ${tracking}
      <p>Please have payment ready for Cash on Delivery when your package arrives.</p>
    `;
    await this.send(
      payload.customerEmail,
      `Order shipped — #${shortId} | Toys Emporium`,
      this.wrapHtml('Your order is on the way', body, orderUrl, 'Track your order'),
      `Order #${shortId} shipped.${payload.trackingNumber ? ` Tracking: ${payload.trackingNumber}` : ''}`,
    );
  }

  async sendOrderDelivered(payload: OrderEmailPayload) {
    const shortId = payload.orderId.slice(-8);
    const orderUrl = `${payload.frontendUrl}/user/orders/${payload.orderId}`;
    const body = `
      <p>Hi ${payload.customerName},</p>
      <p>Your order <strong>#${shortId}</strong> has been <strong>delivered</strong>. We hope you enjoy your toys!</p>
      <p>Thank you for shopping with us.</p>
    `;
    await this.send(
      payload.customerEmail,
      `Order delivered — #${shortId} | Toys Emporium`,
      this.wrapHtml('Order delivered', body, orderUrl, 'View order'),
      `Order #${shortId} delivered.`,
    );
  }

  async sendOrderStatusUpdate(payload: OrderEmailPayload) {
    switch (payload.status) {
      case 'confirmed':
        return this.sendOrderConfirmed(payload);
      case 'shipped':
        return this.sendOrderShipped(payload);
      case 'delivered':
        return this.sendOrderDelivered(payload);
      default:
        return;
    }
  }
}
