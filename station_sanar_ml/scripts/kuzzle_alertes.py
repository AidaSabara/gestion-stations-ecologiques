"""
Surveillance Temps Réel avec Kuzzle
Station Sanar - Système d'Alertes

Ce script :
1. Se connecte à Kuzzle
2. Écoute les nouvelles données dans la collection water_quality
3. Analyse automatiquement les sorties de filtres
4. Génère des alertes en temps réel si dépassement
5. Sauvegarde dans Kuzzle
"""

import asyncio
import json
from datetime import datetime
import sys
import os

# Importer la configuration
from config_seuils import (
    get_seuil,
    determiner_niveau_alerte,
    verifier_ph,
    NIVEAUX_ALERTE,
    ALERTE_CONFIG
)


try:
    from kuzzle import Kuzzle, WebSocket
except ImportError:
    print("❌ Module 'kuzzle' non trouvé.")
    print("📦 Installation : pip install kuzzle")
    sys.exit(1)


KUZZLE_CONFIG = {
    'host': 'localhost',        
    'port': 7512,
    'index': 'water-treatment',
    'collections': {
        'input': 'water_quality',           # Collection existante
        'alerts': 'water_quality_alerts'    # Nouvelle collection pour alertes
    }
}


# ==================================================
# CLASSE PRINCIPALE
# ==================================================

