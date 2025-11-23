"""
Système de Prédiction ML
Utilise les modèles entraînés pour prédire la qualité d'eau en sortie
Version Autonome - Sans dépendances externes
"""

import joblib
import pandas as pd
import numpy as np
from datetime import datetime
import os
import sys
import argparse

# ==================================================
# CONFIGURATION DES SEUILS (INTÉGRÉE DIRECTEMENT)
# ==================================================

# Copie complète de config_seuils.py intégrée ici
SEUILS_REJET = {
    'dco_mg_l': 125, 'dbo5_mg_l': 25, 'mes_mg_l': 30,
    'ammonium_mg_l': 10, 'nitrates_mg_l': 50, 'azote_total_mg_l': 15,
    'phosphates_mg_l': 2, 'coliformes_fecaux_cfu_100ml': 10000,
    'ph_min': 6.5, 'ph_max': 8.5
}

NIVEAUX_ALERTE = {
    'CONFORME': {'seuil': 0.8, 'icone': '🟢', 'priorite': 0, 'action': 'Aucune action'},
    'ATTENTION': {'seuil': 1.0, 'icone': '🟡', 'priorite': 1, 'action': 'Surveillance renforcée'},
    'ALERTE': {'seuil': 1.5, 'icone': '🔴', 'priorite': 2, 'action': 'Intervention sous 24h'},
    'CRITIQUE': {'seuil': float('inf'), 'icone': '⚠️', 'priorite': 3, 'action': 'INTERVENTION IMMÉDIATE'}
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

print("✅ Configuration des seuils intégrée avec succès")

# ==================================================
# CLASSE PRÉDICTEUR
# ==================================================

class PredicteurQualiteEau:
    """Système de prédiction de qualité d'eau"""
    
    def __init__(self, models_dir='../models'):
        self.models_dir = models_dir
        self.modeles = {}
        self.charger_tous_modeles()
    
    def nettoyer_donnees_kuzzle(self, source_data):
        """Nettoyer et préparer les données de Kuzzle"""
        
        donnees = {
            'dco_mg_l': source_data.get('dco_mg_l'),
            'dbo5_mg_l': source_data.get('dbo5_mg_l'),
            'mes_mg_l': source_data.get('mes_mg_l'),
            'ph': source_data.get('ph'),
            'ammonium_mg_l': source_data.get('ammonium_mg_l')
        }
        
        # Valeurs par défaut selon le type de filtre
        valeurs_par_defaut = {
            'dco_mg_l': 1000,
            'dbo5_mg_l': 500, 
            'mes_mg_l': 200,
            'ph': 7.0,
            'ammonium_mg_l': 30
        }
        
        # Nettoyer chaque valeur
        for param, valeur in donnees.items():
            if valeur is None:
                donnees[param] = valeurs_par_defaut[param]
                print(f"   🔧 {param}: valeur manquante → défaut {valeurs_par_defaut[param]}")
            elif isinstance(valeur, float) and np.isnan(valeur):
                donnees[param] = valeurs_par_defaut[param]
                print(f"   🔧 {param}: valeur NaN → défaut {valeurs_par_defaut[param]}")
            elif valeur == '' or valeur == 'NaN':
                donnees[param] = valeurs_par_defaut[param]
                print(f"   🔧 {param}: valeur vide → défaut {valeurs_par_defaut[param]}")
        
        return donnees

    def charger_tous_modeles(self):
        """Charger tous les modèles disponibles"""
        
        print("\n📦 Chargement des modèles...")
        
        if not os.path.exists(self.models_dir):
            print(f"❌ Dossier models/ introuvable")
            print(f"💡 Entraînez d'abord les modèles: python entrainer_modeles.py")
            return
        
        fichiers_modeles = [f for f in os.listdir(self.models_dir) if f.endswith('.pkl')]
        
        if not fichiers_modeles:
            print(f"❌ Aucun modèle trouvé dans {self.models_dir}/")
            print(f"💡 Entraînez d'abord: python entrainer_modeles.py")
            return
        
        for fichier in fichiers_modeles:
            nom_modele = fichier.replace('_model.pkl', '')
            chemin = os.path.join(self.models_dir, fichier)
            
            try:
                self.modeles[nom_modele] = joblib.load(chemin)
                print(f"  ✅ {nom_modele}")
            except Exception as e:
                print(f"  ❌ {nom_modele}: {e}")
        
        print(f"\n✅ {len(self.modeles)} modèle(s) chargé(s)")
    
    def predire_sortie(self, donnees_entree, groupe_filtre):
        """
        Prédire la qualité en sortie à partir des données d'entrée
        """
        
        predictions = {}
        
        for variable in ['dco', 'dbo5']:
            nom_modele = f"{groupe_filtre}_{variable}"
            
            if nom_modele not in self.modeles:
                print(f"⚠️  Modèle {nom_modele} non trouvé")
                continue
            
            modele_data = self.modeles[nom_modele]
            modele = modele_data['model']
            scaler = modele_data['scaler']
            features = modele_data['features']
            
            # Préparer les features
            X_new = pd.DataFrame([{
                f'entree_{variable}': donnees_entree.get(f'{variable}_mg_l'),
                'entree_ph': donnees_entree.get('ph'),
                'entree_mes': donnees_entree.get('mes_mg_l')
            }])
            
            # Vérifier données complètes
            if X_new.isna().any().any():
                print(f"⚠️  Données incomplètes pour {variable}")
                continue
            
            try:
                # Prédire le rendement
                X_scaled = scaler.transform(X_new)
                rendement_predit = modele.predict(X_scaled)[0]
                
                # Protection contre les NaN
                if np.isnan(rendement_predit):
                    print(f"🔄 Modèle {nom_modele} a retourné NaN, utilisation de stratégie de fallback")
                    rendements_par_defaut = {'dco': 75.0, 'dbo5': 80.0}
                    rendement_predit = rendements_par_defaut.get(variable, 70.0)
                
                # Borner entre 0 et 100%
                rendement_predit = max(0, min(100, rendement_predit))
                
                # Calculer valeur de sortie
                valeur_entree = donnees_entree.get(f'{variable}_mg_l')
                valeur_sortie_predite = valeur_entree * (1 - rendement_predit / 100)
                valeur_sortie_predite = max(0, valeur_sortie_predite)
                
                predictions[f'{variable}_mg_l'] = {
                    'entree': valeur_entree,
                    'sortie_predite': round(valeur_sortie_predite, 2),
                    'rendement_predit': round(rendement_predit, 2),
                    'modele_r2': round(modele_data.get('metrics', {}).get('test_r2', 0), 3),
                    'confiance': 'élevée' if not np.isnan(rendement_predit) else 'limitée'
                }
                
            except Exception as e:
                print(f"❌ Erreur prédiction {variable}: {e}")
                predictions[f'{variable}_mg_l'] = {
                    'entree': donnees_entree.get(f'{variable}_mg_l', 0),
                    'sortie_predite': None,
                    'rendement_predit': None,
                    'modele_r2': modele_data.get('metrics', {}).get('test_r2', 0),
                    'erreur': str(e)[:100],
                    'confiance': 'nulle'
                }
        
        return predictions
    
    def analyser_et_alerter(self, predictions, groupe_filtre):
        """Analyser les prédictions et générer des alertes si nécessaire"""
        
        alertes = []
        conforme = True
        
        for param, pred in predictions.items():
            valeur_predite = pred['sortie_predite']
            seuil = get_seuil(param, groupe_filtre)
            
            if seuil and valeur_predite is not None:
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
            'niveau_global': max([a['niveau'] for a in alertes], 
                                key=lambda x: NIVEAUX_ALERTE[x]['priorite']) if alertes else 'CONFORME'
        }
    
    def afficher_predictions(self, predictions, analyse, groupe_filtre):
        """Afficher les prédictions de manière lisible"""
        
        print("\n" + "="*70)
        print(f"  🔮 PRÉDICTIONS - FILTRE {groupe_filtre}")
        print("="*70 + "\n")
        
        for param, pred in predictions.items():
            param_display = param.replace('_mg_l', '').upper()
            
            print(f"📊 {param_display}:")
            print(f"   Entrée:          {pred['entree']:.2f} mg/L")
            
            if pred['sortie_predite'] is not None:
                print(f"   Sortie prédite:  {pred['sortie_predite']:.2f} mg/L")
                print(f"   Rendement:       {pred['rendement_predit']:.1f}%")
                
                # Vérifier conformité
                seuil = get_seuil(param, groupe_filtre)
                if seuil:
                    niveau = determiner_niveau_alerte(pred['sortie_predite'], seuil)
                    icone = NIVEAUX_ALERTE[niveau]['icone']
                    print(f"   Statut:          {icone} {niveau} (seuil: {seuil} mg/L)")
            else:
                print(f"   Sortie prédite:  ❌ Données indisponibles")
            
            print(f"   Fiabilité (R²):  {pred['modele_r2']:.3f}")
            print(f"   Confiance:        {pred.get('confiance', 'inconnue')}")
            
            if 'erreur' in pred:
                print(f"   Erreur:           {pred['erreur']}")
            
            print()
        
        # Résumé global
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
    """Mode interactif pour tester des prédictions"""
    
    print("\n" + "="*70)
    print("  🎮 MODE INTERACTIF - PRÉDICTIONS ML")
    print("="*70)
    
    predicteur = PredicteurQualiteEau()
    
    if not predicteur.modeles:
        print("\n❌ Aucun modèle disponible")
        return
    
    while True:
        print("\n📋 Entrez les données d'ENTRÉE du filtre:")
        print("   (Appuyez sur Entrée pour valeur par défaut)\n")
        
        # Choisir le filtre
        print("Groupe de filtre:")
        print("  1. FV1 (Filtre Vertical 1)")
        print("  2. FV2 (Filtre Vertical 2)")
        print("  3. FH  (Filtre Horizontal)")
        
        choix = input("\nVotre choix (1-3): ").strip()
        groupe_map = {'1': 'FV1', '2': 'FV2', '3': 'FH'}
        groupe_filtre = groupe_map.get(choix, 'FV1')
        
        print(f"\n✅ Filtre sélectionné: {groupe_filtre}\n")
        
        # Demander les valeurs
        donnees_entree = {}
        
        params = [
            ('dco_mg_l', 'DCO (mg/L)', 1200),
            ('dbo5_mg_l', 'DBO5 (mg/L)', 550),
            ('mes_mg_l', 'MES (mg/L)', 250),
            ('ph', 'pH', 7.5),
            ('ammonium_mg_l', 'Ammonium (mg/L)', 50)
        ]
        
        for param, label, defaut in params:
            val = input(f"  {label} [défaut: {defaut}]: ").strip()
            if val:
                val_norm = val.replace(',', '.').strip()
                try:
                    donnees_entree[param] = float(val_norm)
                except ValueError:
                    print(f"⚠️  '{val}' invalide, utilisation de la valeur par défaut: {defaut}")
                    donnees_entree[param] = defaut
            else:
                donnees_entree[param] = defaut
        
        # Faire la prédiction
        print("\n🔮 Prédiction en cours...")
        predictions = predicteur.predire_sortie(donnees_entree, groupe_filtre)
        
        if not predictions:
            print("❌ Impossible de faire des prédictions")
            continue
        
        # Analyser
        analyse = predicteur.analyser_et_alerter(predictions, groupe_filtre)
        
        # Afficher
        predicteur.afficher_predictions(predictions, analyse, groupe_filtre)
        
        # Continuer ?
        continuer = input("\n➡️  Faire une autre prédiction ? (o/n): ").strip().lower()
        if continuer != 'o':
            break
    
    print("\n👋 Au revoir !")


