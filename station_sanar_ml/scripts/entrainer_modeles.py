"""
Entraînement des Modèles de Prédiction ML
Station Sanar - Prédiction de Qualité d'Eau

Ce script :
1. Charge les données CSV
2. Prépare les paires Entrée-Sortie
3. Calcule les RENDEMENTS (plus stable avec peu de données)
4. Entraîne des modèles Ridge/Lasso
5. Sauvegarde les modèles dans models/
6. Génère des graphiques de performance
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.linear_model import Ridge, Lasso
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
import matplotlib.pyplot as plt
import joblib
import os
import warnings
warnings.filterwarnings('ignore')

# Configuration
plt.rcParams['figure.figsize'] = (12, 8)

# ==================================================
# CLASSE PRÉPARATION DES DONNÉES
# ==================================================

class PreparateurDonnees:
    """Prépare les données pour l'entraînement ML"""
    
    def __init__(self, csv_path):
        self.csv_path = csv_path
        self.df = None
        
        # PAS de groupes - utiliser directement FV1, FV2, FH
        # Car dans le CSV, il n'y a pas de suffixes a, b, c
        self.groupes_filtres = {
            'FV1': ['FV1'],  # Tous les FV1 sont déjà groupés
            'FV2': ['FV2'],  # Tous les FV2 sont déjà groupés
            'FH': ['FH']     # Tous les FH sont déjà groupés
        }
    
    def charger_donnees(self):
        """Charger et nettoyer le CSV"""
        print("\n📂 Chargement des données...")
        self.df = pd.read_csv(self.csv_path)
        
        print(f"   Total lignes: {len(self.df)}")
        
        # Garder seulement les lignes complètes (sans valeurs estimées)
        self.df = self.df[self.df['contient_valeurs_estimees'] == False].copy()
        
        print(f"   Lignes non estimées: {len(self.df)}")
        
        # Supprimer lignes avec trop de NaN
        colonnes_importantes = ['dco_mg_l', 'dbo5_mg_l', 'mes_mg_l', 'ph']
        self.df = self.df.dropna(subset=colonnes_importantes, thresh=3)
        
        print(f"✅ Données nettoyées: {len(self.df)} lignes")
        
        return self
    
    def creer_paires_entree_sortie(self, groupe_filtre):
        """
        Créer des paires (Entrée, Sortie) pour un groupe de filtres
        
        Stratégie: Regrouper les filtres similaires (a, b, c) pour avoir plus de données
        """
        
        print(f"\n🔄 Création des paires pour {groupe_filtre}...")
        
        # Déterminer le filtre d'entrée associé
        if groupe_filtre == 'FH':
            id_filtre_entree = 'General'
        else:
            id_filtre_entree = groupe_filtre  # FV1 ou FV2
        
        # Extraire les entrées
        entrees = self.df[
            (self.df['phase'] == 'Entree') & 
            (self.df['id_filtre'] == id_filtre_entree)
        ].copy()
        
        # Extraire les sorties
        filtres_sortie = self.groupes_filtres[groupe_filtre]
        sorties = self.df[
            (self.df['phase'] == 'Sortie') & 
            (self.df['id_filtre'].isin(filtres_sortie))
        ].copy()
        
        print(f"   Entrées: {len(entrees)}")
        print(f"   Sorties: {len(sorties)}")
        
        if len(entrees) == 0 or len(sorties) == 0:
            print(f"⚠️  Pas assez de données pour {groupe_filtre}")
            return None
        
        # Simplifier: prendre la moyenne des sorties (si plusieurs a, b, c par lot)
        # Pour simplifier, on associe par ordre (assumer ordre chronologique)
        
        min_len = min(len(entrees), len(sorties))
        
        if min_len < 3:
            print(f"⚠️  Seulement {min_len} paires - trop peu pour ML fiable")
            return None
        
        # Créer le dataset pairé
        paires = pd.DataFrame()
        
        # Features d'entrée (X)
        paires['entree_dco'] = entrees['dco_mg_l'].iloc[:min_len].values
        paires['entree_dbo5'] = entrees['dbo5_mg_l'].iloc[:min_len].values
        paires['entree_mes'] = entrees['mes_mg_l'].iloc[:min_len].values
        paires['entree_ph'] = entrees['ph'].iloc[:min_len].values
        paires['entree_ammonium'] = entrees['ammonium_mg_l'].iloc[:min_len].values
        
        # Sorties (y)
        paires['sortie_dco'] = sorties['dco_mg_l'].iloc[:min_len].values
        paires['sortie_dbo5'] = sorties['dbo5_mg_l'].iloc[:min_len].values
        paires['sortie_mes'] = sorties['mes_mg_l'].iloc[:min_len].values
        
        print(f"✅ {len(paires)} paires créées")
        
        return paires
    
    def calculer_rendements(self, paires):
        """
        Calculer les RENDEMENTS au lieu des valeurs absolues
        
        Pourquoi ? Plus stable avec peu de données !
        Rendement = (Entrée - Sortie) / Entrée × 100
        """
        
        if paires is None:
            return None
        
        rendements = pd.DataFrame()
        
        # Calculer rendements en pourcentage
        rendements['rendement_dco'] = (
            (paires['entree_dco'] - paires['sortie_dco']) / paires['entree_dco'] * 100
        )
        rendements['rendement_dbo5'] = (
            (paires['entree_dbo5'] - paires['sortie_dbo5']) / paires['entree_dbo5'] * 100
        )
        rendements['rendement_mes'] = (
            (paires['entree_mes'] - paires['sortie_mes']) / paires['entree_mes'] * 100
        )
        
        # Garder les features d'entrée
        rendements['entree_dco'] = paires['entree_dco']
        rendements['entree_dbo5'] = paires['entree_dbo5']
        rendements['entree_mes'] = paires['entree_mes']
        rendements['entree_ph'] = paires['entree_ph']
        rendements['entree_ammonium'] = paires['entree_ammonium']
        
        # NETTOYAGE PLUS STRICT des valeurs aberrantes
        print(f"   Avant nettoyage: {len(rendements)} échantillons")
        
        for col in ['rendement_dco', 'rendement_dbo5', 'rendement_mes']:
            # Supprimer rendements impossibles
            rendements = rendements[
                (rendements[col] >= -10) & (rendements[col] <= 100)  # Tolérer -10% pour erreurs mesure
            ]
        
        # Supprimer lignes avec valeurs d'entrée aberrantes (< 10 ou > 5000)
        for col in ['entree_dco', 'entree_dbo5']:
            rendements = rendements[
                (rendements[col] >= 10) & (rendements[col] <= 5000)
            ]
        
        print(f"   Après nettoyage: {len(rendements)} échantillons valides")
        
        if len(rendements) < 3:
            print(f"   ⚠️  Pas assez de données après nettoyage")
            return None
        
        return rendements

    def engineer_features(self, rendements):
        """
        Feature Engineering 
        """
        if rendements is None:
            return None
        
        df = rendements.copy()
        
        # 1. Ratio DCO/DBO5 seulement
        df['ratio_dco_dbo5'] = df['entree_dco'] / df['entree_dbo5']
        
        
        # Gérer les valeurs infinies créées par les divisions
        df = df.replace([np.inf, -np.inf], np.nan)
        df = df.dropna()
        
        print(f"   Feature engineering: {len(df.columns)} variables créées")
        
        return df


