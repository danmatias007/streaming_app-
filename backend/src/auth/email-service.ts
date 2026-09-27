import nodemailer from "nodemailer";

export interface EmailService { sendRegistrationLink(email: string, link: string): Promise<void>; }

export class DevelopmentEmailService implements EmailService {
  async sendRegistrationLink(email: string, link: string) {
    console.log(`[registration email] to=${email} link=${link}`);
  }
}

interface SmtpConfig { host: string; port: number; secure: boolean; user: string; password: string; from: string; }
export class SmtpEmailService implements EmailService {
  private readonly transport;
  constructor(private readonly config: SmtpConfig) {
    this.transport = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.secure, auth: { user: config.user, pass: config.password } });
  }
  async sendRegistrationLink(email: string, link: string) {
    await this.transport.sendMail({
      from: this.config.from,
      to: email,
      subject: "Conclua seu cadastro no Cinevault",
      text: `Use este link para criar sua senha: ${link}\n\nO link expira em 30 minutos e pode ser usado uma unica vez.`,
      html: `<div style="background:#0a0a0a;color:#eee;padding:36px;font-family:Arial,sans-serif"><h1 style="color:#b5141a">Cinevault</h1><p>Conclua seu cadastro e crie sua senha.</p><p><a href="${link}" style="display:inline-block;background:#b5141a;color:white;padding:14px 22px;text-decoration:none">Criar minha conta</a></p><p style="color:#888;font-size:12px">Este link expira em 30 minutos e pode ser usado uma unica vez.</p></div>`
    });
  }
}
