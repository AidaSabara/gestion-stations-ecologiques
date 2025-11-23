"""
Système de Prédiction ML ROBUSTE
Utilise les modèles fiables + stratégies de fallback

Usage:
  python predictions_ml_robuste.py --interactive
  python predictions_ml_robuste.py --kuzzle
"""

import joblib
import pandas as pd
import numpy as np
from datetime import datetime
import os
import argparse

from config_seuils import get_seuil, determiner_niveau_alerte, NIVEAUX_ALERTE

# ==================================================
# RENDEMENTS PAR DÉFAUT (basés sur littérature)
# ==================================================

RENDEMENTS_MOYENS = {
    'FV1': {'dco': 75.0, 'dbo5': 85.0},  # Filtre vertical primaire
    'FV2': {'dco': 65.0, 'dbo5': 95.0},  # Filtre vertical secondaire
    'FH': {'dco': 90.0, 'dbo5': 98.0}    # Filtre horizontal (très efficace)
}

SEUIL_R2_FIABLE = 0.5  # R² minimum pour considérer le modèle fiable

# ==================================================
# CLASSE PRÉDICTEUR ROBUSTE
# ==================================================

class PredicteurRobuste:
    """Prédicteur avec fallback intelligent"""
    
    def __init__(self, models_dir='../models'):
        self.models_dir = models_dir
        self.modeles = {}
        self.modeles_fiables = {}
        self.charger_tous_modeles()
    
    def charger_tous_modeles(self):
        """Charger et évaluer la fiabilité des modèles"""
        
        print("\n📦 Chargement et évaluation des modèles...\n")
        
        if not os.path.exists(self.models_dir):
            print(f"❌ Dossier models/ introuvable")
            return
        
        fichiers = [f for f in os.listdir(self.models_dir) if f.endswith('.pkl')]
        
        if not fichiers:
            print(f"❌ Aucun modèle trouvé")
            return
        
        for fichier in fichiers:
            nom_modele = fichier.replace('_model.pkl', '')
            chemin = os.path.join(self.models_dir, fichier)
            
            try:
                data = joblib.load(chemin)
                self.modeles[nom_modele] = data
                
                # Évaluer fiabilité
                r2 = data.get('metrics', {}).get('test_r2', -999)
                
                if pd.notna(r2) and r2 >= SEUIL_R2_FIABLE:
                    self.modeles_fiables[nom_modele] = True
                    print(f"  ✅ {nom_modele:15s} R²={r2:.3f} (FIABLE)")
                else:
                    self.modeles_fiables[nom_modele] = False
                    if pd.isna(r2):
                        print(f"  ⚠️  {nom_modele:15s} R²=nan (Fallback)")
                    else:
                        print(f"  ⚠️  {nom_modele:15s} R²={r2:.3f} (Fallback)")
                        
            except Exception as e:
                print(f"  ❌ {nom_modele}: {e}")
        
        nb_fiables = sum(self.modeles_fiables.values())
        print(f"\n✅ {len(self.modeles)} modèle(s) chargé(s), {nb_fiables} fiable(s)")
    
    def predire_avec_fallback(self, donnees_entree, groupe_filtre, variable):
        """Prédire avec fallback si modèle pas fiable"""
        
        nom_modele = f"{groupe_filtre}_{variable}"
        
        # Stratégie 1: Modèle ML (si fiable)
        if nom_modele in self.modeles and self.modeles_fiables.get(nom_modele, False):
            try:
                model_data = self.modeles[nom_modele]
                model = model_data['model']
                scaler = model_data['scaler']
                
                X_new = pd.DataFrame([{
                    f'entree_{variable}': donnees_entree.get(f'{variable}_mg_l'),
                    'entree_ph': donnees_entree.get('ph'),
                    'entree_mes': donnees_entree.get('mes_mg_l')
                }])
                
                if not X_new.isna().any().any():
                    X_scaled = scaler.transform(X_new)
                    rendement = model.predict(X_scaled)[0]
                    rendement = max(0, min(100, rendement))
                    
                    return {
                        'rendement': rendement,
                        'methode': 'ML',
                        'fiabilite': 'haute',
                        'r2': model_data.get('metrics', {}).get('test_r2', 0)
                    }
            except Exception as e:
                print(f"   ⚠️ Erreur ML pour {variable}: {e}")
        
        # Stratégie 2: Fallback - Rendement moyen
        rendement_moyen = RENDEMENTS_MOYENS[groupe_filtre][variable]
        
        return {
            'rendement': rendement_moyen,
            'methode': 'Fallback (moyenne)',
            'fiabilite': 'moyenne',
            'r2': None
        }
    
    def predire_sortie(self, donnees_entree, groupe_filtre):
        """Prédire qualité de sortie pour tous les paramètres"""
        
        predictions = {}
        
        for variable in ['dco', 'dbo5']:
            pred = self.predire_avec_fallback(donnees_entree, groupe_filtre, variable)
            
            valeur_entree = donnees_entree.get(f'{variable}_mg_l')
            rendement = pred['rendement']
            valeur_sortie = valeur_entree * (1 - rendement / 100)
            valeur_sortie = max(0, valeur_sortie)
            
            predictions[f'{variable}_mg_l'] = {
                'entree': valeur_entree,
                'sortie_predite': round(valeur_sortie, 2),
                'rendement_predit': round(rendement, 2),
                'methode': pred['methode'],
                'fiabilite': pred['fiabilite'],
                'r2': pred['r2']
            }
        
        return predictions
    
    def analyser_et_alerter(self, predictions, groupe_filtre):
        """Analyser prédictions et générer alertes"""
        
        alertes = []
        conforme = True
        
        for param, pred in predictions.items():
            valeur_predite = pred['sortie_predite']
            seuil = get_seuil(param, groupe_filtre)
            
            if seuil:
                niveau = determiner_niveau_alerte(valeur_predite, seuil)
                
                if niveau != 'CONFORME':
                    conforme = False
                    alertes.append({
                        'parametre': param,
                        'valeur_predite': valeur_predite,
                        'seuil': seuil,
                        'niveau': niveau,
                        'action': NIVEAUX_ALERTE[niveau]['action']
                    })
        
        return {
            'conforme': conforme,
            'alertes': alertes,
            'niveau_global': max(
                [a['niveau'] for a in alertes],
                key=lambda x: NIVEAUX_ALERTE[x]['priorite']
            ) if alertes else 'CONFORME'
        }
    
    def afficher_predictions(self, predictions, analyse, groupe_filtre):
        """Afficher résultats"""
        
        print("\n" + "="*70)
        print(f"  🔮 PRÉDICTIONS - FILTRE {groupe_filtre}")
        print("="*70 + "\n")
        
        for param, pred in predictions.items():
            param_display = param.replace('_mg_l', '').upper()
            
            # Icône selon méthode
            icone_methode = "🤖" if pred['methode'] == 'ML' else "📊"
            
            print(f"{icone_methode} {param_display}:")
            print(f"   Entrée:          {pred['entree']:.2f} mg/L")
            print(f"   Sortie prédite:  {pred['sortie_predite']:.2f} mg/L")
            print(f"   Rendement:       {pred['rendement_predit']:.1f}%")
            print(f"   Méthode:         {pred['methode']}")
            print(f"   Fiabilité:       {pred['fiabilite']}")
            
            if pred['r2'] is not None:
                print(f"   R²:              {pred['r2']:.3f}")
            
            # Statut conformité
            seuil = get_seuil(param, groupe_filtre)
            if seuil:
                niveau = determiner_niveau_alerte(pred['sortie_predite'], seuil)
                icone = NIVEAUX_ALERTE[niveau]['icone']
                print(f"   Statut:          {icone} {niveau} (seuil: {seuil} mg/L)")
            
            print()
        
        # Résumé
        print("-" * 70)
        if analyse['conforme']:
            print("✅ RÉSULTAT: Qualité prédite CONFORME")
        else:
            print(f"🚨 RÉSULTAT: {analyse['niveau_global']}")
            print(f"\n⚠️  {len(analyse['alertes'])} alerte(s) préventive(s):")
            for alerte in analyse['alertes']:
                print(f"   • {alerte['parametre']}: {alerte['valeur_predite']:.2f} > {alerte['seuil']}")
                print(f"     → {alerte['action']}")
        
        print("="*70)


