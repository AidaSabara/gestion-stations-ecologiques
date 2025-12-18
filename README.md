# Gestion des Stations Écologiques

Système de gestion et de surveillance en temps réel des stations de surveillance environnementale.

## 📋 Description

Application web permettant de gérer et surveiller des stations écologiques équipées de capteurs pour mesurer divers paramètres environnementaux (qualité de l'eau, température, etc.).

## ✨ Fonctionnalités

- 📊 **Tableau de bord en temps réel** : Visualisation des données des capteurs
- 🗺️ **Cartographie des stations** : Localisation géographique des stations
- 🔔 **Système d'alertes** : Notifications automatiques en cas de dépassement de seuils
- 📈 **Analyse de données** : Graphiques et statistiques sur les mesures
- 🔄 **Monitoring en temps réel** : Surveillance continue des capteurs
- 📧 **Service d'email** : Notifications par email

## 🛠️ Technologies utilisées

### Frontend
- Angular
- TypeScript
- CSS

### Backend
- Kuzzle (backend en temps réel)
- Node.js
- Service d'email personnalisé

### Base de données
- Elasticsearch (via Kuzzle)
- **11 collections** dans l'index `iot` :
  - `users` - Utilisateurs de l'application
  - `reading` - Lectures des capteurs
  - `alerts` - Alertes actives
  - `cycle-vie` - Cycle de vie des équipements
  - `events` - Événements système
  - `filtres` - Filtres de recherche
  - `maintenance_interventions` - Interventions de maintenance
  - `stations` - Stations de surveillance
  - `water_quality` - Qualité de l'eau
  - `users-activity-logs` - Logs d'activité
  - `historique_alerts` - Historique des alertes

## 📦 Installation Complète

### Prérequis

Avant de commencer, assurez-vous d'avoir installé :

- **Node.js** (version 18 ou supérieure) - [Télécharger](https://nodejs.org/)
- **npm** (inclus avec Node.js)
- **Docker** et **Docker Compose** - [Télécharger Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Git** - [Télécharger](https://git-scm.com/)

Pour vérifier vos installations :
```bash
node --version    # Doit afficher v18.x ou supérieur
npm --version     # Doit afficher 8.x ou supérieur
docker --version  # Doit afficher 20.x ou supérieur
git --version
```

### 🚀 Utilisation Rapide (5 étapes)

#### **Étape 1 : Cloner le projet**

```bash
git clone https://github.com/AidaSabara/gestion-stations-ecologiques.git
cd gestion-stations-ecologiques
```

#### **Étape 2 : Lancer le backend Kuzzle**

```bash
cd playground
docker-compose up -d
```

**⏱️ Attendez 30 secondes** que tous les services démarrent (Kuzzle, Redis, Elasticsearch).

Vérifiez que tout fonctionne :
```bash
docker-compose ps
# Tous les services doivent être "Up" et "healthy"
```

#### **Étape 3 : Importer les données**

```bash
# Toujours depuis le dossier playground
npm install

# Importer les 287 documents dans les 11 collections
node scripts/import-kuzzle-data.js
```

Vous devriez voir :
```
✅ Connecté à Kuzzle
📥 Import de users...
📥 Import de reading...
...
✅ Import terminé !
```

Vérifiez l'import :
```bash
# Vérifier que Kuzzle répond
curl http://localhost:7512

# Devrait afficher une réponse JSON de Kuzzle
```

#### **Étape 4 : Lancer le serveur backend**

⚠️ **IMPORTANT** : Le backend doit être lancé AVANT le frontend pour que l'authentification fonctionne.

```bash
# Depuis la racine du projet
cd backend
npm install
npm run dev
```

Le serveur backend démarre sur le **port 8080**. Vous devriez voir :
```
🚀 Serveur démarré sur le port 8080
✅ Système de reporting initialisé
```

#### **Étape 5 : Lancer l'application Angular**

```bash
# Aller dans le dossier frontend
cd frontend

# Installer les dépendances
npm install

# Lancer l'application
ng serve
```

**🎉 L'application est prête !** Ouvrez votre navigateur sur : **http://localhost:4200**

### 🔐 Connexion à l'application

L'application nécessite une authentification. Utilisez l'un des comptes de test suivants :

**Compte administrateur 1 :**
- **Email** : `samb.aida-sabara@ugb.edu.sn`
- **Mot de passe** : `super123`

**Compte administrateur 2 :**
- **Email** : `aidasabara1111@gmail.com`
- **Mot de passe** : `admin123`

⚠️ **Note** : Seuls les utilisateurs enregistrés dans la collection `users` de Kuzzle peuvent se connecter. Les identifiants ci-dessus correspondent à des utilisateurs présents dans le backup importé.

### 🔧 Services Optionnels

#### Service Email (port 3000)

Le service email permet d'envoyer des notifications par email lors des alertes.

```bash
cd email-service
npm install
node server.js
```

Vous devriez voir :
```
╔════════════════════════════════════╗
║  🚀 Serveur Email Démarré         ║
║  📡 Port: 3000                    ║
║  🌐 URL: http://localhost:3000    ║
╚════════════════════════════════════╝
```

⚠️ **Note** : Le service email est préconfiguré et fonctionnel. Aucune configuration supplémentaire n'est nécessaire pour les tests.

#### Simulateur de Capteurs

Le simulateur génère automatiquement des données de capteurs pour tester l'application en temps réel.

```bash
# Depuis un nouveau terminal
cd playground/scripts
npm install  # Si nécessaire
node simulator.js
```

Le simulateur envoie des données toutes les 30 secondes pour 2 stations par défaut :
```
✅ Connecté à Kuzzle
🟢 Démarrage du simulateur (intervalle: 30s)
📍 Stations: station-dakar-0, station-dakar-1
📊 Lecture envoyée pour station-dakar-0
   → Temp: 38.9°C, Hum: 71.5%, AQI: 17.09
```

**Configuration personnalisée** :
```bash
# Intervalle de 10 secondes
INTERVAL=10 node simulator.js

# Stations spécifiques
STATIONS=station-dakar-0,station-dakar-1,station-dakar-2 node simulator.js

# Les deux
INTERVAL=15 STATIONS=station-dakar-0 node simulator.js
```

Pour arrêter : `Ctrl + C`

## 🧪 Vérification de l'installation

### Backend Kuzzle

```bash
# Test de l'API Kuzzle
curl http://localhost:7512/_healthcheck

# Devrait retourner : {"status":"ok"}
```

Ou ouvrez dans votre navigateur : http://localhost:7512

### Frontend Angular

1. Ouvrez http://localhost:4200
2. Vous devriez voir le tableau de bord
3. La connexion à Kuzzle se fait automatiquement
4. Les données des stations et capteurs s'affichent

### Ports utilisés

Assurez-vous que ces ports sont disponibles :

- **4200** : Application Angular (frontend)
- **8080** : Serveur backend Node.js
- **7512** : API Kuzzle
- **7511** : WebSocket Kuzzle
- **6379** : Redis
- **9200** : Elasticsearch
- **3000** : Service email (optionnel)

## 🛑 Arrêter l'application

### Arrêter dans l'ordre inverse

**1. Arrêter le simulateur** (si lancé)
Dans le terminal où `node simulator.js` est lancé : `Ctrl + C`

**2. Arrêter le service email** (si lancé)
Dans le terminal où `node server.js` est lancé : `Ctrl + C`

**3. Arrêter le frontend**
Dans le terminal où `ng serve` est lancé : `Ctrl + C`

**4. Arrêter le backend**
Dans le terminal où `npm run dev` est lancé : `Ctrl + C`

**5. Arrêter Kuzzle et Docker**
```bash
cd playground
docker-compose down

# Pour supprimer aussi les données (⚠️ attention)
docker-compose down -v
```

## 🐛 Dépannage

### Erreur "Port already in use"

Un port est déjà utilisé par un autre processus.

**Sur Linux/Mac :**
```bash
# Trouver le processus sur le port 7512
lsof -i :7512

# Arrêter le processus
kill -9 [PID]
```

**Sur Windows :**
```bash
netstat -ano | findstr :7512
taskkill /PID [PID] /F
```

### Docker ne démarre pas

```bash
# Voir les logs d'erreur
docker-compose logs

# Redémarrer proprement
docker-compose down
docker-compose up -d
```

### L'application Angular ne se connecte pas

Vérifiez que Kuzzle est bien démarré :
```bash
curl http://localhost:7512
```

Vérifiez la configuration de connexion dans `frontend/src/environments/environment.ts` :
```typescript
kuzzleUrl: 'http://localhost:7512'
```

### Les données ne s'affichent pas

1. Vérifiez que l'import a réussi :
```bash
# Depuis le dossier playground
node scripts/import-kuzzle-data.js
```

2. Vérifiez les collections dans Kuzzle :
Ouvrez http://localhost:7512 dans votre navigateur

3. Vérifiez la console du navigateur (F12) pour voir les erreurs

## 📁 Structure du projet

```
gestion-stations-ecologiques/
├── frontend/                    # Application Angular
│   ├── src/
│   │   ├── app/
│   │   │   ├── pages/          # Pages de l'application
│   │   │   ├── models/         # Modèles TypeScript
│   │   │   └── services/       # Services Angular
│   └── package.json
├── backend/                     # Backend Kuzzle (optionnel)
│   └── plugins/
├── email-service/              # Service de notifications
│   ├── src/
│   └── package.json
├── playground/                 # Configuration Docker
│   ├── docker-compose.yml      # Configuration des services
│   ├── Dockerfile             # Image Kuzzle personnalisée
│   ├── kuzzle-backup/         # Backup des données (287 documents)
│   │   └── data.json          # Données exportées
│   └── scripts/
│       ├── export-kuzzle-data.js  # Script d'export
│       └── import-kuzzle-data.js  # Script d'import
└── README.md
```

## 📊 Base de données

L'application utilise **Kuzzle** avec **11 collections** contenant **287 documents** au total dans l'index `iot`.

### Réexporter les données (si besoin)

```bash
cd playground
node scripts/export-kuzzle-data.js
# Crée un nouveau fichier kuzzle-backup/data.json
```

### Réimporter les données

```bash
cd playground
node scripts/import-kuzzle-data.js
```

## 🚀 Utilisation de l'application

Une fois tous les services lancés :

1. **Ouvrez votre navigateur** sur http://localhost:4200
2. **Connectez-vous** avec un des comptes fournis
3. **Tableau de bord** : Visualisation en temps réel des données des capteurs
4. **Cartographie** : Localisation des stations sur une carte interactive
5. **Alertes** : Configuration et historique des alertes
6. **Stations** : Gestion des stations (ajout, modification, suppression)
7. **Analyse** : Graphiques et tendances sur les données collectées

### 🎮 Tester l'application en temps réel

Pour voir l'application en action avec des données en temps réel :

1. **Lancez le simulateur** (dans un terminal séparé) :
   ```bash
   cd playground/scripts
   node simulator.js
   ```

2. **Retournez sur l'application** (http://localhost:4200)

3. **Observez les données se mettre à jour** toutes les 30 secondes dans le tableau de bord

4. **Testez les alertes** :
   - Les alertes se déclenchent automatiquement quand les seuils sont dépassés
   - Si le service email est lancé, vous recevrez des notifications par email

### 📧 Tester le service email

1. **Lancez le service email** (dans un terminal séparé) :
   ```bash
   cd email-service
   node server.js
   ```

2. **Configurez une alerte** dans l'application avec un seuil bas

3. **Attendez que le simulateur génère des données** qui dépassent le seuil

4. **Vérifiez** que vous avez reçu un email à `samb.aida-sabara@ugb.edu.sn`

## 📧 Contact et Support

**Auteur** : Aida Sabara  
**GitHub** : [@AidaSabara](https://github.com/AidaSabara)

En cas de problème lors de l'installation, n'hésitez pas à me contacter.

## 📝 Notes importantes

- **Ordre de démarrage obligatoire** : 
  1. ⚠️ **D'ABORD** Kuzzle (docker-compose)
  2. ⚠️ **PUIS** Backend (npm run dev)
  3. ⚠️ **ENFIN** Frontend (ng serve)
  4. Optionnel : Service email et Simulateur (n'importe quand après Kuzzle)
- **Authentification requise** : L'application nécessite une connexion avec un compte enregistré dans Kuzzle
- **Première installation** : Comptez environ 5-10 minutes pour que Docker télécharge toutes les images nécessaires
- **Import des données** : Le script d'import prend environ 30 secondes pour importer les 287 documents (incluant les utilisateurs)
- **Simulateur de capteurs** : Génère des données réalistes toutes les 30 secondes (intervalle configurable)
- **Service email** : Préconfiguré et prêt à l'emploi, envoie des notifications à `samb.aida-sabara@ugb.edu.sn`
- **Mode développement** : L'application Angular se recharge automatiquement à chaque modification du code

## 📄 License

Ce projet est sous licence MIT

---

**Dernière mise à jour** : Décembre 2025
**Version** : 1.0.0