class MoniteurTempsReel:
    """Moniteur temps réel pour détecter les dépassements"""
    
    def __init__(self, config=KUZZLE_CONFIG):
        self.config = config
        self.kuzzle = None
        self.alertes_actives = []
        self.stats = {
            'total_analyses': 0,
            'alertes_generees': 0,
            'dernier_traitement': None
        }
    
    async def connecter(self):
        """Se connecter à Kuzzle"""
        print("\n🔌 Connexion à Kuzzle...")
        print(f"   Serveur: {self.config['host']}:{self.config['port']}")
        
        try:
            ws = WebSocket(self.config['host'], port=self.config['port'])
            self.kuzzle = Kuzzle(ws)
            await self.kuzzle.connect()
            
            print("✅ Connecté à Kuzzle avec succès !\n")
            
            # Vérifier si l'index existe
            index_exists = await self.kuzzle.index.exists(self.config['index'])
            if not index_exists:
                print(f"⚠️  Index '{self.config['index']}' n'existe pas.")
                print("   Création de l'index...")
                await self.kuzzle.index.create(self.config['index'])
            
            # Vérifier/créer collection alertes
            await self._verifier_collection_alertes()
            
            return True
            
        except Exception as e:
            print(f"❌ Erreur de connexion : {e}")
            print("\n💡 Vérifications :")
            print("   - Kuzzle est-il démarré ?")
            print("   - Le port 7512 est-il accessible ?")
            print("   - Les paramètres de connexion sont-ils corrects ?")
            return False
    
    async def _verifier_collection_alertes(self):
        """Vérifier que la collection des alertes existe"""
        try:
            collection_exists = await self.kuzzle.collection.exists(
                self.config['index'],
                self.config['collections']['alerts']
            )
            
            if not collection_exists:
                print(f"📝 Création de la collection '{self.config['collections']['alerts']}'...")
                await self.kuzzle.collection.create(
                    self.config['index'],
                    self.config['collections']['alerts']
                )
                print("✅ Collection créée\n")
        except Exception as e:
            print(f"⚠️  Attention : {e}")
    
    async def surveiller_collection(self):
        """S'abonner aux nouvelles données dans la collection"""
        print("👀 Surveillance activée sur la collection:")
        print(f"   {self.config['index']}/{self.config['collections']['input']}\n")
        print("   Filtre: phase='Sortie' uniquement")
        print("   En attente de nouvelles données...\n")
        print("   (Appuyez sur Ctrl+C pour arrêter)\n")
        print("-" * 70)
        
        # Filtre : seulement les sorties (phase='Sortie')
        filtre = {
            'equals': {
                'phase': 'Sortie'
            }
        }
        
        # Callback pour nouvelles données
        async def traiter_nouvelle_donnee(notification):
            await self._analyser_document(notification['result'])
        
        # S'abonner
        try:
            await self.kuzzle.realtime.subscribe(
                self.config['index'],
                self.config['collections']['input'],
                filtre,
                traiter_nouvelle_donnee
            )
            
            # Boucle infinie pour maintenir la connexion
            while True:
                await asyncio.sleep(1)
                
        except KeyboardInterrupt:
            print("\n\n⏹️  Arrêt de la surveillance...")
        except Exception as e:
            print(f"\n❌ Erreur : {e}")
    
    async def _analyser_document(self, document):
        """Analyser un document et générer alerte si nécessaire"""
        
        self.stats['total_analyses'] += 1
        self.stats['dernier_traitement'] = datetime.now().isoformat()
        
        print(f"\n📥 NOUVEAU DOCUMENT REÇU [{datetime.now().strftime('%H:%M:%S')}]")
        print("-" * 70)
        
        # Extraire les données
        id_doc = document.get('_id')
        source = document.get('_source', document)
        
        id_station = source.get('id_station')
        id_filtre = source.get('id_filtre')
        nom_feuille = source.get('nom_feuille')
        
        print(f"Station: {id_station}")
        print(f"Filtre:  {id_filtre}")
        print(f"Source:  {nom_feuille}")
        
        # Déterminer le groupe de filtre
        filtre_clean = id_filtre.rstrip('abc') if id_filtre else ''
        if 'FV1' in filtre_clean:
            groupe_filtre = 'FV1'
        elif 'FV2' in filtre_clean:
            groupe_filtre = 'FV2'
        elif 'FH' in filtre_clean:
            groupe_filtre = 'FH'
        else:
            groupe_filtre = 'general'
        
        # Analyser les paramètres
        depassements = []
        niveau_max = 'CONFORME'
        
        # Liste des paramètres à vérifier
        parametres = {
            'dco_mg_l': source.get('dco_mg_l'),
            'dbo5_mg_l': source.get('dbo5_mg_l'),
            'mes_mg_l': source.get('mes_mg_l'),
            'ammonium_mg_l': source.get('ammonium_mg_l'),
            'nitrates_mg_l': source.get('nitrates_mg_l'),
            'phosphates_mg_l': source.get('phosphates_mg_l'),
            'coliformes_fecaux_cfu_100ml': source.get('coliformes_fecaux_cfu_100ml')
        }
        
        print("\n📊 Analyse des paramètres:")
        
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
            icone = NIVEAUX_ALERTE[niveau]['icone']
            
            param_display = param.replace('_mg_l', '').replace('_cfu_100ml', '').upper()
            print(f"  {icone} {param_display:15s}: {valeur:10.2f} (seuil: {seuil:8.1f}) → {niveau}")
            
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
        
        # Vérifier pH
        ph = source.get('ph')
        if ph is not None and ph != '':
            try:
                ph = float(ph)
                conforme_ph, niveau_ph = verifier_ph(ph)
                icone_ph = NIVEAUX_ALERTE[niveau_ph]['icone']
                print(f"  {icone_ph} {'pH':15s}: {ph:10.2f} (6.5-8.5) → {niveau_ph}")
                
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
        
        print("-" * 70)
        
        # Résultat
        conforme = niveau_max == 'CONFORME'
        
        if conforme:
            print(f"✅ Résultat: {NIVEAUX_ALERTE['CONFORME']['icone']} CONFORME - Aucune action requise")
        else:
            print(f"🚨 Résultat: {NIVEAUX_ALERTE[niveau_max]['icone']} {niveau_max}")
            print(f"   {len(depassements)} dépassement(s) détecté(s)")
            print(f"   Action: {NIVEAUX_ALERTE[niveau_max]['action']}")
            
            # Générer et sauvegarder l'alerte
            await self._creer_alerte(
                id_doc,
                id_station,
                id_filtre,
                groupe_filtre,
                niveau_max,
                depassements,
                source
            )
        
        # Afficher stats
        print(f"\n📈 Statistiques:")
        print(f"   Total analyses: {self.stats['total_analyses']}")
        print(f"   Alertes générées: {self.stats['alertes_generees']}")
        print("-" * 70)
    
    async def _creer_alerte(self, doc_id, station, filtre, groupe, niveau, depassements, source_data):
        """Créer une alerte dans Kuzzle"""
        
        alerte = {
            'timestamp': datetime.now().isoformat(),
            'document_source_id': doc_id,
            'id_station': station,
            'id_filtre': filtre,
            'groupe_filtre': groupe,
            'severity': niveau,
            'nombre_depassements': len(depassements),
            'depassements': depassements,
            'action_requise': NIVEAUX_ALERTE[niveau]['action'],
            'acknowledged': False,
            'resolved': False,
            'donnees_mesurees': {
                'dco_mg_l': source_data.get('dco_mg_l'),
                'dbo5_mg_l': source_data.get('dbo5_mg_l'),
                'mes_mg_l': source_data.get('mes_mg_l'),
                'ph': source_data.get('ph'),
                'ammonium_mg_l': source_data.get('ammonium_mg_l')
            }
        }
        
        try:
            # Sauvegarder dans Kuzzle
            result = await self.kuzzle.document.create(
                self.config['index'],
                self.config['collections']['alerts'],
                alerte
            )
            
            self.stats['alertes_generees'] += 1
            print(f"\n💾 Alerte sauvegardée dans Kuzzle (ID: {result['_id']})")
            
            # Publier notification temps réel
            if ALERTE_CONFIG.get('kuzzle_actif', True):
                await self.kuzzle.realtime.publish(
                    self.config['index'],
                    self.config['collections']['alerts'],
                    {
                        'type': 'nouvelle_alerte',
                        'severity': niveau,
                        'filtre': filtre,
                        'alert_id': result['_id']
                    }
                )
                print("📢 Notification publiée")
            
        except Exception as e:
            print(f"❌ Erreur sauvegarde alerte : {e}")
    
    async def afficher_alertes_actives(self):
        """Afficher toutes les alertes non résolues"""
        print("\n" + "="*70)
        print("  🚨 ALERTES ACTIVES (Non résolues)")
        print("="*70 + "\n")
        
        try:
            # Rechercher alertes non résolues
            query = {
                'query': {
                    'term': {
                        'resolved': False
                    }
                }
            }
            
            result = await self.kuzzle.document.search(
                self.config['index'],
                self.config['collections']['alerts'],
                query,
                size=100
            )
            
            alertes = result.get('hits', [])
            
            if not alertes:
                print("✅ Aucune alerte active. Tous les systèmes fonctionnent normalement.\n")
                return
            
            print(f"Total: {len(alertes)} alerte(s)\n")
            
            # Grouper par niveau
            par_niveau = {}
            for hit in alertes:
                source = hit['_source']
                niveau = source['severity']
                if niveau not in par_niveau:
                    par_niveau[niveau] = []
                par_niveau[niveau].append(source)
            
            # Afficher par niveau de priorité
            for niveau in ['CRITIQUE', 'ALERTE', 'ATTENTION']:
                if niveau in par_niveau:
                    alertes_niveau = par_niveau[niveau]
                    icone = NIVEAUX_ALERTE[niveau]['icone']
                    
                    print(f"{icone} {niveau} ({len(alertes_niveau)}):")
                    print("-" * 70)
                    
                    for alerte in alertes_niveau:
                        timestamp = datetime.fromisoformat(alerte['timestamp'])
                        print(f"  Date: {timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
                        print(f"  Filtre: {alerte['id_filtre']} ({alerte['groupe_filtre']})")
                        print(f"  Dépassements: {alerte['nombre_depassements']}")
                        
                        for dep in alerte['depassements'][:3]:  # Max 3 premiers
                            param = dep['parametre'].upper()
                            print(f"    • {param}: {dep['valeur']:.2f} (seuil: {dep['seuil']})")
                        
                        print()
                    
                    print()
            
        except Exception as e:
            print(f"❌ Erreur : {e}")
    
    async def deconnecter(self):
        """Déconnexion propre"""
        if self.kuzzle:
            await self.kuzzle.disconnect()
            print("\n✅ Déconnecté de Kuzzle")


# ==================================================
# FONCTION PRINCIPALE
# ==================================================

async def main():
    """Point d'entrée principal"""
    
    print("\n" + "="*70)
    print("  🌊 SURVEILLANCE TEMPS RÉEL - STATION SANAR")
    print("  Système de Détection d'Alertes avec Kuzzle")
    print("="*70)
    
    moniteur = MoniteurTempsReel()
    
    try:
        # Connexion à Kuzzle
        connected = await moniteur.connecter()
        if not connected:
            return
        
        # Menu
        print("\n📋 MENU:")
        print("  1. Surveiller en temps réel (mode production)")
        print("  2. Afficher les alertes actives")
        print("  3. Tester avec un échantillon manuel")
        print("  4. Quitter")
        
        choix = input("\nVotre choix (1-4): ").strip()
        
        if choix == "1":
            # Mode surveillance
            await moniteur.surveiller_collection()
        
        elif choix == "2":
            # Afficher alertes
            await moniteur.afficher_alertes_actives()
        
        elif choix == "3":
            # Test manuel
            print("\n🧪 Mode test : Entrez les valeurs pour un échantillon fictif")
            print("(Appuyez sur Entrée pour ignorer un paramètre)\n")
            
            test_doc = {
                '_id': 'test_' + datetime.now().strftime('%Y%m%d%H%M%S'),
                '_source': {
                    'id_station': 'Sanar_Station',
                    'id_filtre': input("  Filtre (ex: SFV1a): ").strip() or 'SFV1a',
                    'phase': 'Sortie',
                    'nom_feuille': 'Test Manuel',
                }
            }
            
            # Demander les valeurs
            params = ['dco_mg_l', 'dbo5_mg_l', 'mes_mg_l', 'ph', 'ammonium_mg_l']
            for param in params:
                val = input(f"  {param}: ").strip()
                if val:
                    try:
                        test_doc['_source'][param] = float(val)
                    except ValueError:
                        pass
            
            await moniteur._analyser_document(test_doc)
        
        else:
            print("\n👋 Au revoir !")
    
    except KeyboardInterrupt:
        print("\n\n⏹️  Interruption détectée")
    
    except Exception as e:
        print(f"\n❌ ERREUR : {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        await moniteur.deconnecter()


if __name__ == "__main__":
    # Lancer le programme
    asyncio.run(main())