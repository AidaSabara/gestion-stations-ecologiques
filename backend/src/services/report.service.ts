// src/services/report.service.ts
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

interface ReportData {
  station: any;
  waterQuality: any[];
  alerts: any[];
  maintenances: any[];
  period: { start: string; end: string };
}

export default class ReportService {
  private reportsDir: string;

  constructor() {
    this.reportsDir = path.join(__dirname, '../../reports');
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  async generateWeeklyReport(data: ReportData): Promise<string> {
    const stationName = data.station.body?.name || data.station._source?.name || 'Station';
    const fileName = `rapport_${stationName.replace(/\s+/g, '_')}_${this.formatDateForFile(data.period.start)}.pdf`;
    const filePath = path.join(this.reportsDir, fileName);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ 
          size: 'A4', 
          margin: 50,
          bufferPages: true
        });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Page 1: En-tête et résumé
        this.addHeader(doc, data);
        this.addExecutiveSummary(doc, data);
        
        // Qualité de l'eau (sur la même page si possible)
        if (data.waterQuality.length > 0) {
          this.addWaterQualitySection(doc, data);
        } else {
          this.addNoDataMessage(doc, 'Qualite de l\'eau');
        }
        
        // Page 2: Alertes et maintenances
        doc.addPage();
        this.addAlertsSection(doc, data);
        this.addMaintenanceSection(doc, data);
        
        // Recommandations (seulement s'il y en a)
        const recommendations = this.generateSmartRecommendations(data);
        if (recommendations.length > 0) {
          doc.addPage();
          this.addRecommendations(doc, recommendations);
        }

        // Footer sur toutes les pages
        this.addPageNumbers(doc);
        
        doc.end();
        stream.on('finish', () => resolve(filePath));
        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  private addHeader(doc: PDFKit.PDFDocument, data: ReportData) {
    const stationName = data.station.body?.name || 'Station';
    const region = data.station.body?.region || '';
    
    // Fond d'en-tête bleu
    doc.rect(0, 0, 595, 150).fill('#1e40af');
    
    // Titre
    doc.fontSize(28)
       .fillColor('#ffffff')
       .font('Helvetica-Bold')
       .text('RAPPORT HEBDOMADAIRE', 50, 40);
    
    // Nom de la station
    doc.fontSize(18)
       .fillColor('#93c5fd')
       .font('Helvetica')
       .text(`Station: ${stationName}`, 50, 75);
    
    if (region) {
      doc.fontSize(14)
         .fillColor('#bfdbfe')
         .text(`Region: ${region}`, 50, 100);
    }
    
    // Période
    const startDate = this.formatDate(data.period.start);
    const endDate = this.formatDate(data.period.end);
    
    doc.roundedRect(50, 115, 495, 25, 5).fill('#3b82f6');
    doc.fontSize(12)
       .fillColor('#ffffff')
       .font('Helvetica')
       .text(`Du ${startDate} au ${endDate}`, 50, 123, { width: 495, align: 'center' });
    
    doc.y = 170;
  }

  private addExecutiveSummary(doc: PDFKit.PDFDocument, data: ReportData) {
    // Titre de section
    doc.fontSize(16)
       .fillColor('#1e293b')
       .font('Helvetica-Bold')
       .text('SYNTHESE GENERALE', 50, doc.y);
    
    doc.moveDown(0.5);
    doc.strokeColor('#e2e8f0').lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    const stats = this.calculateStats(data);
    const startY = doc.y;
    
    // Grille 2x2 de statistiques
    const cards = [
      { label: 'Mesures effectuees', value: stats.totalMeasurements, color: '#3b82f6' },
      { label: 'Alertes critiques', value: stats.criticalAlerts, color: stats.criticalAlerts > 0 ? '#ef4444' : '#10b981' },
      { label: 'Interventions', value: stats.completedMaintenances, color: '#8b5cf6' },
      { label: 'Taux de conformite', value: `${stats.complianceRate}%`, color: stats.complianceRate >= 80 ? '#10b981' : '#f59e0b' }
    ];

    cards.forEach((card, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 50 + col * 250;
      const y = startY + row * 80;
      
      // Carte
      doc.roundedRect(x, y, 230, 70, 8)
         .lineWidth(2)
         .strokeColor('#e2e8f0')
         .fillAndStroke('#ffffff', '#e2e8f0');
      
      // Valeur
      doc.fontSize(24)
         .fillColor(card.color)
         .font('Helvetica-Bold')
         .text(card.value.toString(), x + 15, y + 15);
      
      // Label
      doc.fontSize(11)
         .fillColor('#64748b')
         .font('Helvetica')
         .text(card.label, x + 15, y + 45, { width: 200 });
    });

    doc.y = startY + 170;
  }

