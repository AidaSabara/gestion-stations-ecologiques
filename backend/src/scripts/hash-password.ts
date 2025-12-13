// src/scripts/hash-password.ts
import { PasswordUtil } from '../utils/password.util';

/**
 * Script pour générer un hash de mot de passe
 * Usage: ts-node src/scripts/hash-password.ts "motdepasse"
 */
async function hashPassword(password: string): Promise<void> {
  try {
    console.log('🔐 Génération du hash bcrypt (12 rounds)...');
    console.log('📝 Mot de passe:', password);
    console.log('⏳ Patience...\n');

    const hash = await PasswordUtil.hash(password);

    console.log('✅ Hash généré!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 HASH À COPIER:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(hash);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('💡 UTILISATION:');
    console.log('Copiez ce hash dans le champ "password" de votre document Kuzzle.\n');

    console.log('📝 EXEMPLE DE DOCUMENT ADMIN:');
    console.log(JSON.stringify({
      name: 'Admin',
      email: 'admin@example.com',
      password: hash,
      role: 'admin',
      station_id: 'admin-station',
      station_name: 'Administration',
      permissions: {
        canAccessAlerts: true,
        canAccessGraphs: true,
        canAccessFilters: true,
        canAccessData: true,
        canManageUsers: true
      },
      phone: '+221 77 000 00 00',
      department: 'IT',
      position: 'Administrator',
      active: true,
      createdAt: new Date().toISOString(),
      lastLogin: null
    }, null, 2));
    console.log('\n');

    // Vérification
    const isValid = await PasswordUtil.verify(password, hash);
    console.log('🔍 Vérification:', isValid ? '✅ OK' : '❌ ERREUR');

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

const password = process.argv[2];

if (!password) {
  console.error('❌ Usage: ts-node src/scripts/hash-password.ts "votreMotDePasse"');
  console.log('\nExemple:');
  console.log('  ts-node src/scripts/hash-password.ts "admin123"');
  process.exit(1);
}

hashPassword(password);