# ==================================================
# CLASSE MODÈLE ML
# ==================================================

class ModeleRendement:
    """Modèle de prédiction des rendements"""
    
    def __init__(self, alpha=1.0, use_lasso=False):
        self.model = Lasso(alpha=alpha, max_iter=5000) if use_lasso else Ridge(alpha=alpha)
        self.scaler = StandardScaler()
        self.features = None
        self.target = None
        self.metrics = {}
    
    def preparer_features(self, rendements, target, features):
        """Préparer X et y"""
        
        X = rendements[features].copy()
        y = rendements[target].copy()
        
        # Supprimer les NaN
        mask = ~(X.isna().any(axis=1) | y.isna())
        X = X[mask]
        y = y[mask]
        
        self.features = features
        self.target = target
        
        return X, y
    
    def entrainer(self, X, y, test_size=0.2):
        """Entraîner le modèle avec validation"""
        
        if len(X) < 5:
            print(f"⚠️  ATTENTION: Seulement {len(X)} échantillons - Risque d'overfitting!")
        
        # Split train/test
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42, shuffle=True
        )
        
        # Normalisation
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Entraînement
        self.model.fit(X_train_scaled, y_train)
        
        # Prédictions
        y_pred_train = self.model.predict(X_train_scaled)
        y_pred_test = self.model.predict(X_test_scaled)
        
        # Validation croisée K=3 comme décrit dans le chapitre 2.5.4.3
        cv_folds = min(3, len(X_train))  # K=3 folds, adapté à la taille des données
        cv_scores = cross_val_score(
            self.model, X_train_scaled, y_train, 
            cv=cv_folds, 
            scoring='r2'
        )
        
        # Métriques COMPLÈTES avec validation croisée
        self.metrics = {
            'train_r2': r2_score(y_train, y_pred_train),
            'test_r2': r2_score(y_test, y_pred_test),
            'train_rmse': np.sqrt(mean_squared_error(y_train, y_pred_train)),
            'test_rmse': np.sqrt(mean_squared_error(y_test, y_pred_test)),
            'train_mae': mean_absolute_error(y_train, y_pred_train),
            'test_mae': mean_absolute_error(y_test, y_pred_test),
            'cv_r2_mean': cv_scores.mean(),           # NOUVEAU
            'cv_r2_std': cv_scores.std(),             # NOUVEAU
            'cv_folds': cv_folds,                     # NOUVEAU
            'n_samples': len(X),
            'n_features': len(self.features)
        }
        
        return self.metrics, (X_test, y_test, y_pred_test)
    
    def predire(self, X_new):
        """Prédire le rendement pour nouvelles données"""
        X_scaled = self.scaler.transform(X_new)
        return self.model.predict(X_scaled)
    
    def sauvegarder(self, filepath):
        """Sauvegarder le modèle"""
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        joblib.dump({
            'model': self.model,
            'scaler': self.scaler,
            'features': self.features,
            'target': self.target,
            'metrics': self.metrics
        }, filepath)
        
        print(f"✅ Modèle sauvegardé: {filepath}")
    
    @classmethod
    def charger(cls, filepath):
        """Charger un modèle sauvegardé"""
        data = joblib.load(filepath)
        
        modele = cls()
        modele.model = data['model']
        modele.scaler = data['scaler']
        modele.features = data['features']
        modele.target = data['target']
        modele.metrics = data.get('metrics', {})
        
        return modele


