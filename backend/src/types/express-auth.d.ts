// src/types/auth.d.ts

// Définition unique de l'utilisateur authentifié (basée sur votre code existant)
export interface AuthUser {
  id: string;
  email: string;
  role: string;
  stationId?: string; // Utilisez stationId car c'est ce que requireStationAccess utilise
}

// Extension du namespace Express (UNE SEULE FOIS dans tout le projet)
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}