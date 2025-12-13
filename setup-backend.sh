#!/bin/bash

# Script de création automatique de la structure backend
# À exécuter depuis : /home/ser/gestion-stations-ecologiques

echo "🚀 ========================================"
echo "🚀 Création de la structure Backend"
echo "🚀 ========================================"

# Vérifier qu'on est dans le bon dossier
if [[ ! -d "playground" ]] || [[ ! -d "frontend" ]]; then
    echo "❌ Erreur : Ce script doit être exécuté depuis /home/ser/gestion-stations-ecologiques"
    exit 1
fi

# Créer la structure de dossiers
echo "📁 Création des dossiers..."
mkdir -p backend/src/{utils,services,middlewares,routes,scripts}
echo "✅ Dossiers créés"

# ============================================
# 1. Créer tsconfig.json
# ============================================
echo "📝 Création de tsconfig.json..."
cat > backend/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF
echo "✅ tsconfig.json créé"

# ============================================
# 2. Créer .env
# ============================================
echo "📝 Création de .env..."
cat > backend/.env << 'EOF'
# Kuzzle
KUZZLE_HOST=localhost
KUZZLE_PORT=7512

# JWT Configuration
JWT_SECRET=eco_stations_jwt_secret_super_securise_changez_moi_en_production_2025
JWT_EXPIRATION=24h
JWT_REFRESH_SECRET=eco_stations_refresh_secret_super_securise_changez_moi_aussi_2025
JWT_REFRESH_EXPIRATION=7d

# Security
BCRYPT_ROUNDS=12

# Server
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:4200
EOF
echo "✅ .env créé"

# ============================================
# 3. Créer package.json
# ============================================
echo "📝 Création de package.json..."
cat > backend/package.json << 'EOF'
{
  "name": "eco-stations-backend",
  "version": "1.0.0",
  "description": "Backend API pour la gestion des stations écologiques",
  "main": "dist/server.js",
  "scripts": {
    "dev": "nodemon --exec ts-node src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "migrate:passwords": "ts-node src/scripts/migrate-passwords.ts",
    "seed": "ts-node ../playground/seed-kuzzle.ts"
  },
  "keywords": ["eco", "stations", "kuzzle", "jwt", "api"],
  "author": "",
  "license": "MIT"
}
EOF
echo "✅ package.json créé"

# ============================================
# 4. Créer .gitignore
# ============================================
echo "📝 Création de .gitignore..."
cat > backend/.gitignore << 'EOF'
# Dependencies
node_modules/
package-lock.json

# Build
dist/
*.js.map

# Environment
.env
.env.local
.env.production

# Logs
logs/
*.log
npm-debug.log*

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
EOF
echo "✅ .gitignore créé"

# ============================================
# 5. Créer server.ts
# ============================================
echo "📝 Création de server.ts..."
cat > backend/src/server.ts << 'EOF'
// backend/src/server.ts
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARES GLOBAUX
// ============================================

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

if (process.env.NODE_ENV === 'development') {
  app.use((req: Request, res: Response, next) => {
    console.log(`📨 ${req.method} ${req.path}`);
    next();
  });
}

// ============================================
// ROUTES
// ============================================

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'API Eco-Stations opérationnelle',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

app.use('/api/auth', authRoutes);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
    path: req.path
  });
});

app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('❌ Erreur serveur:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erreur interne du serveur',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================
app.listen(PORT, () => {
  console.log('🚀 ========================================');
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`🌍 Environnement: ${process.env.NODE_ENV}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
  console.log('🚀 ========================================');
});

export default app;
EOF
echo "✅ server.ts créé"

# ============================================
# 6. Créer password.util.ts
# ============================================
echo "📝 Création de password.util.ts..."
cat > backend/src/utils/password.util.ts << 'EOF'
import * as bcrypt from 'bcrypt';

export class PasswordUtil {
  private static readonly SALT_ROUNDS = 12;

  static async hash(plainPassword: string): Promise<string> {
    try {
      const salt = await bcrypt.genSalt(this.SALT_ROUNDS);
      const hashedPassword = await bcrypt.hash(plainPassword, salt);
      console.log('✅ Mot de passe hashé avec succès');
      return hashedPassword;
    } catch (error) {
      console.error('❌ Erreur lors du hashing:', error);
      throw new Error('Erreur lors du hashing du mot de passe');
    }
  }

  static async verify(plainPassword: string, hashedPassword: string): Promise<boolean> {
    try {
      const isValid = await bcrypt.compare(plainPassword, hashedPassword);
      console.log(`🔍 Vérification mot de passe: ${isValid ? '✅' : '❌'}`);
      return isValid;
    } catch (error) {
      console.error('❌ Erreur lors de la vérification:', error);
      return false;
    }
  }

  static checkStrength(password: string): {
    isValid: boolean;
    score: number;
    messages: string[];
  } {
    const messages: string[] = [];
    let score = 0;

    if (password.length < 8) {
      messages.push('Le mot de passe doit contenir au moins 8 caractères');
    } else {
      score += 25;
    }

    if (/[A-Z]/.test(password)) {
      score += 25;
    } else {
      messages.push('Ajoutez des lettres majuscules');
    }

    if (/[a-z]/.test(password)) {
      score += 25;
    } else {
      messages.push('Ajoutez des lettres minuscules');
    }

    if (/[0-9]/.test(password)) {
      score += 15;
    } else {
      messages.push('Ajoutez des chiffres');
    }

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score += 10;
    } else {
      messages.push('Ajoutez des caractères spéciaux (!@#$%...)');
    }

    return {
      isValid: score >= 75,
      score,
      messages
    };
  }

  static generateTemporaryPassword(): string {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }
    
    return password;
  }
}
EOF
echo "✅ password.util.ts créé"

echo ""
echo "🎉 ========================================"
echo "🎉 Structure Backend créée avec succès !"
echo "🎉 ========================================"
echo ""
echo "📋 Prochaines étapes :"
echo ""
echo "1️⃣  Aller dans le dossier backend :"
echo "   cd backend"
echo ""
echo "2️⃣  Installer les dépendances :"
echo "   npm install"
echo ""
echo "3️⃣  Créer les fichiers restants (jwt.util.ts, auth.service.ts, etc.)"
echo "   Utilisez les commandes individuelles ci-dessous"
echo ""
echo "4️⃣  Démarrer le serveur :"
echo "   npm run dev"
echo ""
