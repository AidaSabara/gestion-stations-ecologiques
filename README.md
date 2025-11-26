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

## 📦 Installation

### Prérequis
- Node.js (version 16+)
- npm ou yarn
- Docker (pour Kuzzle)

### Étapes d'installation

1. **Cloner le projet**
```bash
git clone https://github.com/AidaSabara/gestion-stations-ecologiques.git
cd gestion-stations-ecologiques
```

2. **Installer les dépendances du frontend**
```bash
cd frontend
npm install
```

3. **Lancer Kuzzle avec Docker**
```bash
cd playground
docker-compose up -d
```

4. **Initialiser la base de données**
```bash
npm run seed
```

5. **Lancer le service d'email (optionnel)**
```bash
cd email-service
npm install
npm start
```

6. **Lancer l'application frontend**
```bash
cd frontend
ng serve
```

L'application sera accessible sur `http://localhost:4200`

## 🚀 Utilisation

1. Accédez à l'application via votre navigateur
2. Consultez la liste des stations
3. Visualisez les données en temps réel
4. Configurez des alertes personnalisées
5. Analysez les tendances via les graphiques

## 📁 Structure du projet

```
gestion-stations-ecologiques/
├── frontend/              # Application Angular
│   ├── src/
│   │   ├── app/
│   │   │   ├── pages/    # Composants des pages
│   │   │   ├── models/   # Modèles de données
│   │   │   └── services/ # Services
├── backend/              # Backend Kuzzle
│   └── plugins/
├── email-service/        # Service de notification
├── playground/           # Configuration Docker & seed
└── README.md
```

## 🔧 Configuration

### Variables d'environnement

Créez un fichier `.env` dans le dossier `email-service` :
```env
SMTP_HOST=votre-serveur-smtp
SMTP_PORT=587
SMTP_USER=votre-email
SMTP_PASS=votre-mot-de-passe
```

### Configuration Kuzzle

Modifiez le fichier `playground/.kuzzlerc` selon vos besoins.


## 📝 License

Ce projet est sous licence [MIT](LICENSE)

## 👥 Auteur

**Aida Sabara**
- GitHub: [@AidaSabara](https://github.com/AidaSabara)

