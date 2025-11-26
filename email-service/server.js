const express = require('express');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

// Autoriser Angular
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Configuration Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'aidasabara1111@gmail.com',        
    pass: 'yorm tjup wgpm fmsv'       
  }
});

// Route test
app.get('/', (req, res) => {
  res.json({ message: 'Serveur email OK' });
});

// Route d'envoi d'alerte
app.post('/send-alert', async (req, res) => {
  try {
    const { alert, stationName } = req.body;
    
    console.log('📧 Envoi email pour:', stationName);
    
    await transporter.sendMail({
      from: 'aidasabara1111@gmail.com',      
      to: 'samb.aida-sabara@ugb.edu.sn',     
      subject: `🚨 ALERTE ${alert.severity.toUpperCase()} - ${stationName}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #d32f2f;">🚨 Alerte Détectée</h2>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
            <p><strong>Station:</strong> ${stationName}</p>
            <p><strong>Type:</strong> ${alert.type}</p>
            <p><strong>Sévérité:</strong> <span style="color: #d32f2f;">${alert.severity}</span></p>
            <p><strong>Message:</strong> ${alert.message}</p>
            <p><strong>Heure:</strong> ${new Date(alert.timestamp).toLocaleString('fr-FR')}</p>
          </div>
        </div>
      `
    });
    
    res.json({ success: true, message: 'Email envoyé' });
    console.log('✅ Email envoyé avec succès');
    
  } catch (error) {
    console.error('❌ Erreur envoi email:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Démarrage
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════╗
║  🚀 Serveur Email Démarré         ║
║  📡 Port: ${PORT}                  ║
║  🌐 URL: http://localhost:${PORT} ║
╚════════════════════════════════════╝
  `);
});