  private addWaterQualitySection(doc: PDFKit.PDFDocument, data: ReportData) {
    doc.fontSize(16)
       .fillColor('#1e293b')
       .font('Helvetica-Bold')
       .text('QUALITE DE L\'EAU', 50, doc.y);
    
    doc.moveDown(0.5);
    doc.strokeColor('#e2e8f0').lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    const params = this.analyzeWaterQuality(data.waterQuality);
    
    if (params.length === 0) {
      this.addNoDataMessage(doc, 'qualite de l\'eau');
      return;
    }

    // En-tête du tableau
    const tableTop = doc.y;
    const colWidths = [140, 110, 110, 110, 75];
    const headers = ['Parametre', 'Entree', 'Sortie', 'Rendement', 'Statut'];
    
    doc.fontSize(10)
       .fillColor('#1e293b')
       .font('Helvetica-Bold');
    
    let xPos = 50;
    headers.forEach((header, i) => {
      doc.text(header, xPos, tableTop, { width: colWidths[i], align: i === 0 ? 'left' : 'center' });
      xPos += colWidths[i];
    });
    
    doc.moveDown(0.3);
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);

    // Lignes du tableau
    params.forEach((param, index) => {
      if (doc.y > 700) {
        doc.addPage();
        doc.y = 50;
      }
      
      const rowY = doc.y;
      
      // Fond alterné
      if (index % 2 === 0) {
        doc.rect(50, rowY - 5, 495, 30).fill('#f8fafc');
      }
      
      doc.fontSize(10)
         .fillColor('#1e293b')
         .font('Helvetica');
      
      // Nom du paramètre
      doc.text(param.name, 50, rowY, { width: 140 });
      
      // Entrée
      doc.fillColor('#3b82f6')
         .text(param.entree || 'N/A', 190, rowY, { width: 110, align: 'center' });
      
      // Sortie
      doc.fillColor('#10b981')
         .text(param.sortie || 'N/A', 300, rowY, { width: 110, align: 'center' });
      
      // Rendement
      if (param.rendement !== null) {
        const rendColor = param.rendement >= 80 ? '#10b981' : param.rendement >= 60 ? '#f59e0b' : '#ef4444';
        doc.fillColor(rendColor)
           .font('Helvetica-Bold')
           .text(`${param.rendement}%`, 410, rowY, { width: 110, align: 'center' });
      } else {
        doc.fillColor('#94a3b8')
           .font('Helvetica')
           .text('-', 410, rowY, { width: 110, align: 'center' });
      }
      
      // Statut
      const status = this.getParameterStatus(param);
      const statusColor = status === 'Conforme' ? '#10b981' : status === 'Attention' ? '#f59e0b' : '#ef4444';
      doc.fillColor(statusColor)
         .font('Helvetica-Bold')
         .text(status, 520, rowY, { width: 75, align: 'center' });
      
      doc.moveDown(1.5);
    });

    doc.moveDown(1);

    // Légende des rendements
    doc.fontSize(9)
       .fillColor('#64748b')
       .font('Helvetica-Oblique')
       .text('* Rendement = ((Entree - Sortie) / Entree) x 100%', 50, doc.y);
    