# ==================================================
# FONCTIONS UTILITAIRES POUR KUZZLE
# ==================================================

def nettoyer_valeurs_json(data):
    """Nettoyer récursivement les NaN"""
    if isinstance(data, dict):
        return {k: nettoyer_valeurs_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [nettoyer_valeurs_json(item) for item in data]
    elif isinstance(data, float) and np.isnan(data):
        return None
    elif isinstance(data, (int, float)):
        return float(data)
    else:
        return data

def creer_alerte_predictive(url, index, source_data, predictions, analyse, groupe):
    """Créer une alerte préventive"""
    
    import requests
    
    if source_data is None:
        print("❌ Données source manquantes")
        return
    
    try:
        metadata_clean = {
            'predictive': True,
            'groupe_filtre': groupe,
            'predictions': nettoyer_valeurs_json(predictions),
            'alertes': nettoyer_valeurs_json(analyse['alertes']),
            'timestamp_analyse': datetime.now().isoformat(),
            'modele_utilise': f"{groupe}_dco/dbo5"
        }
        
        params_alertes = [a['parametre'].upper() for a in analyse['alertes'] if a.get('valeur_predite') is not None]
        
        if not params_alertes:
            message = "🔮 ALERTE PRÉVENTIVE: Données de prédiction incomplètes"
        else:
            message = f"🔮 ALERTE PRÉVENTIVE: Dépassement prédit pour {', '.join(params_alertes)}"
        
        alerte = {
            'stationId': source_data.get('id_station', 'Sanar_Station'),
            'type': 'prédiction_dépassement',
            'level': {'ATTENTION': 'warning', 'ALERTE': 'warning', 'CRITIQUE': 'critical'}.get(analyse['niveau_global'], 'warning'),
            'message': message,
            'timestamp': datetime.now().isoformat(),
            'resolved': False,
            'metadata': metadata_clean
        }
        
        response = requests.post(f"{url}/{index}/alerts/_create", 
                               json=alerte,
                               timeout=10)
        
        if response.status_code in [200, 201]:
            result = response.json()
            alert_id = result.get('result', {}).get('_id')
            print(f"💾 Alerte préventive créée (ID: {alert_id})")
        else:
            print(f"⚠️  Erreur HTTP {response.status_code}")
    
    except Exception as e:
        print(f"❌ Erreur création alerte: {e}")


# ==================================================
# MODE KUZZLE (Temps Réel)
# ==================================================

def mode_kuzzle():
    """Mode surveillance Kuzzle avec prédictions ML"""
    
    print("\n" + "="*70)
    print("  🌊 MODE KUZZLE - PRÉDICTIONS TEMPS RÉEL")
    print("="*70)
    
    try:
        import requests
    except ImportError:
        print("❌ Module 'requests' requis")
        return
    
    KUZZLE_URL = "http://localhost:7512"
    INDEX = "iot"
    
    predicteur = PredicteurQualiteEau()
    
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
        print(f"❌ Impossible de se connecter: {e}")
        return
    
    print("\n📊 Recherche des données d'entrée récentes...")
    
    try:
        response = requests.post(
            f"{KUZZLE_URL}/{INDEX}/water_quality/_search",
            json={
                "query": {"term": {"phase": "Entree"}},
                "sort": [{"_kuzzle_info.createdAt": "desc"}],
                "size": 15
            }
        )
        
        if response.status_code == 200:
            hits = response.json().get('result', {}).get('hits', [])
            
            if not hits:
                print("⚠️  Aucune donnée d'entrée trouvée")
                return
            
            print(f"📥 {len(hits)} document(s) trouvé(s)")
            
            predictions_reussies = 0
            predictions_echouees = 0
            
            for i, hit in enumerate(hits, 1):
                source = hit.get('_source', {})
                id_filtre = source.get('id_filtre', 'Inconnu')
                
                print(f"\n🎯 Document {i}: {id_filtre}")
                
                # Mapper vers groupe
                if 'FV1' in id_filtre:
                    groupe = 'FV1'
                elif 'FV2' in id_filtre:
                    groupe = 'FV2'
                else:
                    groupe = 'FH'
                
                # Nettoyer les données
                donnees = predicteur.nettoyer_donnees_kuzzle(source)
                
                # Vérifier les données critiques
                if donnees['dco_mg_l'] == 0 or donnees['dbo5_mg_l'] == 0:
                    print(f"❌ Données critiques manquantes pour {id_filtre}")
                    predictions_echouees += 1
                    continue
                
                # Faire la prédiction
                predictions = predicteur.predire_sortie(donnees, groupe)
                
                if predictions:
                    predictions_reussies += 1
                    analyse = predicteur.analyser_et_alerter(predictions, groupe)
                    predicteur.afficher_predictions(predictions, analyse, groupe)
                    
                    # Créer alerte si nécessaire
                    if not analyse['conforme']:
                        creer_alerte_predictive(KUZZLE_URL, INDEX, source, predictions, analyse, groupe)
                else:
                    predictions_echouees += 1
                    print(f"❌ Prédiction échouée pour {id_filtre}")
            
            # Résumé
            print(f"\n📊 RÉSUMÉ:")
            print(f"✅ Prédictions réussies: {predictions_reussies}")
            print(f"❌ Prédictions échouées: {predictions_echouees}")
                    
        else:
            print(f"❌ Erreur Kuzzle {response.status_code}")
            
    except Exception as e:
        print(f"❌ Erreur: {e}")


# ==================================================
# MODE BATCH (Fichier CSV)
# ==================================================

def mode_batch(csv_path):
    """Prédire pour un fichier CSV complet"""
    
    print("\n" + "="*70)
    print("  📄 MODE BATCH - PRÉDICTIONS SUR CSV")
    print("="*70)
    
    if not os.path.exists(csv_path):
        print(f"❌ Fichier introuvable: {csv_path}")
        return
    
    predicteur = PredicteurQualiteEau()
    
    if not predicteur.modeles:
        print("\n❌ Aucun modèle disponible")
        return
    
    print(f"\n📂 Chargement: {csv_path}")
    
    df = pd.read_csv(csv_path)
    
    # Filtrer les entrées
    entrees = df[df['phase'] == 'Entree'].copy()
    
    print(f"✅ {len(entrees)} entrées trouvées")
    
    if len(entrees) == 0:
        print("⚠️  Aucune donnée d'entrée")
        return
    
    # Prédire pour chaque entrée
    resultats = []
    
    for idx, row in entrees.iterrows():
        id_filtre = row.get('id_filtre', '')
        
        if 'FV1' in id_filtre:
            groupe = 'FV1'
        elif 'FV2' in id_filtre:
            groupe = 'FV2'
        else:
            groupe = 'FH'
        
        donnees = {
            'dco_mg_l': row.get('dco_mg_l'),
            'dbo5_mg_l': row.get('dbo5_mg_l'),
            'mes_mg_l': row.get('mes_mg_l'),
            'ph': row.get('ph'),
            'ammonium_mg_l': row.get('ammonium_mg_l')
        }
        
        if pd.isna(donnees['dco_mg_l']) or pd.isna(donnees['dbo5_mg_l']):
            continue
        
        predictions = predicteur.predire_sortie(donnees, groupe)
        
        if predictions:
            analyse = predicteur.analyser_et_alerter(predictions, groupe)
            
            resultats.append({
                'id_station': row.get('id_station'),
                'id_filtre': row.get('id_filtre'),
                'groupe': groupe,
                'dco_entree': donnees['dco_mg_l'],
                'dco_sortie_predite': predictions.get('dco_mg_l', {}).get('sortie_predite'),
                'dco_rendement': predictions.get('dco_mg_l', {}).get('rendement_predit'),
                'dbo5_entree': donnees['dbo5_mg_l'],
                'dbo5_sortie_predite': predictions.get('dbo5_mg_l', {}).get('sortie_predite'),
                'dbo5_rendement': predictions.get('dbo5_mg_l', {}).get('rendement_predit'),
                'conforme': analyse['conforme'],
                'niveau': analyse['niveau_global']
            })
    
    if resultats:
        # Sauvegarder
        df_resultats = pd.DataFrame(resultats)
        output_path = '../resultats/predictions_batch.csv'
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        df_resultats.to_csv(output_path, index=False)
        
        print(f"\n✅ {len(resultats)} prédictions effectuées")
        print(f"💾 Résultats sauvegardés: {output_path}")
        
        # Statistiques
        conformes = df_resultats['conforme'].sum()
        print(f"\n📊 Résumé:")
        print(f"   Conformes: {conformes}/{len(resultats)} ({conformes/len(resultats)*100:.1f}%)")
        print(f"   Alertes préventives: {len(resultats) - conformes}")


# ==================================================
# MAIN
# ==================================================

def main():
    parser = argparse.ArgumentParser(description='Système de Prédiction ML')
    parser.add_argument('--interactive', action='store_true', help='Mode interactif')
    parser.add_argument('--kuzzle', action='store_true', help='Mode Kuzzle temps réel')
    parser.add_argument('--batch', type=str, help='Mode batch (chemin CSV)')
    
    args = parser.parse_args()
    
    if args.interactive:
        mode_interactif()
    elif args.kuzzle:
        mode_kuzzle()
    elif args.batch:
        mode_batch(args.batch)
    else:
        # Menu par défaut
        print("\n" + "="*70)
        print("  🤖 SYSTÈME DE PRÉDICTION ML - STATION SANAR")
        print("="*70)
        print("\n📋 MODES DISPONIBLES:")
        print("  1. Mode Interactif (test manuel)")
        print("  2. Mode Kuzzle (temps réel)")
        print("  3. Mode Batch (CSV complet)")
        print("  4. Quitter")
        
        choix = input("\nVotre choix (1-4): ").strip()
        
        if choix == '1':
            mode_interactif()
        elif choix == '2':
            mode_kuzzle()
        elif choix == '3':
            csv_path = input("Chemin du CSV: ").strip()
            mode_batch(csv_path)
        else:
            print("👋 Au revoir !")


if __name__ == "__main__":
    main()