# ==================================================
# MODE INTERACTIF
# ==================================================

def mode_interactif():
    """Mode interactif"""
    
    print("\n" + "="*70)
    print("  🎮 MODE INTERACTIF - PRÉDICTIONS ROBUSTES")
    print("="*70)
    
    predicteur = PredicteurRobuste()
    
    if not predicteur.modeles:
        print("\n❌ Aucun modèle disponible")
        return
    
    while True:
        print("\n📋 Données d'ENTRÉE:")
        
        # Choisir filtre
        print("\n1. FV1  2. FV2  3. FH")
        choix = input("Filtre (1-3): ").strip()
        groupe_map = {'1': 'FV1', '2': 'FV2', '3': 'FH'}
        groupe = groupe_map.get(choix, 'FV1')
        
        print(f"\n✅ Filtre: {groupe}")
        
        # Saisir données
        donnees = {}
        params = [
            ('dco_mg_l', 'DCO (mg/L)', 1200),
            ('dbo5_mg_l', 'DBO5 (mg/L)', 550),
            ('mes_mg_l', 'MES (mg/L)', 250),
            ('ph', 'pH', 7.5)
        ]
        
        for param, label, defaut in params:
            val = input(f"{label} [{defaut}]: ").strip()
            donnees[param] = float(val) if val else defaut
        
        # Prédire
        print("\n🔮 Prédiction...")
        predictions = predicteur.predire_sortie(donnees, groupe)
        analyse = predicteur.analyser_et_alerter(predictions, groupe)
        predicteur.afficher_predictions(predictions, analyse, groupe)
        
        # Continuer ?
        if input("\n➡️  Autre prédiction ? (o/n): ").strip().lower() != 'o':
            break
    
    print("\n👋 Au revoir !")


