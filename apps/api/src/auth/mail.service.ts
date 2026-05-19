import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly configured: boolean;

  constructor() {
    this.configured = !!(
      process.env.GMAIL_USER &&
      process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET &&
      process.env.GMAIL_REFRESH_TOKEN
    );
    if (this.configured) {
      this.logger.log(`Mail service ready (Gmail API) — sending from Perch <${process.env.GMAIL_USER}>`);
    } else {
      this.logger.warn('Gmail OAuth2 env vars not set — OTP codes will be logged to console only.');
    }
  }

  async sendOtp(email: string, code: string): Promise<void> {
    if (!this.configured) {
      this.printToConsole(email, code);
      return;
    }

    try {
      const accessToken = await this.getAccessToken();
      const raw = this.buildRaw(
        email,
        `${code} is your Perch verification code`,
        this.buildTemplate(code),
        `Perch <${process.env.GMAIL_USER}>`,
      );

      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Gmail API ${res.status}: ${body}`);
      }

      const result = await res.json() as { id: string };
      this.logger.log(`OTP sent to ${email} — gmailId=${result.id}`);
    } catch (err: unknown) {
      this.logger.error(`OTP send FAILED to ${email}: ${(err as Error).message}`);
      throw err;
    }
  }

  private async getAccessToken(): Promise<string> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GMAIL_CLIENT_ID!,
        client_secret: process.env.GMAIL_CLIENT_SECRET!,
        refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OAuth2 token refresh failed: ${body}`);
    }

    const data = await res.json() as { access_token: string };
    return data.access_token;
  }

  private buildRaw(to: string, subject: string, html: string, from: string): string {
    const msg = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      html,
    ].join('\r\n');
    return Buffer.from(msg).toString('base64url');
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
