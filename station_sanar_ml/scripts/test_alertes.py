"""
Test Rapide du Système d'Alertes
Vérifie que tout fonctionne avec vos données Kuzzle existantes
"""

import requests
import json
from datetime import datetime
from config_seuils import get_seuil, determiner_niveau_alerte, verifier_ph, NIVEAUX_ALERTE

KUZZLE_URL = "http://localhost:7512"
INDEX = "iot"

def test_connexion():
    """Test 1: Connexion à Kuzzle"""
    print("\n" + "="*70)
    print("TEST 1: Connexion à Kuzzle")
    print("="*70)
    
    try:
        response = requests.get(f"{KUZZLE_URL}/_serverInfo")
        response.raise_for_status()
        info = response.json()
        print("✅ Connexion OK")
        print(f"   Version Kuzzle: {info.get('result', {}).get('serverInfo', {}).get('kuzzle', {}).get('version', 'N/A')}")
        return True
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return False

def test_collections():
    """Test 2: Vérifier les collections"""
    print("\n" + "="*70)
    print("TEST 2: Vérification des collections")
    print("="*70)
    
    collections = ['water_quality', 'alerts', 'stations']
    
    for collection in collections:
        try:
            # Compter les documents
            response = requests.post(
                f"{KUZZLE_URL}/{INDEX}/{collection}/_count",
                json={"query": {"match_all": {}}}
            )
            
            if response.status_code == 200:
                count = response.json().get('result', {}).get('count', 0)
                print(f"✅ {collection:20s} : {count} document(s)")
            else:
                print(f"⚠️  {collection:20s} : Erreur {response.status_code}")
        except Exception as e:
            print(f"❌ {collection:20s} : {e}")

def test_lecture_water_quality():
    """Test 3: Lire des données water_quality"""
    print("\n" + "="*70)
    print("TEST 3: Lecture de water_quality")
    print("="*70)
    
    try:
        # Récupérer 3 documents de sortie
        response = requests.post(
            f"{KUZZLE_URL}/{INDEX}/water_quality/_search",
            json={
                "query": {"term": {"phase": "Sortie"}},
                "size": 3
            }
        )
        
        if response.status_code == 200:
            hits = response.json().get('result', {}).get('hits', [])
            print(f"✅ {len(hits)} document(s) récupéré(s)\n")
            
            for i, hit in enumerate(hits, 1):
                source = hit['_source']
                print(f"📄 Document {i}:")
                print(f"   Station: {source.get('id_station')}")
                print(f"   Filtre: {source.get('id_filtre')}")
                print(f"   Phase: {source.get('phase')}")
                print(f"   DCO: {source.get('dco_mg_l')} mg/L")
                print(f"   DBO5: {source.get('dbo5_mg_l')} mg/L")
                print(f"   pH: {source.get('ph')}")
                print()
            
            return hits
        else:
            print(f"❌ Erreur {response.status_code}: {response.text}")
            return []
            
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return []

def test_analyse_simple(documents):
    """Test 4: Analyser un document"""
    print("\n" + "="*70)
    print("TEST 4: Analyse d'un échantillon")
    print("="*70)
    
    if not documents:
        print("⚠️  Aucun document à analyser")
        return
    
    doc = documents[0]['_source']
    
    print(f"📊 Analyse du filtre: {doc.get('id_filtre')}\n")
    
    # Paramètres à vérifier
    params = {
        'dco_mg_l': doc.get('dco_mg_l'),
        'dbo5_mg_l': doc.get('dbo5_mg_l'),
        'mes_mg_l': doc.get('mes_mg_l'),
        'ph': doc.get('ph')
    }
    
    depassements = []
    
    for param, valeur in params.items():
        if valeur is None:
            continue
        
        try:
            valeur = float(valeur)
        except:
            continue
        
        if param == 'ph':
            conforme, niveau = verifier_ph(valeur)
            icone = NIVEAUX_ALERTE[niveau]['icone']
            print(f"  {icone} pH: {valeur:.2f} → {niveau}")
            if not conforme:
                depassements.append(param)
        else:
            seuil = get_seuil(param, 'FV1')
            if seuil:
                niveau = determiner_niveau_alerte(valeur, seuil)
                icone = NIVEAUX_ALERTE[niveau]['icone']
                print(f"  {icone} {param.upper()}: {valeur:.2f} (seuil: {seuil}) → {niveau}")
                if niveau != 'CONFORME':
                    depassements.append(param)
    
    if depassements:
        print(f"\n⚠️  {len(depassements)} dépassement(s) détecté(s)")
    else:
        print(f"\n✅ Tous les paramètres sont conformes")