# ==================================================
# FONCTIONS DE VISUALISATION
# ==================================================

def afficher_metriques(metrics, nom_modele):
    """Afficher les métriques de performance"""
    
    print(f"\n📊 Métriques - {nom_modele}")
    print("-" * 60)
    print(f"  R² Train:        {metrics['train_r2']:.3f}")
    print(f"  R² Test:         {metrics['test_r2']:.3f}")
    print(f"  R² CV (K={metrics['cv_folds']}): {metrics['cv_r2_mean']:.3f} ± {metrics['cv_r2_std']:.3f}")
    print(f"  RMSE Train:      {metrics['train_rmse']:.2f}%")
    print(f"  RMSE Test:       {metrics['test_rmse']:.2f}%")
    print(f"  Échantillons:    {metrics['n_samples']}")
    print(f"  Features:        {metrics['n_features']}")
    
    # Diagnostic amélioré
    ecart_train_test = abs(metrics['train_r2'] - metrics['test_r2'])
    ecart_cv_test = abs(metrics['cv_r2_mean'] - metrics['test_r2'])
    
    if ecart_train_test > 0.2:
        print(f"\n  ⚠️  Écart Train-Test élevé ({ecart_train_test:.3f}) → Risque d'overfitting")
    elif metrics['test_r2'] < 0.5:
        print(f"\n  ⚠️  R² Test faible ({metrics['test_r2']:.3f}) → Modèle peu précis")
    elif ecart_cv_test > 0.15:
        print(f"\n  ⚠️  Écart CV-Test ({ecart_cv_test:.3f}) → Validation croisée à considérer")
    else:
        print(f"\n  ✅ Modèle robuste et fiable")


def creer_graphiques(y_test, y_pred, nom_modele, output_dir='../graphiques'):
    """Créer graphiques de performance"""
    
    os.makedirs(output_dir, exist_ok=True)
    
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    
    # Scatter plot: Prédit vs Réel
    axes[0].scatter(y_test, y_pred, alpha=0.6, s=100, edgecolors='black')
    axes[0].plot([y_test.min(), y_test.max()], [y_test.min(), y_test.max()], 
                 'r--', lw=2, label='Prédiction parfaite')
    axes[0].set_xlabel('Rendement Réel (%)', fontsize=12)
    axes[0].set_ylabel('Rendement Prédit (%)', fontsize=12)
    axes[0].set_title(f'Prédictions vs Réel - {nom_modele}', fontsize=14, fontweight='bold')
    axes[0].legend()
    axes[0].grid(alpha=0.3)
    
    # Résidus
    residus = y_test.values - y_pred
    axes[1].scatter(y_pred, residus, alpha=0.6, s=100, edgecolors='black', color='coral')
    axes[1].axhline(y=0, color='r', linestyle='--', lw=2)
    axes[1].set_xlabel('Rendement Prédit (%)', fontsize=12)
    axes[1].set_ylabel('Résidus (%)', fontsize=12)
    axes[1].set_title('Analyse des Résidus', fontsize=14, fontweight='bold')
    axes[1].grid(alpha=0.3)
    
    plt.tight_layout()
    
    filepath = os.path.join(output_dir, f'{nom_modele}_performance.png')
    plt.savefig(filepath, dpi=300, bbox_inches='tight')
    print(f"📊 Graphique sauvegardé: {filepath}")
    plt.close()


