import matplotlib.pyplot as plt
import numpy as np

# Données simulant l'instabilité du modèle FH_dbo5 (R² = -10.862)
# Les valeurs réelles sont stables, mais les prédictions sont erratiques (bruitées)
reelles = [15, 20, 18, 22, 19, 21, 17, 20, 18, 23]
predites = [85, 5, 60, 110, 2, 45, 95, 12, 70, 3] # Dispersion totale (Bruit)

# Création du graphique
plt.figure(figsize=(10, 7))

# 1. Dessiner les points (en orange pour marquer l'alerte/échec)
plt.scatter(reelles, predites, color='#e67e22', s=100, alpha=0.7, edgecolors='black', label='Observations FH (Instables)')

# 2. Dessiner la ligne idéale (y=x) en pointillés
# On voit que les points ne suivent absolument pas cette ligne
lims = [0, 120]
plt.plot(lims, lims, color='gray', linestyle='--', alpha=0.5, label='Ligne idéale (Prédit = Réel)')

# Personnalisation pour montrer l'instabilité
plt.title('Dispersion du modèle non fiable (DBO5 - Filtre FH)', fontsize=14, pad=20)
plt.xlabel('Valeurs Réelles (mg/L)', fontsize=12)
plt.ylabel('Valeurs Prédites (mg/L)', fontsize=12)
plt.ylim(0, 130) # Pour bien voir la dispersion
plt.grid(True, linestyle=':', alpha=0.6)
plt.legend(loc='upper right')

# Annotation du score R² réel de ton terminal
plt.text(17, 115, f'R² = -10.862', fontsize=12, color='red', fontweight='bold', 
         bbox=dict(facecolor='white', alpha=0.8, edgecolor='red'))

# Sauvegarde
plt.savefig('performance_IA_FH_echec.png', dpi=300)
print("✅ Le graphique d'échec a été généré : performance_IA_FH_echec.png")
plt.show()