# ==================================================
# MODE KUZZLE
# ==================================================

def mode_kuzzle():
    """Mode Kuzzle avec prédictions robustes"""
    
    print("\n" + "="*70)
    print("  🌊 MODE KUZZLE - PRÉDICTIONS TEMPS RÉEL ROBUSTES")
    print("="*70)
    
    try:
        import requests
    except ImportError:
        print("❌ Module 'requests' requis: pip install requests")
        return
    
    KUZZLE_URL = "http://localhost:7512"
    INDEX = "iot"
    
    predicteur = PredicteurRobuste()
    
    if not predicteur.modeles:
        print("\n❌ Aucun modèle disponible")
        return
    
    # Test connexion
    print("\n🔌 Test connexion Kuzzle...")
    try:
        response = requests.get(f"{KUZZLE_URL}/_serverInfo")
        response.raise_for_status()
        print("✅ Connecté à Kuzzle")
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return
    
    print("\n📊 Recherche données d'entrée récentes...")
    
    try:
        response = requests.post(
            f"{KUZZLE_URL}/{INDEX}/water_quality/_search",
            json={
                "query": {"term": {"phase": "Entree"}},
                "sort": [{"_kuzzle_info.createdAt": "desc"}],
                "size": 10
            }
        )
        
        if response.status_code == 200:
            hits = response.json().get('result', {}).get('hits', [])
            
            if not hits:
                print("⚠️  Aucune donnée trouvée")
                return
            
            print(f"✅ {len(hits)} document(s) trouvé(s)\n")
            
            predictions_ok = 0
            alertes_creees = 0
            
            for i, hit in enumerate(hits, 1):
                source = hit.get('_source', {})
                id_filtre = source.get('id_filtre', '')
                
                print(f"\n{'='*70}")
                print(f"  📄 Document {i}/{len(hits)}: {id_filtre}")
                print(f"{'='*70}")
                
                # Mapper vers groupe
                if 'FV1' in id_filtre:
                    groupe = 'FV1'
                elif 'FV2' in id_filtre:
                    groupe = 'FV2'
                else:
                    groupe = 'FH'
                
                # Préparer données
                donnees = {
                    'dco_mg_l': source.get('dco_mg_l') or 1000,
                    'dbo5_mg_l': source.get('dbo5_mg_l') or 500,
                    'mes_mg_l': source.get('mes_mg_l') or 200,
                    'ph': source.get('ph') or 7.0
                }
                
                # Vérifier données valides
                if donnees['dco_mg_l'] < 10 or donnees['dbo5_mg_l'] < 10:
                    print("⚠️  Données trop faibles, skip")
                    continue
                
                # Prédire
                predictions = predicteur.predire_sortie(donnees, groupe)
                analyse = predicteur.analyser_et_alerter(predictions, groupe)
                predicteur.afficher_predictions(predictions, analyse, groupe)
                
                predictions_ok += 1
                
                # Créer alerte si nécessaire
                if not analyse['conforme']:
                    if creer_alerte_kuzzle(KUZZLE_URL, INDEX, source, predictions, analyse, groupe):
                        alertes_creees += 1
            
            # Résumé
            print(f"\n{'='*70}")
            print(f"  📊 RÉSUMÉ")
            print(f"{'='*70}")
            print(f"✅ Prédictions: {predictions_ok}")
            print(f"🚨 Alertes créées: {alertes_creees}")
            print()
            
        else:
            print(f"❌ Erreur {response.status_code}")
            
    except Exception as e:
        print(f"❌ Erreur: {e}")