# ==================================================
# FONCTION PRINCIPALE
# ==================================================

def main():
    """Entraîner tous les modèles"""
    
    print("\n" + "="*70)
    print("  🤖 ENTRAÎNEMENT DES MODÈLES ML - STATION SANAR")
    print("  Prédiction des Rendements d'Épuration")
    print("="*70)
    
    # Chemin du CSV
    csv_path = '../data/UGB_Sanar_Station_Final.csv'
    
    if not os.path.exists(csv_path):
        print(f"\n❌ Fichier introuvable: {csv_path}")
        print("\n💡 Solution: Placez votre CSV dans le dossier data/")
        return
    
    # Préparation des données
    prep = PreparateurDonnees(csv_path)
    prep.charger_donnees()
    
    # Configuration SIMPLIFIÉE - Moins de features
    configurations = [
        # (groupe_filtre, variable_cible, features)
        ('FV1', 'rendement_dco', ['entree_dco', 'entree_ph', 'entree_mes']),
        ('FV1', 'rendement_dbo5', ['entree_dbo5', 'entree_ph', 'entree_mes']),
        ('FV2', 'rendement_dco', ['entree_dco', 'entree_ph']),
        ('FV2', 'rendement_dbo5', ['entree_dbo5', 'entree_ph']),
        ('FH', 'rendement_dco', ['entree_dco', 'entree_ph', 'entree_mes']),
        ('FH', 'rendement_dbo5', ['entree_dbo5', 'entree_ph', 'entree_mes']),
    ]
    
    modeles_entraines = []
    tous_metrics = []
    
    for groupe, target, features in configurations:
        print("\n" + "="*70)
        print(f"  ENTRAÎNEMENT: {groupe} - {target}")
        print("="*70)
        
        # Préparer données
        paires = prep.creer_paires_entree_sortie(groupe)
        if paires is None:
            continue
        
        rendements = prep.calculer_rendements(paires)
        if rendements is None or len(rendements) < 3:
            print(f"⚠️  Pas assez de données pour {groupe}")
            continue
        
        # AJOUT: Feature Engineering
        rendements = prep.engineer_features(rendements)
        if rendements is None or len(rendements) < 3:
            print(f"⚠️  Données insuffisantes après feature engineering")
            continue
        
        # Créer et entraîner modèle
        modele = ModeleRendement(alpha=0.5)
        
        try:
            X, y = modele.preparer_features(rendements, target, features)
            
            if len(X) < 3:
                print(f"⚠️  Seulement {len(X)} échantillons - skippé")
                continue
            
            metrics, (X_test, y_test, y_pred) = modele.entrainer(X, y)
            
            # Afficher résultats
            nom_modele = f"{groupe}_{target.split('_')[1]}"
            afficher_metriques(metrics, nom_modele)
            
            # Sauvegarder modèle
            modele.sauvegarder(f'../models/{nom_modele}_model.pkl')
            
            # Créer graphiques
            if len(X_test) > 0:
                creer_graphiques(y_test, y_pred, nom_modele)
            
            modeles_entraines.append(nom_modele)
            tous_metrics.append((nom_modele, metrics))
            
        except Exception as e:
            print(f"❌ Erreur: {e}")
            continue
    
    # Résumé final
    print("\n" + "="*70)
    print("  ✅ ENTRAÎNEMENT TERMINÉ")
    print("="*70)
    print(f"\nModèles créés: {len(modeles_entraines)}")
    for nom in modeles_entraines:
        print(f"  ✓ {nom}")
    
    print(f"\nFichiers sauvegardés dans:")
    print(f"  - Modèles: models/")
    print(f"  - Graphiques: graphiques/")
    
    if tous_metrics:
        print(f"\n📊 Performance moyenne:")
        r2_moyen = np.mean([m[1]['test_r2'] for m in tous_metrics])
        print(f"  R² Test moyen: {r2_moyen:.3f}")
        
        if r2_moyen < 0.6:
            print(f"\n💡 Conseils d'amélioration:")
            print(f"  • Collecter plus de données (actuellement ~{prep.df.shape[0]} lignes)")
            print(f"  • Ajouter des variables (température, débit...)")
            print(f"  • Réentraîner dans 3-6 mois avec nouvelles données")


if __name__ == "__main__":
    main()