def test_creation_alerte():
    """Test 5: Créer une alerte test - Version robuste"""
    print("\n" + "="*70)
    print("TEST 5: Création d'une alerte test")
    print("="*70)
    
    alerte_test = {
        'stationId': 'Sanar_Station',
        'type': 'seuil dépassé',
        'level': 'warning', 
        'message': 'Test système - DCO élevée détectée',
        'parameter': 'dco_mg_l',
        'value': 150.0,
        'threshold': 125.0,
        'timestamp': datetime.now().isoformat(),
        'resolved': False,
        'metadata': {'test': True, 'source': 'test_alertes.py'}
    }
    
    try:
        # Essayer différentes méthodes d'API Kuzzle
        endpoints = [
            f"{KUZZLE_URL}/{INDEX}/alerts/_create",
            f"{KUZZLE_URL}/{INDEX}/alerts/_create?refresh=wait_for", 
            f"{KUZZLE_URL}/api/{INDEX}/alerts"
        ]
        
        for endpoint in endpoints:
            print(f"🔍 Essai avec: {endpoint}")
            
            response = requests.post(
                endpoint,
                json=alerte_test,
                headers={'Content-Type': 'application/json'}
            )
            
            print(f"   Status: {response.status_code}")
            
            if response.status_code in [200, 201]:
                data = response.json()
                print(f"   Réponse: {data}")
                
                # Chercher l'ID dans différents formats de réponse
                alert_id = None
                if 'result' in data and '_id' in data['result']:
                    alert_id = data['result']['_id']
                elif '_id' in data:
                    alert_id = data['_id']
                elif 'item' in data and '_id' in data['item']:
                    alert_id = data['item']['_id']
                
                if alert_id:
                    print(f"✅ Alerte créée avec succès (ID: {alert_id})")
                    return alert_id
        
        print("❌ Toutes les tentatives ont échoué")
        return None
            
    except Exception as e:
        print(f"❌ Erreur: {e}")
        import traceback
        print(f"🔍 Détails: {traceback.format_exc()}")
        return None
def test_lecture_alertes():
    """Test 6: Lire les alertes"""
    print("\n" + "="*70)
    print("TEST 6: Lecture des alertes")
    print("="*70)
    
    try:
        # Récupérer les alertes non résolues
        response = requests.post(
            f"{KUZZLE_URL}/{INDEX}/alerts/_search",
            json={
                "query": {"term": {"resolved": False}},
                "sort": [{"timestamp": "desc"}],
                "size": 5
            }
        )
        
        if response.status_code == 200:
            hits = response.json().get('result', {}).get('hits', [])
            print(f"✅ {len(hits)} alerte(s) non résolue(s)\n")
            
            for hit in hits:
                source = hit['_source']
                timestamp = datetime.fromisoformat(source['timestamp']).strftime('%Y-%m-%d %H:%M')
                
                level_icon = {'info': '🔵', 'warning': '🟡', 'critical': '🔴'}
                icon = level_icon.get(source.get('level'), '⚪')
                
                print(f"{icon} {source.get('level').upper()}")
                print(f"   Station: {source.get('stationId')}")
                print(f"   Type: {source.get('type')}")
                print(f"   Message: {source.get('message')}")
                print(f"   Date: {timestamp}")
                
                if source.get('parameter'):
                    print(f"   Paramètre: {source['parameter']} = {source.get('value')} (seuil: {source.get('threshold')})")
                
                print()
                
        else:
            print(f"❌ Erreur {response.status_code}")
            
    except Exception as e:
        print(f"❌ Erreur: {e}")

def main():
    """Exécuter tous les tests"""
    print("\n" + "="*70)
    print("  🧪 TESTS DU SYSTÈME D'ALERTES - STATION SANAR")
    print("  Vérification de l'intégration avec Kuzzle")
    print("="*70)
    
    # Test 1: Connexion
    if not test_connexion():
        print("\n❌ Tests arrêtés : impossible de se connecter à Kuzzle")
        return
    
    # Test 2: Collections
    test_collections()
    
    # Test 3: Lecture water_quality
    documents = test_lecture_water_quality()
    
    # Test 4: Analyse
    if documents:
        test_analyse_simple(documents)
    
    # Test 5: Création alerte
    alert_id = test_creation_alerte()
    
    # Test 6: Lecture alertes
    test_lecture_alertes()
    
    # Résumé final
    print("\n" + "="*70)
    print("  ✅ TESTS TERMINÉS")
    print("="*70)
    print("\nProchaines étapes :")
    print("  1. Si tous les tests passent → python kuzzle_http_alertes.py")
    print("  2. Pour analyse complète → Choisir option 1 (Analyser collection)")
    print("  3. Pour surveillance continue → Choisir option 2")
    
    if alert_id:
        print(f"\n💡 Alerte de test créée (ID: {alert_id})")
        print("   Vous pouvez la voir dans votre dashboard frontend !")
    
    print()

if __name__ == "__main__":
    main()