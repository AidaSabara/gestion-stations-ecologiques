import nodemailer, { SentMessageInfo } from 'nodemailer';
import fs from 'fs';
import path from 'path';


interface Alert {
  id?: string;
  station: string;
  stationId?: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'warning' | 'info';
  message: string;
  timestamp: number;
  status: 'active' | 'resolved';
  parameter?: string;
  value?: number;
  threshold?: number;
}
type EmailSeverity = 'critical' | 'warning' | 'info';

function mapSeverityToEmail(severity: Alert['severity']): EmailSeverity {
    switch (severity) {
        case 'critical':
        case 'high':
            return 'critical';
        case 'medium':
        case 'warning':
            return 'warning';
        case 'low':
        case 'info':
        default:
            return 'info';
    }
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'aidasabara1111@gmail.com',
        pass: process.env.EMAIL_PASSWORD || 'yorm tjup wgpm fmsv'
      }
    });
  }

  /**
   * Envoie un rapport par email
   */
  async sendReportEmail(
    recipients: string[],
    stationName: string,
    frequency: 'weekly' | 'monthly',
    period: { start: string; end: string },
    pdfPath: string
  ) {
    const frequencyLabel = frequency === 'weekly' ? 'Hebdomadaire' : 'Mensuel';
    const subject = `📊 Rapport ${frequencyLabel} - Station ${stationName}`;

    const htmlContent = this.generateReportEmailHTML(stationName, frequency, period);

    try {
      const info = await this.transporter.sendMail({
        from: `"Eco-Stations" <${process.env.EMAIL_USER}>`,
        to: recipients.join(', '),
        subject: subject,
        html: htmlContent,
        attachments: [
          {
            filename: path.basename(pdfPath),
            path: pdfPath,
            contentType: 'application/pdf'
          }
        ]
      });

      console.log('✅ Email envoyé:', info.messageId);
      return info;
    } catch (error) {
      console.error('❌ Erreur envoi email:', error);
      throw error;
    }
  }

  /**
   * Génère le contenu HTML de l'email de rapport
   */
  private generateReportEmailHTML(
    stationName: string,
    frequency: string,
    period: { start: string; end: string }
  ): string {
    const frequencyLabel = frequency === 'weekly' ? 'Hebdomadaire' : 'Mensuel';
    const startDate = new Date(period.start).toLocaleDateString('fr-FR');
    const endDate = new Date(period.end).toLocaleDateString('fr-FR');

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport ${frequencyLabel}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f6f9; padding: 40px 0;">
    <tr>
      <td align="center">
        <!-- Container principal -->
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden;">
          
          <!-- En-tête avec gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                📊 Rapport ${frequencyLabel}
              </h1>
              <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 16px;">
                Station ${stationName}
              </p>
            </td>
          </tr>

          <!-- Période -->
          <tr>
            <td style="padding: 30px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding: 15px; text-align: center; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Début</p>
                    <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: 600; color: #1e293b;">📅 ${startDate}</p>
                  </td>
                  <td width="50%" style="padding: 15px; text-align: center; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Fin</p>
                    <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: 600; color: #1e293b;">📅 ${endDate}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contenu principal -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #334155; line-height: 1.6;">
                Bonjour,
              </p>
              <p style="margin: 0 0 25px 0; font-size: 16px; color: #334155; line-height: 1.6;">
                Veuillez trouver ci-joint le rapport ${frequencyLabel.toLowerCase()} de la station <strong>${stationName}</strong> 
                pour la période du <strong>${startDate}</strong> au <strong>${endDate}</strong>.
              </p>

              <!-- Points clés -->
              <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-left: 4px solid #0ea5e9; padding: 20px; border-radius: 8px; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #0c4a6e;">📋 Contenu du rapport</h3>
                <ul style="margin: 0; padding-left: 20px; color: #1e293b; line-height: 1.8;">
                  <li>📊 Statistiques de qualité de l'eau</li>
                  <li>🚨 Alertes et incidents enregistrés</li>
                  <li>🔧 Interventions de maintenance effectuées</li>
                  <li>💡 Recommandations et actions à prendre</li>
                </ul>
              </div>

              <p style="margin: 25px 0 0 0; font-size: 16px; color: #334155; line-height: 1.6;">
                Pour toute question ou clarification concernant ce rapport, n'hésitez pas à nous contacter.
              </p>
            </td>
          </tr>

          <!-- Call to action -->
          <tr>
            <td style="padding: 0 30px 40px 30px; text-align: center;">
              <a href="#" style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); transition: transform 0.2s;">
                📥 Télécharger le rapport
              </a>
            </td>
          </tr>

          <!-- Pied de page -->
          <tr>
            <td style="background-color: #1e293b; padding: 30px; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 16px; color: #ffffff; font-weight: 600;">
                🌊 Eco-Stations
              </p>
              <p style="margin: 0 0 5px 0; font-size: 14px; color: #94a3b8;">
                Système de gestion et monitoring des stations d'épuration
              </p>
              <p style="margin: 15px 0 0 0; font-size: 12px; color: #64748b;">
                © ${new Date().getFullYear()} Eco-Stations. Tous droits réservés.
              </p>
              <p style="margin: 10px 0 0 0; font-size: 11px; color: #64748b;">
                Ce message est automatique, merci de ne pas y répondre directement.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * Envoie un email d'alerte (version améliorée)
   */

  /**
   * Teste la configuration email
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('✅ Configuration email valide');
      return true;
    } catch (error) {
      console.error('❌ Configuration email invalide:', error);
      return false;
    }
  }
}