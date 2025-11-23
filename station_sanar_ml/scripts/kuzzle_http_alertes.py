"""
Surveillance avec Kuzzle via API HTTP
Station Sanar - Système d'Alertes - Version Autonome
"""

import requests
import json
from datetime import datetime
import time
import sys

# ==================================================
# CONFIGURATION DES SEUILS (INTÉGRÉE DIRECTEMENT)
# ==================================================

# Copie complète de config_seuils.py intégrée ici
SEUILS_REJET = {
    'dco_mg_l': 125,              # DCO (Demande Chimique en Oxygène)
    'dbo5_mg_l': 25,              # DBO5 (Demande Biologique en Oxygène)
    'mes_mg_l': 30,               # MES (Matières En Suspension)
    'ammonium_mg_l': 10,          # Ammonium NH4+
    'nitrates_mg_l': 50,          # Nitrates NO3-
    'azote_total_mg_l': 15,       # Azote total
    'phosphates_mg_l': 2,         # Phosphates PO4
    'coliformes_fecaux_cfu_100ml': 10000,  # Coliformes fécaux
    'ph_min': 6.5,                # pH minimum
    'ph_max': 8.5,                # pH maximum
}

NIVEAUX_ALERTE = {
    'CONFORME': {
        'seuil': 0.8, 'couleur': 'green', 'icone': '🟢', 'priorite': 0,
        'action': 'Aucune action requise'
    },
    'ATTENTION': {
        'seuil': 1.0, 'couleur': 'yellow', 'icone': '🟡', 'priorite': 1,
        'action': 'Surveillance renforcée'
    },
    'ALERTE': {
        'seuil': 1.5, 'couleur': 'orange', 'icone': '🔴', 'priorite': 2,
        'action': 'Intervention recommandée sous 24h'
    },
    'CRITIQUE': {
        'seuil': float('inf'), 'couleur': 'red', 'icone': '⚠️', 'priorite': 3,
        'action': 'INTERVENTION IMMÉDIATE REQUISE'
    }
}

SEUILS_SPECIFIQUES_FILTRES = {
    'FV1': {'use_general': True, 'overrides': {}},
    'FV2': {'use_general': True, 'overrides': {}},
    'FH': {'use_general': True, 'overrides': {}}
}

# Fonctions de configuration intégrées
def get_seuil(parametre, filtre='general'):
    if filtre in SEUILS_SPECIFIQUES_FILTRES:
        config_filtre = SEUILS_SPECIFIQUES_FILTRES[filtre]
        if not config_filtre.get('use_general', True):
            return config_filtre.get('overrides', {}).get(parametre)
        if 'overrides' in config_filtre and parametre in config_filtre['overrides']:
            return config_filtre['overrides'][parametre]
    return SEUILS_REJET.get(parametre)

def determiner_niveau_alerte(valeur, seuil):
    if seuil is None or seuil == 0:
        return 'CONFORME'
    ratio = valeur / seuil
    for niveau in ['CONFORME', 'ATTENTION', 'ALERTE', 'CRITIQUE']:
        if ratio <= NIVEAUX_ALERTE[niveau]['seuil']:
            return niveau
    return 'CRITIQUE'

def verifier_ph(ph_value):
    ph_min = SEUILS_REJET['ph_min']
    ph_max = SEUILS_REJET['ph_max']
    if ph_min <= ph_value <= ph_max:
        return True, 'CONFORME'
    if ph_value < ph_min:
        ecart = (ph_min - ph_value) / ph_min
    else:
        ecart = (ph_value - ph_max) / ph_max
    if ecart <= 0.05:
        return False, 'ATTENTION'
    elif ecart <= 0.15:
        return False, 'ALERTE'
    else:
        return False, 'CRITIQUE'

print("✅ Configuration des seuils intégrée avec succès")

# ==================================================
# CONFIGURATION KUZZLE
# ==================================================

KUZZLE_CONFIG = {
    'url': 'http://localhost:7512',
    'index': 'iot',
    'collections': {
        'input': 'water_quality',
        'alerts': 'alerts'
    }
}

# ==================================================
# CLASSE CLIENT KUZZLE HTTP
# ==================================================

