"""
Script de Diagnostic des Données
Comprendre la structure exacte de votre CSV
"""

import pandas as pd
import os

csv_path = '../data/UGB_Sanar_Station_Final.csv'

print("\n" + "="*70)
print("  🔍 DIAGNOSTIC DES DONNÉES")
print("="*70 + "\n")

if not os.path.exists(csv_path):
    print(f"❌ Fichier introuvable: {csv_path}")
    exit(1)

# Charger le CSV
df = pd.read_csv(csv_path)

print(f"📊 Informations générales:")
print(f"   Total lignes: {len(df)}")
print(f"   Colonnes: {list(df.columns)}")

print("\n" + "-"*70)
print("📋 Valeurs uniques par colonne clé:\n")

# Phase
print("PHASE:")
print(df['phase'].value_counts())
print()

# ID Filtre
print("ID_FILTRE (tous):")
print(df['id_filtre'].value_counts())
print()

# ID Filtre par phase
print("ID_FILTRE pour ENTRÉES:")
entrees = df[df['phase'] == 'Entree']
print(entrees['id_filtre'].value_counts())
print(f"Total entrées: {len(entrees)}")
print()

print("ID_FILTRE pour SORTIES:")
sorties = df[df['phase'] == 'Sortie']
print(sorties['id_filtre'].value_counts())
print(f"Total sorties: {len(sorties)}")
print()

# Type de filtre
print("TYPE_FILTRE:")
print(df['type_filtre'].value_counts())
print()

# Valeurs estimées
print("CONTIENT_VALEURS_ESTIMEES:")
print(df['contient_valeurs_estimees'].value_counts())
print()

# Données non estimées
df_clean = df[df['contient_valeurs_estimees'] == False]
print(f"📊 Données NON ESTIMÉES: {len(df_clean)} lignes")
print(f"   Entrées: {len(df_clean[df_clean['phase']=='Entree'])}")
print(f"   Sorties: {len(df_clean[df_clean['phase']=='Sortie'])}")

print("\n" + "-"*70)
print("🔎 Analyse des SORTIES (phase='Sortie', non estimées):\n")

sorties_clean = df_clean[df_clean['phase'] == 'Sortie']
print(f"Total sorties valides: {len(sorties_clean)}")
print("\nRépartition par id_filtre:")
print(sorties_clean['id_filtre'].value_counts())

print("\n" + "-"*70)
print("🔎 Exemple de données SORTIES:\n")
print(sorties_clean[['id_filtre', 'type_filtre', 'dco_mg_l', 'dbo5_mg_l', 'ph']].head(10))

print("\n" + "-"*70)
print("🔎 Analyse des ENTRÉES (phase='Entree', non estimées):\n")

entrees_clean = df_clean[df_clean['phase'] == 'Entree']
print(f"Total entrées valides: {len(entrees_clean)}")
print("\nRépartition par id_filtre:")
print(entrees_clean['id_filtre'].value_counts())

print("\n" + "-"*70)
print("🔎 Exemple de données ENTRÉES:\n")
print(entrees_clean[['id_filtre', 'type_filtre', 'dco_mg_l', 'dbo5_mg_l', 'ph']].head(10))

print("\n" + "="*70)
print("  ✅ DIAGNOSTIC TERMINÉ")
print("="*70)
print("\n💡 Action suivante:")
print("   Regardez les noms EXACTS dans 'ID_FILTRE pour SORTIES'")
print("   Ces noms doivent correspondre à ceux dans entrainer_modeles.py")
print()