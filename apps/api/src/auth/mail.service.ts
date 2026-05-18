import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private apiKey: string | null;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.apiKey = process.env.BREVO_API_KEY ?? null;
    const from = process.env.MAIL_FROM ?? 'Perch <onboarding@perch.app>';
    const match = from.match(/^(.+?)\s*<(.+)>$/);
    this.fromName = match ? match[1].trim() : 'Perch';
    this.fromEmail = match ? match[2].trim() : from;

    if (this.apiKey) {
      this.logger.log(`Mail service ready — sending from ${this.fromEmail}`);
    } else {
      this.logger.warn('BREVO_API_KEY not set — OTP codes will be logged to console only.');
    }
  }

  async sendOtp(email: string, code: string): Promise<void> {
    if (!this.apiKey) {
      this.printToConsole(email, code);
      return;
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: this.fromName, email: this.fromEmail },
        to: [{ email }],
        subject: `${code} is your Perch verification code`,
        htmlContent: this.buildTemplate(code),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Brevo send failed (${res.status}): ${body}`);
      throw new Error('Failed to send OTP email');
    }

    this.logger.log(`OTP sent to ${email}`);
  }

  private buildTemplate(code: string): string {
    return `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                  max-width:420px;margin:0 auto;padding:32px 24px;background:#fff;">
        <div style="margin-bottom:24px;">
          <span style="font-size:28px;">🦉</span>
          <span style="font-size:20px;font-weight:700;color:#2563EB;margin-left:8px;">Perch</span>
        </div>

        <h1 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">
          Your verification code
        </h1>
        <p style="color:#6B7280;margin:0 0 28px;line-height:1.5;">
          Use the code below to sign in to Perch. It expires in <strong>10 minutes</strong>.
        </p>

        <div style="background:#F3F4F6;border-radius:14px;padding:28px;text-align:center;margin-bottom:28px;">
          <span style="font-size:44px;font-weight:800;letter-spacing:10px;color:#111827;
                       font-variant-numeric:tabular-nums;">${code}</span>
        </div>

        <p style="color:#9CA3AF;font-size:13px;margin:0;">
          If you didn't request this, you can safely ignore this email.
          Someone may have entered your email by mistake.
        </p>

        <hr style="border:none;border-top:1px solid #E5E7EB;margin:28px 0 16px;" />
        <p style="color:#9CA3AF;font-size:12px;margin:0;">
          Perch — Community-driven parking discovery in Metro Manila
        </p>
      </div>
    `;
  }

  private printToConsole(email: string, code: string): void {
    const pad = email.length > 30 ? email.slice(0, 27) + '...' : email.padEnd(30);
    console.log('\n╔══════════════════════════════════════════╗');
    console.log(`║  Perch OTP › ${pad}  ║`);
    console.log(`║  Code : ${code}                             ║`);
    console.log('║  Valid for 10 minutes                    ║');
    console.log('╚══════════════════════════════════════════╝\n');
  }
}