class KuzzleHTTPClient:
    """Client HTTP simple pour Kuzzle"""
    
    def __init__(self, url):
        self.base_url = url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
    
    def _request(self, method, endpoint, data=None):
        """Effectuer une requête HTTP vers Kuzzle"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            if method == 'GET':
                response = self.session.get(url)
            elif method == 'POST':
                response = self.session.post(url, json=data)
            elif method == 'PUT':
                response = self.session.put(url, json=data)
            
            response.raise_for_status()
            return response.json()
        
        except requests.exceptions.ConnectionError:
            print(f"❌ Erreur de connexion à Kuzzle ({url})")
            print("💡 Vérifiez que Kuzzle est démarré")
            return None
        except requests.exceptions.HTTPError as e:
            print(f"❌ Erreur HTTP : {e}")
            return None
        except Exception as e:
            print(f"❌ Erreur : {e}")
            return None
    
    def ping(self):
        """Tester la connexion à Kuzzle"""
        result = self._request('GET', '/_serverInfo')
        return result is not None
    
    def search_documents(self, index, collection, query=None, size=100):
        """Rechercher des documents"""
        endpoint = f"/{index}/{collection}/_search"
        
        body = {
            "query": query or {"match_all": {}},
            "size": size
        }
        
        result = self._request('POST', endpoint, body)
        
        if result and 'result' in result:
            return result['result'].get('hits', [])
        return []
    
    def create_document(self, index, collection, document):
        """Créer un document"""
        endpoint = f"/{index}/{collection}"
        result = self._request('POST', endpoint, document)
        
        if result and 'result' in result:
            return result['result']
        return None

# ==================================================
# CLASSE PRINCIPALE
# ==================================================

class MoniteurHTTP:
    """Moniteur utilisant l'API HTTP de Kuzzle"""
    
    def __init__(self, config=KUZZLE_CONFIG):
        self.config = config
        self.client = KuzzleHTTPClient(config['url'])
        self.dernier_traitement = None
    
    def tester_connexion(self):
        """Tester la connexion à Kuzzle"""
        print("\n🔌 Test de connexion à Kuzzle...")
        print(f"   URL: {self.config['url']}")
        
        if self.client.ping():
            print("✅ Connexion réussie !\n")
            return True
        else:
            print("❌ Impossible de se connecter à Kuzzle")
            print("\n💡 Solutions :")
            print("   1. Vérifiez que Kuzzle est démarré")
            print("   2. Vérifiez l'URL dans KUZZLE_CONFIG")
            return False
    
    def analyser_document(self, doc):
        """Analyser un document et retourner le résultat"""
        
        source = doc.get('_source', doc)
        id_doc = doc.get('_id', 'unknown')
        
        id_station = source.get('id_station')
        id_filtre = source.get('id_filtre')
        phase = source.get('phase')
        
        if phase != 'Sortie':
            return None
        
        filtre_clean = id_filtre.rstrip('abc') if id_filtre else ''
        if 'FV1' in filtre_clean:
            groupe_filtre = 'FV1'
        elif 'FV2' in filtre_clean:
            groupe_filtre = 'FV2'
        elif 'FH' in filtre_clean:
            groupe_filtre = 'FH'
        else:
            groupe_filtre = 'general'
        
        depassements = []
        niveau_max = 'CONFORME'
        
        parametres = {
            'dco_mg_l': source.get('dco_mg_l'),
            'dbo5_mg_l': source.get('dbo5_mg_l'),
            'mes_mg_l': source.get('mes_mg_l'),
            'ammonium_mg_l': source.get('ammonium_mg_l'),
            'nitrates_mg_l': source.get('nitrates_mg_l'),
            'phosphates_mg_l': source.get('phosphates_mg_l'),
            'coliformes_fecaux_cfu_100ml': source.get('coliformes_fecaux_cfu_100ml')
        }
        
        for param, valeur in parametres.items():
            if valeur is None or valeur == '':
                continue
            
            try:
                valeur = float(valeur)
            except (ValueError, TypeError):
                continue
            
            seuil = get_seuil(param, groupe_filtre)
            if seuil is None:
                continue
            
            niveau = determiner_niveau_alerte(valeur, seuil)
            
            if niveau != 'CONFORME':
                depassement = {
                    'parametre': param,
                    'valeur': float(valeur),
                    'seuil': float(seuil),
                    'ratio': float(valeur / seuil),
                    'niveau': niveau
                }
                depassements.append(depassement)
                
                if NIVEAUX_ALERTE[niveau]['priorite'] > NIVEAUX_ALERTE[niveau_max]['priorite']:
                    niveau_max = niveau
        
        ph = source.get('ph')
        if ph is not None and ph != '':
            try:
                ph = float(ph)
                conforme_ph, niveau_ph = verifier_ph(ph)
                
                if not conforme_ph:
                    depassement_ph = {
                        'parametre': 'ph',
                        'valeur': float(ph),
                        'seuil': '6.5-8.5',
                        'ratio': None,
                        'niveau': niveau_ph
                    }
                    depassements.append(depassement_ph)
                    
                    if NIVEAUX_ALERTE[niveau_ph]['priorite'] > NIVEAUX_ALERTE[niveau_max]['priorite']:
                        niveau_max = niveau_ph
            except (ValueError, TypeError):
                pass
        
        resultat = {
            'document_id': id_doc,
            'id_station': id_station,
            'id_filtre': id_filtre,
            'groupe_filtre': groupe_filtre,
            'niveau_global': niveau_max,
            'conforme': niveau_max == 'CONFORME',
            'nombre_depassements': len(depassements),
            'depassements': depassements,
            'donnees_source': source
        }
        
        return resultat
    
    def analyser_collection(self):
        """Analyser tous les documents de sortie dans la collection"""
        print("\n🔍 Analyse de la collection Kuzzle...")
        print(f"   Index: {self.config['index']}")
        print(f"   Collection: {self.config['collections']['input']}\n")
        
        query = {"term": {"phase": "Sortie"}}
        
        docs = self.client.search_documents(
            self.config['index'],
            self.config['collections']['input'],
            query,
            size=1000
        )
        
        if not docs:
            print("⚠️  Aucun document trouvé")
            return
        
        print(f"✅ {len(docs)} document(s) trouvé(s)\n")
        print("-" * 70)
        
        alertes = []
        conformes = 0
        
        for doc in docs:
            resultat = self.analyser_document(doc)
            
            if resultat is None:
                continue
            
            icone = NIVEAUX_ALERTE[resultat['niveau_global']]['icone']
            print(f"{icone} {resultat['id_filtre']:10s} → {resultat['niveau_global']:10s}", end='')
            
            if resultat['conforme']:
                conformes += 1
                print(" ✓")
            else:
                print(f" ({resultat['nombre_depassements']} dépassement(s))")
                alertes.append(resultat)
                self.creer_alerte(resultat)
        
        print("-" * 70)
        print(f"\n📊 Résumé :")
        print(f"   Conformes: {conformes}")
        print(f"   Alertes: {len(alertes)}")
        
        if alertes:
            self.afficher_details_alertes(alertes)
    
    def creer_alerte(self, resultat):
        """Créer une alerte dans Kuzzle"""
        try:
            level_mapping = {
                'CONFORME': 'info',
                'ATTENTION': 'warning',
                'ALERTE': 'warning',
                'CRITIQUE': 'critical'
            }
            
            message = f"Dépassement de seuil détecté sur le filtre {resultat['id_filtre']}"
            if resultat['nombre_depassements'] > 0:
                depassements_list = [dep['parametre'].upper() for dep in resultat['depassements']]
                message += f" - Paramètres: {', '.join(depassements_list)}"
            
            premier_depassement = resultat['depassements'][0] if resultat['depassements'] else None
            
            alerte = {
                'stationId': resultat['id_station'],
                'type': 'seuil dépassé',
                'level': level_mapping.get(resultat['niveau_global'], 'warning'),
                'message': message,
                'timestamp': datetime.now().isoformat(),
                'resolved': False,
                'metadata': {
                    'id_filtre': resultat['id_filtre'],
                    'groupe_filtre': resultat['groupe_filtre'],
                    'severity_original': resultat['niveau_global'],
                    'nombre_depassements': resultat['nombre_depassements'],
                    'tous_depassements': resultat['depassements']
                }
            }
            
            result = self.client.create_document(
                self.config['index'],
                self.config['collections']['alerts'],
                alerte
            )
            
            if result:
                alert_id = result.get('_id')
                print(f"✅ Alerte créée: {alert_id}")
                return alert_id
            else:
                print(f"❌ Échec création alerte pour {resultat['id_filtre']}")
                return None
                
        except Exception as e:
            print(f"❌ Erreur création alerte: {e}")
            return None
    
    def afficher_details_alertes(self, alertes):
        """Afficher les détails des alertes"""
        print("\n" + "="*70)
        print("  🚨 DÉTAILS DES ALERTES")
        print("="*70 + "\n")
        
        for i, alerte in enumerate(alertes, 1):
            icone = NIVEAUX_ALERTE[alerte['niveau_global']]['icone']
            
            print(f"{icone} ALERTE #{i} - {alerte['niveau_global']}")
            print(f"   Filtre: {alerte['id_filtre']} ({alerte['groupe_filtre']})")
            print(f"   Dépassements:")
            
            for dep in alerte['depassements']:
                param = dep['parametre'].replace('_mg_l', '').replace('_cfu_100ml', '').upper()
                print(f"      • {param}: {dep['valeur']:.2f} (seuil: {dep['seuil']})", end='')
                if dep['ratio']:
                    print(f" - {dep['ratio']:.1%}")
                else:
                    print()
            
            print(f"   ⚠️  {NIVEAUX_ALERTE[alerte['niveau_global']]['action']}")
            print()
    
    def afficher_alertes_actives(self):
        """Afficher les alertes non résolues"""
        print("\n" + "="*70)
        print("  🚨 ALERTES ACTIVES (Non résolues)")
        print("="*70 + "\n")
        
        query = {"term": {"resolved": False}}
        
        alertes = self.client.search_documents(
            self.config['index'],
            self.config['collections']['alerts'],
            query
        )
        
        if not alertes:
            print("✅ Aucune alerte active\n")
            return
        
        print(f"Total: {len(alertes)} alerte(s)\n")
        
        for hit in alertes:
            source = hit['_source']
            timestamp = datetime.fromisoformat(source['timestamp'])
            
            niveau_alerte = source.get('level', 'warning')
            niveau_mapping = {'info': 'CONFORME', 'warning': 'ALERTE', 'critical': 'CRITIQUE'}
            niveau_corrige = niveau_mapping.get(niveau_alerte, 'ALERTE')
            icone = NIVEAUX_ALERTE[niveau_corrige]['icone']
            
            print(f"{icone} {niveau_alerte.upper()}")
            print(f"   Date: {timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"   Filtre: {source.get('metadata', {}).get('id_filtre', 'Inconnu')}")
            print(f"   Dépassements: {source.get('metadata', {}).get('nombre_depassements', 0)}")
            print()
    
    def surveillance_continue(self, intervalle=60):
        """Surveiller en continu (polling)"""
        print("\n🔄 MODE SURVEILLANCE CONTINUE")
        print(f"   Intervalle: {intervalle} secondes")
        print("   (Appuyez sur Ctrl+C pour arrêter)\n")
        
        try:
            while True:
                print(f"\n⏰ [{datetime.now().strftime('%H:%M:%S')}] Analyse en cours...")
                self.analyser_collection()
                print(f"\n💤 Attente de {intervalle}s...")
                time.sleep(intervalle)
        except KeyboardInterrupt:
            print("\n\n⏹️  Surveillance arrêtée")

# ==================================================
# FONCTION PRINCIPALE
# ==================================================

def main():
    print("\n" + "="*70)
    print("  🌊 SYSTÈME D'ALERTES - STATION SANAR")
    print("  Version Autonome (Sans dépendances externes)")
    print("="*70)
    
    moniteur = MoniteurHTTP()
    
    if not moniteur.tester_connexion():
        print("\n⚠️  Impossible de continuer sans connexion Kuzzle")
        return
    
    print("\n📋 MENU:")
    print("  1. Analyser la collection (une fois)")
    print("  2. Surveiller en continu (toutes les 60s)")
    print("  3. Afficher les alertes actives")
    print("  4. Quitter")
    
    choix = input("\nVotre choix (1-4): ").strip()
    
    if choix == "1":
        moniteur.analyser_collection()
    elif choix == "2":
        intervalle = input("Intervalle en secondes (défaut: 60): ").strip()
        intervalle = int(intervalle) if intervalle.isdigit() else 60
        moniteur.surveillance_continue(intervalle)
    elif choix == "3":
        moniteur.afficher_alertes_actives()
    else:
        print("\n👋 Au revoir !")

if __name__ == "__main__":
    main()