    doc.moveDown(2);
  }

  private addAlertsSection(doc: PDFKit.PDFDocument, data: ReportData) {
    doc.fontSize(16)
       .fillColor('#1e293b')
       .font('Helvetica-Bold')
       .text('ALERTES ET INCIDENTS', 50, 50);
    
    doc.moveDown(0.5);
    doc.strokeColor('#e2e8f0').lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    if (data.alerts.length === 0) {
      doc.roundedRect(50, doc.y, 495, 60, 8)
         .fill('#f0fdf4');
      
      doc.fontSize(12)
         .fillColor('#166534')
         .font('Helvetica-Bold')
         .text('Aucune alerte enregistree', 70, doc.y + 15);
      
      doc.fontSize(10)
         .fillColor('#15803d')
         .font('Helvetica')
         .text('Toutes les mesures sont conformes aux normes pour cette periode', 70, doc.y + 35);
      
      doc.moveDown(5);
      return;
    }

    const critical = data.alerts.filter(a => a.body?.level === 'critical' || a.body?.severity === 'critical');
    const warning = data.alerts.filter(a => a.body?.level === 'warning' || a.body?.severity === 'warning');
    
    // Résumé des alertes
    doc.fontSize(11)
       .fillColor('#1e293b')
       .font('Helvetica')
       .text(`Total: ${data.alerts.length} alerte(s) detectee(s)`, 50, doc.y);
    
    if (critical.length > 0) {
      doc.fillColor('#dc2626')
         .text(`  - ${critical.length} critique(s)`, 50, doc.y + 15);
    }
    if (warning.length > 0) {
      doc.fillColor('#f59e0b')
         .text(`  - ${warning.length} importante(s)`, 50, doc.y + 30);
    }
    
    doc.moveDown(3);

    // Afficher les alertes critiques
    if (critical.length > 0) {
      doc.fontSize(12)
         .fillColor('#dc2626')
         .font('Helvetica-Bold')
         .text('Alertes critiques:', 50, doc.y);
      
      doc.moveDown(0.5);
      
      critical.slice(0, 5).forEach(alert => {
        const message = alert.body?.message || alert._source?.message || 'Alerte critique detectee';
        const timestamp = alert.body?.timestamp || alert._source?.timestamp;
        
        doc.roundedRect(50, doc.y, 495, 50, 6)
           .fill('#fef2f2');
        
        doc.fontSize(10)
           .fillColor('#1e293b')
           .font('Helvetica')
           .text(message, 70, doc.y + 12, { width: 455 });
        
        if (timestamp) {
          doc.fontSize(8)
             .fillColor('#64748b')
             .text(`Date: ${this.formatDate(timestamp)}`, 70, doc.y + 32);
        }
        
        doc.moveDown(3);
      });
    }

    // Afficher les alertes importantes
    if (warning.length > 0 && doc.y < 600) {
      doc.fontSize(12)
         .fillColor('#f59e0b')
         .font('Helvetica-Bold')
         .text('Alertes importantes:', 50, doc.y);
      
      doc.moveDown(0.5);
      
      warning.slice(0, 3).forEach(alert => {
        const message = alert.body?.message || alert._source?.message || 'Alerte importante detectee';
        
        doc.roundedRect(50, doc.y, 495, 40, 6)
           .fill('#fffbeb');
        
        doc.fontSize(9)
           .fillColor('#1e293b')
           .font('Helvetica')
           .text(message, 70, doc.y + 12, { width: 455 });
        
        doc.moveDown(2.5);
      });
    }

    doc.moveDown(1);
  }

  private addMaintenanceSection(doc: PDFKit.PDFDocument, data: ReportData) {
    if (doc.y > 600) {
      doc.addPage();
      doc.y = 50;
    }
    
    doc.fontSize(16)
       .fillColor('#1e293b')
       .font('Helvetica-Bold')
       .text('INTERVENTIONS DE MAINTENANCE', 50, doc.y);
    
    doc.moveDown(0.5);
    doc.strokeColor('#e2e8f0').lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    if (data.maintenances.length === 0) {
      doc.fontSize(10)
         .fillColor('#64748b')
         .font('Helvetica')
         .text('Aucune maintenance effectuee durant cette periode', 50, doc.y);
      doc.moveDown(2);
      return;
    }

    data.maintenances.slice(0, 10).forEach((maint, i) => {
      const type = maint.type_intervention || maint.body?.type_intervention || 'Intervention de maintenance';
      const date = maint.date_intervention || maint.body?.date_intervention;
      const filtre = maint.id_filtre || maint.body?.id_filtre;
      const duree = maint.duree_minutes || maint.body?.duree_minutes;
      
      doc.roundedRect(50, doc.y, 495, 65, 6)
         .lineWidth(1)
         .strokeColor('#e2e8f0')
         .fillAndStroke('#f8fafc', '#e2e8f0');
      
      doc.fontSize(11)
         .fillColor('#1e293b')
         .font('Helvetica-Bold')
         .text(`${i + 1}. ${type}`, 70, doc.y + 12);
      
      doc.fontSize(9)
         .fillColor('#64748b')
         .font('Helvetica');
      
      if (date) {
        doc.text(`Date: ${this.formatDate(date)}`, 70, doc.y + 30);
      }
      
      if (filtre) {
        doc.text(`Filtre: ${filtre}`, 250, doc.y + 30);
      }
      
      if (duree) {
        doc.text(`Duree: ${duree} min`, 400, doc.y + 30);
      }
      
      doc.moveDown(4);
    });
  }

  private addRecommendations(doc: PDFKit.PDFDocument, recommendations: any[]) {
    doc.fontSize(16)
       .fillColor('#1e293b')
       .font('Helvetica-Bold')
       .text('RECOMMANDATIONS', 50, 50);
    
    doc.moveDown(0.5);
    doc.strokeColor('#e2e8f0').lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    recommendations.forEach((rec, i) => {
      const bgColor = rec.priority === 'high' ? '#fef2f2' : '#fffbeb';
      const borderColor = rec.priority === 'high' ? '#dc2626' : '#f59e0b';
      const titleColor = rec.priority === 'high' ? '#dc2626' : '#f59e0b';
      
      doc.roundedRect(50, doc.y, 495, 90, 8)
         .lineWidth(2)
         .strokeColor(borderColor)
         .fillAndStroke(bgColor, borderColor);
      
      doc.fontSize(12)
         .fillColor(titleColor)
         .font('Helvetica-Bold')
         .text(`${i + 1}. ${rec.title}`, 70, doc.y + 15, { width: 455 });
      
      doc.fontSize(10)
         .fillColor('#1e293b')
         .font('Helvetica')
         .text(rec.description, 70, doc.y + 40, { width: 455 });
      
      doc.moveDown(6);
    });
  }

  private addNoDataMessage(doc: PDFKit.PDFDocument, section: string) {
    doc.roundedRect(50, doc.y, 495, 50, 8)
       .fill('#f1f5f9');
    
    doc.fontSize(11)
       .fillColor('#64748b')
       .font('Helvetica')
       .text(`Aucune donnee de ${section} disponible pour cette periode`, 70, doc.y + 18, {
         width: 455,
         align: 'center'
       });
    
    doc.moveDown(4);
  }

  private addPageNumbers(doc: PDFKit.PDFDocument) {
    const pages = doc.bufferedPageRange();
    
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      
      const pageNum = i + 1;
      const totalPages = pages.count;
      
      // Ligne de séparation
      doc.strokeColor('#e2e8f0')
         .lineWidth(1)
         .moveTo(50, doc.page.height - 60)
         .lineTo(545, doc.page.height - 60)
         .stroke();
      
      // Texte du footer
      doc.fontSize(8)
         .fillColor('#94a3b8')
         .font('Helvetica')
         .text(
           `Eco-Stations - Rapport genere le ${this.formatDate(new Date().toISOString())}`,
           50,
           doc.page.height - 45,
           { align: 'left', width: 250 }
         );
      
      doc.text(
        `Page ${pageNum} / ${totalPages}`,
        295,
        doc.page.height - 45,
        { align: 'right', width: 250 }
      );
    }
  }

  private calculateStats(data: ReportData) {
    const wq = data.waterQuality;
    const total = wq.length;
    
    if (total === 0) {
      return {
        totalMeasurements: 0,
        avgPH: 0,
        avgDBO5: 0,
        avgDCO: 0,
        criticalAlerts: data.alerts.filter(a => a.body?.level === 'critical').length,
        completedMaintenances: data.maintenances.length,
        complianceRate: 0
      };
    }
    
    const avgPH = wq.reduce((s, d) => s + (d.body?.ph || 0), 0) / total;
    const avgDBO5 = wq.reduce((s, d) => s + (d.body?.dbo5_mg_l || 0), 0) / total;
    const avgDCO = wq.reduce((s, d) => s + (d.body?.dco_mg_l || 0), 0) / total;
    const conforme = wq.filter(d => d.body?.ph >= 6.5 && d.body?.ph <= 8.5).length;
    
    return {
      totalMeasurements: total,
      avgPH,
      avgDBO5,
      avgDCO,
      criticalAlerts: data.alerts.filter(a => a.body?.level === 'critical').length,
      completedMaintenances: data.maintenances.length,
      complianceRate: Math.round((conforme / total) * 100)
    };
  }

  private analyzeWaterQuality(waterQuality: any[]) {
    if (waterQuality.length === 0) return [];
    
    const entree = waterQuality.filter(d => d.body?.phase === 'Entrée' || d.body?.phase === 'Entree');
    const sortie = waterQuality.filter(d => d.body?.phase === 'Sortie');
    
    const avg = (arr: any[], field: string) => {
      const values = arr.map(d => d.body?.[field]).filter(v => v != null && v > 0);
      return values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : null;
    };
    
    const calcRendement = (e: string | null, s: string | null) => {
      if (!e || !s) return null;
      const entVal = parseFloat(e);
      const sortVal = parseFloat(s);
      if (entVal === 0 || isNaN(entVal) || isNaN(sortVal)) return null;
      return Math.round(((entVal - sortVal) / entVal) * 100);
    };
    
    const params = [
      { field: 'ph', name: 'pH', unit: '' },
      { field: 'dbo5_mg_l', name: 'DBO5', unit: ' mg/L' },
      { field: 'dco_mg_l', name: 'DCO', unit: ' mg/L' },
      { field: 'mes_mg_l', name: 'MES', unit: ' mg/L' },
      { field: 'nitrates_mg_l', name: 'Nitrates', unit: ' mg/L' },
      { field: 'phosphates_mg_l', name: 'Phosphates', unit: ' mg/L' }
    ];
    
    return params
      .map(p => {
        const e = avg(entree, p.field);
        const s = avg(sortie, p.field);
        return {
          name: p.name,
          entree: e ? `${e}${p.unit}` : null,
          sortie: s ? `${s}${p.unit}` : null,
          rendement: p.field === 'ph' ? null : calcRendement(e, s)
        };
      })
      .filter(p => p.entree || p.sortie);
  }

  private getParameterStatus(param: any): string {
    if (param.rendement === null) return 'N/A';
    if (param.rendement >= 80) return 'Conforme';
    if (param.rendement >= 60) return 'Attention';
    return 'Non conforme';
  }

  private generateSmartRecommendations(data: ReportData) {
    const recs: any[] = [];
    const stats = this.calculateStats(data);
    
    if (stats.criticalAlerts > 3) {
      recs.push({
        priority: 'high',
        title: 'Nombre eleve d\'alertes critiques',
        description: `${stats.criticalAlerts} alertes critiques detectees durant la periode. Une inspection approfondie du systeme est fortement recommandee pour identifier et corriger les causes recurrentes.`
      });
    }
    
    if (stats.complianceRate < 70 && stats.totalMeasurements > 0) {
      recs.push({
        priority: 'high',
        title: 'Taux de conformite insuffisant',
        description: `Le taux de conformite actuel est de ${stats.complianceRate}%, ce qui est en dessous du seuil acceptable de 80%. Verifier les parametres de traitement et envisager des ajustements techniques.`
      });
    }
    
    if (data.maintenances.length === 0) {
      recs.push({
        priority: 'medium',
        title: 'Maintenance preventive recommandee',
        description: 'Aucune maintenance n\'a ete effectuee durant cette periode. Il est recommande de planifier une inspection de routine pour garantir le bon fonctionnement des equipements.'
      });
    }
    
    if (stats.totalMeasurements < 7 && data.waterQuality.length > 0) {
      recs.push({
        priority: 'medium',
        title: 'Frequence de mesure insuffisante',
        description: 'Le nombre de mesures effectuees est inferieur aux standards recommandes (minimum 1 par jour). Augmenter la frequence de prise de mesures pour un meilleur suivi.'
      });
    }
    
    return recs;
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit',
      month: 'long', 
      year: 'numeric' 
    });
  }

  private formatDateForFile(dateString: string): string {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  }
}

export { ReportService };