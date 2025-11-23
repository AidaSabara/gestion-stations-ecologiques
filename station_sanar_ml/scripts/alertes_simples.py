"""
Système d'Alertes Automatique - Station Sanar
Version SIMPLE (sans Machine Learning pour commencer)

Ce script :
1. Lit les données de sortie des filtres
2. Compare aux seuils réglementaires
3. Génère des alertes si dépassement
4. Sauvegarde les alertes dans un fichier JSON
"""

import pandas as pd
import json
from datetime import datetime
import os
import sys

# Importer la configuration des seuils
from config_seuils import (
    get_seuil,
    determiner_niveau_alerte,
    verifier_ph,
    NIVEAUX_ALERTE
)


class SystemeAlertesSimple:
    """Système d'alertes basé sur les données réelles (sans prédiction ML)"""
    
    def __init__(self, csv_path, output_dir='../logs'):
        self.csv_path = csv_path
        self.output_dir = output_dir
        self.df = None
        self.alertes = []
        
        # Créer le dossier logs s'il n'existe pas
        os.makedirs(output_dir, exist_ok=True)
    
    def charger_donnees(self):
        """Charger les données du CSV"""
        print("📂 Chargement des données...")
        self.df = pd.read_csv(self.csv_path)
        
        # Filtrer uniquement les sorties (phase='Sortie')
        self.df_sorties = self.df[self.df['phase'] == 'Sortie'].copy()
        
        # Supprimer les lignes avec valeurs estimées
        self.df_sorties = self.df_sorties[
            self.df_sorties['contient_valeurs_estimees'] == False
        ]
        
        print(f"✅ {len(self.df_sorties)} échantillons de sortie chargés")
        return self
    
    def analyser_echantillon(self, row):
        """
        Analyser un échantillon et détecter les dépassements
        
        Args:
            row: ligne du DataFrame (un échantillon)
        
        Returns:
            dict: informations sur l'échantillon et alertes
        """
        filtre = row['id_filtre'].rstrip('abc')  # Enlever a, b, c
        
        # Mapper vers groupe de filtres
        if 'FV1' in filtre:
            groupe_filtre = 'FV1'
        elif 'FV2' in filtre:
            groupe_filtre = 'FV2'
        elif 'FH' in filtre:
            groupe_filtre = 'FH'
        else:
            groupe_filtre = 'general'
        
        # Paramètres à vérifier
        parametres_a_verifier = {
            'dco_mg_l': row.get('dco_mg_l'),
            'dbo5_mg_l': row.get('dbo5_mg_l'),
            'mes_mg_l': row.get('mes_mg_l'),
            'ammonium_mg_l': row.get('ammonium_mg_l'),
            'nitrates_mg_l': row.get('nitrates_mg_l'),
            'phosphates_mg_l': row.get('phosphates_mg_l'),
            'coliformes_fecaux_cfu_100ml': row.get('coliformes_fecaux_cfu_100ml')
        }
        
        depassements = []
        niveau_max = 'CONFORME'
        
        # Vérifier chaque paramètre
        for param, valeur in parametres_a_verifier.items():
            if pd.isna(valeur) or valeur is None:
                continue  # Ignorer les valeurs manquantes
            
            seuil = get_seuil(param, groupe_filtre)
            if seuil is None:
                continue
            
            niveau = determiner_niveau_alerte(valeur, seuil)
            
            # Enregistrer si dépassement
            if niveau != 'CONFORME':
                depassement = {
                    'parametre': param,
                    'valeur': float(valeur),
                    'seuil': float(seuil),
                    'ratio': float(valeur / seuil),
                    'niveau': niveau,
                    'action': NIVEAUX_ALERTE[niveau]['action']
                }
                depassements.append(depassement)
                
                # Mettre à jour le niveau max
                if NIVEAUX_ALERTE[niveau]['priorite'] > NIVEAUX_ALERTE[niveau_max]['priorite']:
                    niveau_max = niveau
        
        # Vérifier le pH (cas spécial)
        ph_value = row.get('ph')
        if not pd.isna(ph_value) and ph_value is not None:
            conforme_ph, niveau_ph = verifier_ph(ph_value)
            if not conforme_ph:
                depassement_ph = {
                    'parametre': 'ph',
                    'valeur': float(ph_value),
                    'seuil': '6.5-8.5',
                    'ratio': None,
                    'niveau': niveau_ph,
                    'action': NIVEAUX_ALERTE[niveau_ph]['action']
                }
                depassements.append(depassement_ph)
                
                if NIVEAUX_ALERTE[niveau_ph]['priorite'] > NIVEAUX_ALERTE[niveau_max]['priorite']:
                    niveau_max = niveau_ph
        
        # Résultat de l'analyse
        resultat = {
            'id_station': row.get('id_station'),
            'filtre': row.get('id_filtre'),
            'groupe_filtre': groupe_filtre,
            'nom_feuille': row.get('nom_feuille'),
            'timestamp': datetime.now().isoformat(),
            'niveau_global': niveau_max,
            'conforme': niveau_max == 'CONFORME',
            'nombre_depassements': len(depassements),
            'depassements': depassements
        }
        
        return resultat
    
    def analyser_tous_echantillons(self):
        """Analyser tous les échantillons de sortie"""
        print("\n🔍 Analyse des échantillons en cours...\n")
        
        resultats = []
        alertes_generees = []
        
        for idx, row in self.df_sorties.iterrows():
            resultat = self.analyser_echantillon(row)
            resultats.append(resultat)
            
            # Si non conforme, c'est une alerte
            if not resultat['conforme']:
                alertes_generees.append(resultat)
        
        self.resultats = resultats
        self.alertes = alertes_generees
        
        print(f"✅ Analyse terminée :")
        print(f"   - Total échantillons analysés : {len(resultats)}")
        print(f"   - Échantillons conformes : {len([r for r in resultats if r['conforme']])}")
        print(f"   - Alertes générées : {len(alertes_generees)}")
        
        return self
    
    def afficher_resume(self):
        """Afficher un résumé des alertes"""
        print("\n" + "="*70)
        print("  📊 RÉSUMÉ DES ALERTES")
        print("="*70 + "\n")
        
        if not self.alertes:
            print("✅ Aucune alerte ! Tous les échantillons sont conformes.\n")
            return
        
        # Grouper par niveau
        par_niveau = {}
        for alerte in self.alertes:
            niveau = alerte['niveau_global']
            if niveau not in par_niveau:
                par_niveau[niveau] = []
            par_niveau[niveau].append(alerte)
        
        # Afficher par niveau (du plus grave au moins grave)
        for niveau in ['CRITIQUE', 'ALERTE', 'ATTENTION']:
            if niveau in par_niveau:
                alertes_niveau = par_niveau[niveau]
                icone = NIVEAUX_ALERTE[niveau]['icone']
                print(f"{icone} {niveau} : {len(alertes_niveau)} alerte(s)")
                print("-" * 70)
                
                for alerte in alertes_niveau:
                    print(f"  Filtre: {alerte['filtre']} ({alerte['groupe_filtre']})")
                    print(f"  Dépassements:")
                    
                    for dep in alerte['depassements']:
                        param = dep['parametre'].replace('_mg_l', '').replace('_cfu_100ml', '').upper()
                        valeur = dep['valeur']
                        seuil = dep['seuil']
                        
                        if dep['ratio']:
                            print(f"    • {param}: {valeur:.2f} (seuil: {seuil}) - {dep['ratio']:.1%} du seuil")
                        else:
                            print(f"    • {param}: {valeur:.2f} (plage acceptée: {seuil})")
                    
                    print(f"  ⚠️  Action: {NIVEAUX_ALERTE[niveau]['action']}")
                    print()
        
        print("="*70 + "\n")
    
    def sauvegarder_alertes(self):
        """Sauvegarder les alertes dans un fichier JSON"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"alertes_{timestamp}.json"
        filepath = os.path.join(self.output_dir, filename)
        
        # Données à sauvegarder
        data = {
            'timestamp_analyse': datetime.now().isoformat(),
            'nombre_total_echantillons': len(self.resultats),
            'nombre_echantillons_conformes': len([r for r in self.resultats if r['conforme']]),
            'nombre_alertes': len(self.alertes),
            'alertes': self.alertes,
            'tous_resultats': self.resultats
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f"💾 Alertes sauvegardées : {filepath}")
        
        # Sauvegarder aussi un résumé en texte
        self.sauvegarder_resume_texte(timestamp)
    
    def sauvegarder_resume_texte(self, timestamp):
        """Sauvegarder un résumé en texte lisible"""
        filename = f"resume_{timestamp}.txt"
        filepath = os.path.join(self.output_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("="*70 + "\n")
            f.write("  RAPPORT D'ANALYSE - STATION SANAR\n")
            f.write(f"  Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("="*70 + "\n\n")
            
            f.write(f"Échantillons analysés : {len(self.resultats)}\n")
            f.write(f"Conformes : {len([r for r in self.resultats if r['conforme']])}\n")
            f.write(f"Non-conformes : {len(self.alertes)}\n\n")
            
            if self.alertes:
                f.write("ALERTES DÉTAILLÉES:\n")
                f.write("-"*70 + "\n\n")
                
                for i, alerte in enumerate(self.alertes, 1):
                    f.write(f"ALERTE #{i}\n")
                    f.write(f"Filtre: {alerte['filtre']} ({alerte['groupe_filtre']})\n")
                    f.write(f"Niveau: {alerte['niveau_global']}\n")
                    f.write(f"Nombre de dépassements: {alerte['nombre_depassements']}\n\n")
                    
                    f.write("Détails des dépassements:\n")
                    for dep in alerte['depassements']:
                        param = dep['parametre']
                        f.write(f"  - {param}: {dep['valeur']:.2f} (seuil: {dep['seuil']})\n")
                        f.write(f"    Action requise: {dep['action']}\n")
                    
                    f.write("\n" + "-"*70 + "\n\n")
            else:
                f.write("✅ Aucune alerte. Tous les échantillons sont conformes.\n")
        
        print(f"📄 Résumé texte sauvegardé : {filepath}")


# ==================================================
# FONCTION PRINCIPALE
# ==================================================

def main():
    """Point d'entrée du programme"""
    print("\n" + "="*70)
    print("  🚨 SYSTÈME D'ALERTES AUTOMATIQUE - STATION SANAR")
    print("="*70 + "\n")
    
    # Chemin vers le CSV
    csv_path = '../data/UGB_Sanar_Station_Final.csv'
    
    # Vérifier que le fichier existe
    if not os.path.exists(csv_path):
        print(f"❌ ERREUR: Fichier introuvable : {csv_path}")
        print("\n💡 Solution :")
        print("   1. Vérifiez que le fichier CSV est dans le dossier 'data/'")
        print("   2. Ou modifiez la variable csv_path dans ce script")
        return
    
    # Créer le système d'alertes
    systeme = SystemeAlertesSimple(csv_path)
    
    try:
        # Étape 1: Charger les données
        systeme.charger_donnees()
        
        # Étape 2: Analyser tous les échantillons
        systeme.analyser_tous_echantillons()
        
        # Étape 3: Afficher le résumé
        systeme.afficher_resume()
        
        # Étape 4: Sauvegarder les résultats
        systeme.sauvegarder_alertes()
        
        print("\n✅ Analyse terminée avec succès !")
        print(f"📁 Les résultats sont dans le dossier : {systeme.output_dir}/\n")
        
    except Exception as e:
        print(f"\n❌ ERREUR lors de l'exécution : {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()