def creer_alerte_kuzzle(url, index, source_data, predictions, analyse, groupe):
    """Créer alerte dans Kuzzle"""
    
    import requests
    
    try:
        params_alertes = [a['parametre'].upper() for a in analyse['alertes']]
        message = f"🔮 ALERTE PRÉVENTIVE: {', '.join(params_alertes)}"
        
        # Déterminer si méthode ML ou Fallback
        methodes = [p['methode'] for p in predictions.values()]
        methode_globale = 'ML' if 'ML' in methodes else 'Fallback'
        
        alerte = {
            'stationId': source_data.get('id_station', 'Sanar_Station'),
            'type': 'prédiction_dépassement',
            'level': {'ATTENTION': 'warning', 'ALERTE': 'warning', 'CRITIQUE': 'critical'}.get(
                analyse['niveau_global'], 'warning'
            ),
            'message': message,
            'timestamp': datetime.now().isoformat(),
            'resolved': False,
            'metadata': {
                'predictive': True,
                'groupe_filtre': groupe,
                'methode_prediction': methode_globale,
                'predictions': {
                    k: {
                        'entree': v['entree'],
                        'sortie_predite': v['sortie_predite'],
                        'rendement': v['rendement_predit'],
                        'methode': v['methode']
                    }
                    for k, v in predictions.items()
                },
                'alertes': analyse['alertes']
            }
        }
        
        response = requests.post(f"{url}/{index}/alerts/_create", json=alerte, timeout=5)
        
        if response.status_code in [200, 201]:
            alert_id = response.json().get('result', {}).get('_id')
            print(f"💾 Alerte créée (ID: {alert_id})")
            return True
        else:
            print(f"⚠️  Erreur création alerte: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return False


# ==================================================
# MAIN
# ==================================================

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--interactive', action='store_true', help='Mode interactif')
    parser.add_argument('--kuzzle', action='store_true', help='Mode Kuzzle temps réel')
    args = parser.parse_args()
    
    if args.kuzzle:
        mode_kuzzle()
    elif args.interactive or len(os.sys.argv) == 1:
        mode_interactif()
    else:
        print("\nUsage:")
        print("  python predictions_ml_robuste.py --interactive")
        print("  python predictions_ml_robuste.py --kuzzle")

if __name__ == "__main__":
    main()