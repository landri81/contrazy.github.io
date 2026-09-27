# Plateforme de réservation LOCAZ — Cahier des charges produit (PRD)

| | |
|---|---|
| **Produit** | LOCAZ — plateforme de location de voitures et utilitaires en self-service (application web, back-office d'administration, API) |
| **Préparé pour** | Aziz LANDRI, LOCAZ |
| **Préparé par** | Shakil Khan |
| **Version** | 1.0 — pour relecture |
| **Date** | 27 septembre 2026 |
| **Statut** | Projet à valider — décisions attendues en section 14 |

---

## 1. Résumé

LOCAZ loue des voitures, des utilitaires et des camions à Nice en self-service : le client réserve, signe, paie et récupère le véhicule sans passer par un comptoir. Jusqu'à présent, la flotte et les tarifs étaient gérés dans RentHub. Ce contrat a pris fin : RentHub était trop complexe pour les besoins de LOCAZ et il lui manquait des fonctions de paiement essentielles.

Nous allons construire **la plateforme propre à LOCAZ**, composée de trois parties :

1. **Site de réservation** (`booking.locaz.co`) — le client choisit ses dates, son lieu et son véhicule, voit le prix immédiatement, ajoute des options, et seulement ensuite crée son compte et paie.
2. **Back-office d'administration** — pour qu'Aziz et son équipe gèrent la flotte, les tarifs, le planning, les réservations, les clients et les règles de l'entreprise.
3. **API** — pour que la future application mobile LOCAZ et les boîtiers des véhicules (ouverture/fermeture à distance et traceur GPS) se connectent au même système.

Les étapes lourdes et sensibles — **vérification d'identité, documents, contrat, signature électronique, paiement, caution, photos d'état des lieux et litiges** — sont déjà développées dans **Contrazy**. LOCAZ sera **le premier client de Contrazy** : la plateforme de réservation transmet chaque réservation confirmée à Contrazy, et Contrazy lui signale l'avancement de chaque étape. Le client n'a pas besoin de savoir que Contrazy est utilisé.

Ce document s'appuie sur :
- notre réunion du 28 août 2026 (transcription complète relue) ;
- une revue complète, en lecture seule, du compte RentHub de LOCAZ le 27 septembre 2026 (les ~110 écrans d'administration, chaque liste de prix, véhicule, modèle, service et paramètre), ainsi que la page de réservation publique RentHub testée avec plusieurs dates et lieux ;
- les CGV publiées de LOCAZ (v3.0, mars 2026), le contrat de location et la politique de confidentialité ;
- le code actuel de Contrazy.

L'ensemble des données RentHub a été exporté le même jour (voir section 12).

---

## 2. Objectifs

| Objectif | Comment on le mesure |
|---|---|
| Remplacer RentHub par un outil plus simple, détenu entièrement par LOCAZ | Toutes les opérations quotidiennes se font sans RentHub |
| Permettre de réserver 100 % depuis le téléphone, 24h/24 | Une réservation se fait sur mobile en moins de 5 minutes, sans appel ni WhatsApp |
| Afficher un prix juste et transparent avant toute création de compte | Prix affiché = prix payé ; aucun compte nécessaire pour chercher et comparer |
| Sécuriser chaque location (identité, contrat, caution, photos) | Chaque location a une pièce d'identité et un permis vérifiés, un contrat signé, une caution et des photos de départ/retour |
| Passer d'environ 10 à plus de 30 véhicules et à d'autres villes françaises | Ajouter une ville, un lieu, une catégorie ou un véhicule ne nécessite aucun développeur |
| Déléguer le travail à une équipe | Des collaborateurs peuvent être invités avec des droits limités |
| Être prêt pour la location sans clé et l'application mobile | Les boîtiers et l'application mobile se connectent à l'API documentée |

**Objectif :** lancement pilote à Nice **début 2027**.

---

## 3. Périmètre produit — qui fait quoi

```
    +--------------------------------+
    | Landing page (existante)       |
    | locaz.co                       |
    +--------------------------------+
                   |  "Reserver" (dates d'abord)
                   v
    +--------------------------------+                 +--------------------------------+
    | PLATEFORME LOCAZ               |                 | CONTRAZY                       |
    | booking.locaz.co               |  <--- API --->  | (LOCAZ = premier vendeur)      |
    |                                |                 |                                |
    | - Recherche & moteur de prix   |                 | - Verification d'identite      |
    | - Vehicule & options           |                 | - Identite / permis / domicile |
    | - Compte client                |                 | - Contrat + signature          |
    | - Back-office admin            |                 | - Paiement + caution (Stripe)  |
    | - Planning de la flotte        |                 | - Etats des lieux              |
    | - API publique                 |                 | - Litiges & preuves            |
    +--------------------------------+                 +--------------------------------+
                   |  API
                   v
    +--------------------------------+                 +--------------------------------+
    | Boitiers vehicules (phase 3)   |                 | Application mobile (phase 4)   |
    | - Boite a cle (ouverture)      |                 | Sur la meme API,               |
    | - Traceur GPS (km, carburant)  |                 | par un developpeur mobile      |
    +--------------------------------+                 +--------------------------------+
```

| Domaine | Responsable |
|---|---|
| Landing page, SEO, blog | Site statique existant `locaz.co` (conservé ; « Réserver » renvoie vers la plateforme de réservation) |
| Recherche, calcul du prix, disponibilité, options | **Plateforme LOCAZ** (nouvelle) |
| Flotte, lieux, catégories, tarifs, services, règles | Back-office de la **plateforme LOCAZ** (nouveau) |
| Réservations, planning de la flotte, clients, liste noire | Back-office de la **plateforme LOCAZ** (nouveau) |
| Identité, documents, contrat, signature | **Contrazy** (existant, petites extensions) |
| Paiement de la location, caution (blocage/prélèvement/libération) | **Contrazy** via le compte Stripe de LOCAZ (existant) |
| Photos de départ/retour, relevés carburant et km | État des lieux (check-in / check-out) **Contrazy** (existant) |
| Sinistres, amendes, litiges | Litiges **Contrazy** (existant) + barème de pénalités LOCAZ |
| Ouverture/fermeture, GPS, kilométrage, niveau de carburant | Fournisseurs de boîtiers, connectés via l'API LOCAZ (phase 3) |
| Application mobile native | Développeur mobile, via l'API LOCAZ (phase 4) |

---

## 4. Utilisateurs et rôles

| Rôle | Qui | Peut faire |
|---|---|---|
| **Super administrateur** | Aziz | Tout, y compris paramètres de l'entreprise, tarifs, utilisateurs et paiements |
| **Administrateur** | Responsable de confiance | Tout sauf les paramètres de facturation/Stripe et la suppression de données |
| **Opérateur** | Équipe flotte | Réservations, planning, départs/retours, clients, statut des véhicules. Aucune modification de tarifs ou de règles |
| **Assistant opérateur** | Support / nettoyage / livraison | Consulter le planning et les réservations, enregistrer les états des lieux, dégâts et statuts des véhicules |
| **Client** | Locataire | Chercher, réserver, gérer ses réservations, documents et paiements |

Ces rôles correspondent à la demande de LOCAZ pendant la réunion (« Administrateur, opérateur, assistant d'opérateur — c'est suffisant »). Les collaborateurs sont invités par e-mail. Chaque action est enregistrée dans un journal d'audit. Les collaborateurs pourront plus tard être limités à une ville ou un groupe de lieux, pour l'expansion nationale.

---

## 5. Ce que nous gardons de RentHub — priorités

RentHub compte environ 110 écrans. La plupart n'ont jamais été utilisés par LOCAZ. Le tableau ci-dessous reprend chaque domaine de RentHub et notre décision, selon la réunion et ce qui était réellement configuré dans le compte.

**Légende :** **P1** = nécessaire au lancement · **P2** = peu après le lancement · **P3** = plus tard / optionnel · **—** = pas nécessaire

### 5.1 Administration

| Écran RentHub | De quoi il s'agit | Décision |
|---|---|---|
| Données et configurations Société | Informations légales, identifiants fiscaux, règles de fonctionnement | **P1** — paramètres de l'entreprise simplifiés (section 7.10) |
| Utilisateurs / Équipes | Comptes des collaborateurs et groupes | **P1** — Super administrateur + 3 rôles (section 4) ; équipes **P3** |
| Blacklist | Motifs de blocage d'un client (Fumeur, Saleté, Carburant) avec couleurs | **P1** |
| Typologie des documents | Carte d'identité, passeport, justificatif de domicile (< 3 mois) | **P1** — géré par Contrazy |
| Types de permis | Permis international / autre | **P1** — géré par Contrazy |
| Horaires | Horaires d'ouverture par lieu | **P2** — le self-service est 24h/24 ; utile seulement pour les services avec personnel (livraison) |
| Provenances | Application, signalétique, appel, visite, campagnes | — (« on n'en a pas besoin ») — nous enregistrons seulement *web / admin / application* automatiquement |
| IBAN | Comptes bancaires pour les factures | — (virements Stripe) |
| Statut WhatsApp | Liaison serveur WhatsApp (non activée) | **P3** — notifications WhatsApp plus tard |

### 5.2 Location (réservations)

| Écran RentHub | Décision |
|---|---|
| Réservations + planning de la flotte | **P1** — l'écran le plus important (section 7.4) |
| Réservation manuelle par téléphone / sur place | **P1** |
| Litiges | **P1** — via les litiges Contrazy |
| Raisons d'annulation (obligatoires) | **P1** |
| Raisons d'indisponibilité (entretien, réparation…) | **P1** |
| Checklist de départ/retour | **P1** — via l'état des lieux Contrazy |
| Lead time (délai minimum avant le départ, réglé à 60 min) | **P1** |
| Mouvements internes de véhicules | **P2** |
| Demandes d'avis | **P3** |
| Import de réservations, vente libre, hooks courtiers | — |

### 5.3 Flotte

| Écran RentHub | Situation actuelle de LOCAZ | Décision |
|---|---|---|
| Groupes de lieux | 1 groupe : Nice | **P1** (un groupe par ville, pour l'expansion) |
| Lieux | Nice Gare, Nice Aéroport, Nice Ville, Nice Collinettes | **P1** |
| Marques | Renault, Iveco, Fiat, Mercedes, Toyota, Peugeot, Nissan | **P1** |
| Types | Voiture, Utilitaire, Camion | **P1** |
| Catégories | 7 (Petite / Moyenne / Grande voiture ; Petit / Moyen / Grand fourgon ; Camion benne) | **P1** — les tarifs sont fixés par catégorie |
| Modèles | 8 (« Renault Master ou équivalent », etc.) | **P1** |
| Véhicules | 5 véhicules actifs avec immatriculation et kilométrage | **P1** |
| Services additionnels | Conducteur supplémentaire, siège bébé, diable, livraison, 3 niveaux d'assurance | **P1** |
| Règles de franchise et de dépôt | Caution de 1 500 € par modèle ; franchises 1 500 € / 2 500 € | **P1** |
| Marqueurs de dégâts | Rayure (X), Bosse (O) | **P1** — utilisés sur le schéma du véhicule à l'état des lieux |
| Dépenses véhicules (lavage, énergie, révision, assurance, pneus) | Types de dépenses | **P2** |
| Échéances (assurance, contrôle technique, révision) | Calendrier des échéances | **P2** (« on s'en fiche pour l'instant » ; rappels utiles plus tard) |
| Carte de suivi GPS | Non connectée | **P3** — remplacée par notre intégration des boîtiers (phase 3) |
| Modèles de rapport de dégâts, catégories/tarifs de dégâts | Au cas par cas, non configurés | — (barème des CGV utilisé dans les litiges) |
| Propriétaires/fournisseurs, codes ACRISS, statuts personnalisés 1–4, alarmes | Vides | — |

### 5.4 Tarifs

| Écran RentHub | Situation actuelle de LOCAZ | Décision |
|---|---|---|
| Listes des tarifs | Journalier semaine, journalier week-end, horaire semaine, horaire week-end | **P1** journalier semaine/week-end · **P2** horaire |
| Tarifs de location par catégorie | Prix de 1 à 6 jours, km inclus, km supplémentaire | **P1** |
| Paquets | Semaine (7 jours, 700 km), Mois (29–31 jours, 3 000 km) | **P1** |
| Tarifs des services | Prix journalier ou fixe par catégorie | **P1** |
| Tarifs de déplacement (aller simple) | 59 € entre lieux | **P1** |
| Tarifs dynamiques (saisons, demande) | Non configurés (« je le ferai moi-même ») | **P2** — règles simples gérées par l'administrateur |
| Tarification dynamique avancée (tarif de nuit, remise web…) | Non configurée | **P3** |
| Coupons | Aucun | **P2** |
| Tarifs dégâts | Non configurés | — (barème des CGV dans les litiges) |

### 5.5 Autres modules RentHub

| Module | Décision |
|---|---|
| Données clients (contacts) | **P1** — liste des clients avec documents, réservations, liste noire |
| Factures | **P1** — facture/reçu PDF simple par location. Comptabilité complète (livre de caisse, archive fiscale, factures d'achat) — pas nécessaire |
| Paiements / échéances | **P1** — géré par Contrazy + Stripe |
| Leads (CRM), campagnes marketing, modèles de messages | **P3** |
| Groupes d'upselling | **P3** |
| Crédits IA / analyse de documents | — |
| Car-sharing, check-in en ligne, signature au guichet (non activés dans RentHub) | Couverts par notre parcours de réservation + Contrazy |

---

## 6. Parcours de réservation client

Le client ne crée jamais de compte avant d'avoir choisi un véhicule et vu le prix. Le site reste libre à consulter et on évite les comptes vides (« comme un site e-commerce »).

### 6.0 La page de réservation RentHub actuelle (revue le 27 sept. 2026)

Pour référence, le moteur de réservation RentHub actuel fonctionne ainsi :

1. **Formulaire de recherche** : lieu de prise en charge, lieu de restitution, type, catégorie, nombre minimum de places, dates et heures (créneaux de 30 minutes).
2. **Résultats** : une carte par modèle avec carburant, places, boîte de vitesses, portes et climatisation, la liste de prix utilisée, le prix total, les km inclus et le prix du km supplémentaire. Les paquets apparaissent sur une carte « tarif fixe » séparée, à côté du prix journalier.
3. **Paiement sur une seule page** : options (conducteur supplémentaire, siège bébé, livraison, protection), coordonnées (nom, e-mail, mobile, adresse), carte bancaire (Stripe), accord marketing, cases CGV et confidentialité, code coupon, récapitulatif. Deux boutons : « Confirmer et payer en ligne » ou « Demander un devis ».

Ce que nous gardons : la recherche par dates en premier, les cartes de résultats claires et le prix des options mis à jour en direct.

Ce que nous changeons :
- Le client a un vrai compte et une identité vérifiée, ce que RentHub ne fait pas.
- La caution et les conditions d'annulation sont affichées avant le paiement. Aujourd'hui, la page de paiement ne mentionne jamais la caution de 1 500 €.
- Le meilleur prix (paquet ou journalier) est choisi automatiquement : jamais deux prix pour la même voiture.
- Le contrat est signé avant la prise en charge.

### 6.1 Étapes

| # | Étape | Ce qui se passe | Réalisé dans |
|---|---|---|---|
| 1 | **Recherche** | Lieu de prise en charge, lieu de restitution (par défaut : le même), date et heure de départ, date et heure de retour. Visible dès la landing page (bloc fixe pendant le défilement). | LOCAZ |
| 2 | **Résultats** | Catégories disponibles avec photo, « Modèle ou équivalent », places, boîte, carburant, volume (utilitaires), km inclus, **prix total** et prix par jour. Triées par prix. Véhicules indisponibles grisés. | LOCAZ |
| 3 | **Options** | Niveau de protection (Standard inclus, Confort, Zéro franchise), conducteur supplémentaire, siège bébé, diable, livraison aéroport/gare. Prix mis à jour en direct. | LOCAZ |
| 4 | **Récapitulatif** | Détail complet : location, options, frais d'aller simple, km inclus, prix du km supplémentaire, montant de la caution, conditions d'annulation. Acceptation des CGV. | LOCAZ |
| 5 | **Création du compte** | E-mail + téléphone (vérifiés par code), ou Google. Nom, date de naissance. Contrôle de l'âge minimum. | LOCAZ |
| 6 | **Vérification et contrat** | Permis de conduire (recto/verso), carte d'identité ou passeport, selfie, justificatif de domicile si demandé. Contrat généré avec les détails de la réservation et signé sur le téléphone. | **Contrazy** |
| 7 | **Paiement** | Location payée en totalité par carte (3-D Secure). Caution autorisée sur une carte au nom du locataire. | **Contrazy** (Stripe) |
| 8 | **Confirmation** | Réservation confirmée par e-mail (puis WhatsApp/SMS), avec lieu, heure et instructions. | LOCAZ |
| 9 | **Prise en charge** | Le client se rend au véhicule, fait l'état des lieux de départ (photos, carburant, km), puis le déverrouille (boîte à clé / application, phase 3). | État des lieux **Contrazy** (+ boîtiers) |
| 10 | **Restitution** | État des lieux de retour (photos, carburant, km). Km supplémentaires, carburant et pénalités sont calculés. Caution libérée ou prélevée en partie. | État des lieux **Contrazy** |

Si la vérification ou le paiement échoue, le véhicule reste bloqué pendant un temps limité (par exemple 30 minutes, réglable) puis il est libéré.

### 6.2 Règles de réservation (d'après les CGV LOCAZ v3.0)

| Règle | Valeur | Réglable |
|---|---|---|
| Âge minimum | 21 ans | Oui |
| Permis détenu depuis au moins | 1 an selon les CGV (**la FAQ du site indique 2 ans — à confirmer**) | Oui |
| Durée maximale de location | 30 jours consécutifs | Oui |
| Réservation jusqu'à | 6 mois à l'avance | Oui |
| Délai minimum avant la prise en charge | 60 minutes (paramètre RentHub) | Oui, par lieu/catégorie |
| Réservations simultanées par client | 1 | Oui |
| Prix minimum de réservation | 35 € TTC (paramètre RentHub) | Oui |
| Remboursement en cas d'annulation | > 24 h avant : 100 % · < 24 h : 50 % · < 1 h : 0 % · annulation par LOCAZ : 100 % · fraude/documents non conformes : 0 % | Oui |
| Prolongation | Demandée dans l'application avant la fin ; acceptée seulement si le véhicule est libre ; payée immédiatement | Oui |

### 6.3 Espace client

- Réservations à venir, en cours et passées ; téléchargement du contrat et de la facture.
- Demander une prolongation, annuler (avec la règle de remboursement affichée), ajouter un conducteur.
- Documents enregistrés (réutilisés pour la location suivante tant qu'ils sont valides).
- Langue : français et anglais au lancement (italien comme sur la landing page — **P2**).

---

## 7. Exigences fonctionnelles — plateforme LOCAZ

### 7.1 Moteur de prix

Les tarifs sont fixés **par catégorie, pas par modèle** : un Renault Master et un Iveco Daily dans « Grand fourgon » coûtent le même prix. C'est ce qui a été convenu en réunion, et c'est la configuration actuelle de RentHub.

**Choix de la liste de prix**
- Listes journalières *semaine* et *week-end* ; la liste week-end s'applique quand la location tombe un week-end.
- Des listes *horaires* (semaine / week-end) existent dans RentHub mais **ne sont pas proposées aux clients**. La location à l'heure est une option **P2** (le blog mentionne la « location à l'heure »).
- Tolérance : une location de 24 h + jusqu'à 1 h compte pour 1 jour (paramètre RentHub). Tolérance horaire : 29 minutes.

**Prix selon la durée**
- Un prix total est fixé pour 1, 2, 3, 4, 5 et 6 jours (chaque durée peut avoir son propre total, par ex. Moyen fourgon : 1 jour 70 €, 2 jours 139,20 €, 3 jours 205,20 €…).
- Paliers longs optionnels (par ex. Petite voiture : à partir de 7 jours 31,92 €/jour, à partir de 30 jours 30 €/jour).
- Au-delà du dernier palier, le prix est **le tarif journalier du dernier palier × le nombre de jours**. C'est le calcul actuel de RentHub, par ex. Grande voiture 10 jours = 10 × 45 € = 450 €.
- Les **paquets** remplacent le prix journalier quand la durée correspond : *Semaine* = exactement 7 jours, 700 km inclus ; *Mois* = 29 à 31 jours, 3 000 km inclus. Le client obtient toujours **le prix valide le moins cher**, affiché comme un seul prix.
  - Aujourd'hui, RentHub affiche le paquet semaine et le prix journalier côte à côte. Pour le camion, le paquet (672 €) est plus cher que 7 prix journaliers (595 €).
  - Les paquets mensuels ne sont jamais proposés aux clients : un Grand fourgon sur 30 jours s'affiche à 2 016 € au lieu du paquet à 1 550 €.
- Chaque prix a une période de validité (du / au), pour préparer les prix saisonniers à l'avance.

**Kilométrage**
- Km inclus par jour (100 km aujourd'hui ; 10 km par heure en location horaire), par paquet, ou **illimités** (utilisé aujourd'hui pour la Petite voiture le week-end).
- Prix du km supplémentaire (0,35 € TTC aujourd'hui ; 0,39 € pour le camion le week-end). Facturé au retour d'après le kilométrage relevé (relevé manuel au lancement, traceur en phase 3).

**Options et frais**
- Options facturées **par jour** (conducteur supplémentaire 9,90 €/jour, siège bébé 4 €/jour, protection) ou **au forfait par location** (livraison aéroport/gare 60 €). Une option peut avoir un nombre maximum de jours facturables.
- Niveaux de protection (par jour) : *Standard* inclus (responsabilité plafonnée à 3 000 € par sinistre), *Confort* 19 €/jour (500 € pour le premier sinistre), *Zéro franchise* 34 €/jour (0 € pour le premier sinistre). Vol, incendie et bris de glace exclus, comme dans les CGV.
- Frais d'aller simple quand le lieu de restitution diffère du lieu de départ (59 € entre Gare / Aéroport / Ville aujourd'hui, dans les deux sens).
- Frais de lieu pour une prise en charge/restitution à un lieu précis (0 € actuellement).

**Tarifs dynamiques (P2)**
Règles simples gérées par l'administrateur : +/- % ou montant fixe par période (par ex. Festival de Cannes, Grand Prix de Monaco, été), par catégorie, par lieu, par jour de la semaine ou selon l'anticipation de la réservation. Un « aperçu » montre le prix obtenu avant d'enregistrer.

**Coupons (P2)**
Code, % ou montant fixe, dates de validité, nombre d'utilisations maximum.

**TVA**
Les prix sont saisis et affichés TTC (20 %). Les options d'assurance ont leur propre taux (0 % dans RentHub aujourd'hui — à confirmer avec l'expert-comptable).

> **Exemple chiffré (tarifs actuels)** — Moyen fourgon, départ lundi 9h00 à Nice Ville, retour mercredi 9h00 à Nice Aéroport, avec protection Confort :
> location 2 jours 139,20 € + protection 2 × 19 € = 38 € + frais d'aller simple 59 € = **236,20 €** TTC. 200 km inclus, puis 0,35 €/km. Caution : 1 500 € (autorisation).

### 7.2 Disponibilité

- Un véhicule est disponible s'il n'a aucune réservation, entretien ou blocage d'indisponibilité sur la période demandée, **plus une marge** entre deux locations (temps de nettoyage/contrôle, réglable, par ex. 60 min).
- La disponibilité est vérifiée **par catégorie** : le client réserve une catégorie, et un véhicule précis est attribué automatiquement (ou par l'opérateur). L'opérateur peut changer de véhicule plus tard sans changer le prix.
- Les véhicules peuvent être limités à certains lieux ou à un groupe de lieux, et être restitués dans un autre lieu (aller simple).
- Protection contre la surréservation : le dernier véhicule d'une catégorie est bloqué pendant le paiement.

### 7.3 Gestion de la flotte

| Objet | Principaux champs |
|---|---|
| **Groupe de lieux** (ville) | Nom, couleur |
| **Lieu** | Nom, type (aéroport / gare / ville / port / autre), adresse, point GPS, groupe, téléphone, e-mail, disponible en ligne (oui/non), frais de prise en charge/restitution, taux de TVA, rayon de sécurité (contrôle GPS au retour), instructions/photos pour trouver le véhicule |
| **Marque** | Nom, logo |
| **Type** | Voiture / Utilitaire / Camion ; état des lieux obligatoire (oui) |
| **Catégorie** | Nom (FR/EN), type, ordre d'affichage, description, photo |
| **Modèle** | Nom (« Renault Master ou équivalent »), marque, catégorie, carburant, boîte de vitesses, places, portes, climatisation, litres du réservoir, volume utile m³ / charge utile (utilitaires), attelage, photos, masqué en ligne (oui/non), **montant de la caution**, **franchises** (dégâts, vol/incendie, responsabilité civile) |
| **Véhicule** | Immatriculation, numéro de châssis, modèle, couleur, kilométrage actuel, statut (actif / inactif / entretien), date d'entrée / de sortie, disponible en ligne, lieux autorisés, identifiant du traceur GPS, identifiant de la boîte à clé, blocage moteur à distance (oui/non), documents (carte grise, assurance), échéances (contrôle technique, révision, assurance) **P2**, dépenses **P2** |

Données actuelles : 7 catégories, 8 modèles, 5 véhicules, 4 lieux. Elles sont importées depuis l'export RentHub (section 12).

### 7.4 Planning de la flotte et réservations (administration)

Le planning est l'écran principal de l'administration (« la ligne la plus importante pour moi »).

- **Vue planning** : une ligne par véhicule, regroupée par catégorie ; les jours (ou heures) en colonnes ; les réservations en barres colorées selon le statut ; les entretiens/indisponibilités affichés différemment. Navigation par jour, semaine et mois ; filtres par type, catégorie, lieu, carburant, boîte, statut.
- Compteurs par jour : véhicules disponibles / réservés / bloqués.
- **Glisser-déposer** pour déplacer une réservation vers un autre véhicule de la même catégorie.
- **Créer une réservation depuis le planning** (client au téléphone ou sur place) : même moteur de prix, avec remise/forçage manuel (motif obligatoire), envoi au client d'un lien pour terminer la vérification, le contrat et le paiement sur son téléphone (le lien Contrazy).
- **Fiche réservation** (onglets, simplifiés à partir des 13 onglets de RentHub) :
  - Statut et détail du prix
  - Client et conducteurs
  - Options
  - Documents et vérification
  - Contrat et signature
  - Paiements et caution
  - États des lieux de départ / retour (photos, km, carburant, dégâts)
  - Frais supplémentaires
  - Litige
  - Historique (journal d'audit)
- **Statuts** : *En attente de paiement* → *Confirmée* → *En cours* (véhicule pris) → *Restituée* (état des lieux de retour fait) → *Clôturée* (frais finaux réglés, caution libérée). Aussi *Annulée* (motif obligatoire) et *Non présenté*.
- **Blocages d'indisponibilité** : motif (entretien, réparation, nettoyage, usage interne…), dates, véhicule.
- **Mouvements internes** (P2) : déplacer un véhicule entre deux lieux sans client.
- Recherche par immatriculation, nom du client, numéro de réservation.

### 7.5 Clients

- Liste des clients avec recherche : nom, e-mail, téléphone, nombre de locations, montant total dépensé, statut de vérification, marqueur liste noire.
- Fiche client : identité et permis (depuis Contrazy), conducteurs, réservations, paiements, litiges, notes internes.
- **Liste noire** avec motifs colorés (aujourd'hui : Fumeur 🔴, Saleté, Carburant non refait). Un client sur liste noire ne peut pas réserver en ligne ; l'administrateur voit un avertissement lors d'une réservation par téléphone.
- Clients entreprises (P2) : raison sociale, SIRET, numéro de TVA, facture au nom de l'entreprise.
- RGPD : export et suppression des données d'un client sur demande, avec les durées de conservation de la politique de confidentialité LOCAZ (pièces d'identité 12 mois après la dernière vérification, GPS/télémétrie 60 jours après la location, photos d'état des lieux 6 mois, factures 10 ans).

### 7.6 Opérations : prise en charge, restitution et frais supplémentaires

La prise en charge et la restitution utilisent l'**état des lieux Contrazy** (check-in / check-out). Il gère déjà photos, nombres, choix et fichiers à chaque étape.

- **État des lieux de départ (obligatoire avant le déverrouillage)** : 10 photos minimum (paramètre RentHub) selon une séquence guidée (4 côtés, 4 angles, tableau de bord avec km et carburant, intérieur), relevé du kilométrage, niveau de carburant, dégâts existants marqués sur un schéma du véhicule (Rayure = X, Bosse = O).
- **État des lieux de retour (obligatoire)** : mêmes photos, km, carburant, clés remises dans la boîte à gants, lieu de restitution confirmé.
- **Calcul automatique au retour** (l'opérateur valide avant de facturer) :
  - Km supplémentaires : (km parcourus − km inclus) × prix du km supplémentaire.
  - Carburant : si le niveau est inférieur au départ, forfait + prix au litre (**CGV : 20 € + 2,20 €/L ; RentHub : 36 € + 2,40 €/L — à harmoniser**).
  - Retard de restitution : tolérance de 29 min, puis **une journée de location supplémentaire** (CGV) — le paramètre RentHub est différent (voir décisions).
  - Restitution hors zone : 150 € + frais de rapatriement.
  - Nettoyage : léger / moyen / excessif = 35 € / 50 € / 130 € ; nettoyage extrême 250 €.
- Les frais sont **prélevés d'abord sur la caution**, puis sur la carte du client pour le solde (paramètre RentHub : « prélever les frais sur la caution et le solde sur la carte du client »), avec un reçu détaillé envoyé au client.
- Les dégâts et amendes suivent le processus de litige (7.8).

### 7.7 Paiements et caution

Tous les flux d'argent passent par **le compte Stripe de LOCAZ**, connecté à Contrazy (Stripe Connect). LOCAZ est payé directement par Stripe.

- **Paiement de la location** : débité en totalité à la réservation (carte, Apple Pay / Google Pay), 3-D Secure obligatoire (paramètre RentHub).
- **Caution** : 1 500 € par modèle aujourd'hui (réglable par modèle et par option de protection). C'est une autorisation — l'argent est bloqué, pas débité — sur une carte au nom du locataire.
- **Remboursements** : selon les conditions d'annulation, automatiquement.
- **Prolongations et frais supplémentaires** : payés par carte ; la facture est mise à jour.

> **Important — durée de la caution.** Stripe ne peut maintenir une autorisation bancaire que **7 jours**. Les locations de plus de 7 jours (jusqu'à 30 jours) nécessitent une autre méthode. Contrazy le gère déjà : pour les locations longues, il **débite la caution et la rembourse automatiquement** après la location, pour un petit coût (frais Stripe ~1,5 % + 0,25 € + 0,5 % de marge plateforme). **Décision attendue** : accepter cette méthode au-delà de 7 jours, ou renouveler l'autorisation tous les 7 jours (possible, mais peut échouer si la carte n'est pas approvisionnée). Les CGV (article 7) mentionnent une pré-autorisation de 30 jours et le prestataire « Swikly » ; elles devront être légèrement mises à jour.

### 7.8 Dégâts, amendes et litiges

Utilise le **module litiges de Contrazy** (déjà développé : dossier de litige, statuts Ouvert / En cours d'examen / Résolu / Perdu, dossier de preuves en ZIP avec contrat, photos et journaux).

- L'opérateur ouvre un litige depuis une réservation : dégât, amende (PV), fourrière, accident, non-restitution, autre.
- Les montants sont proposés d'après le **barème des dommages et pénalités LOCAZ** (annexes 1 et 2 des CGV), enregistré comme liste modifiable dans l'administration. Exemples : rayure 2–5 cm 250 €, réparation pare-chocs 450 €, clé perdue 600 €, dommage non déclaré 90 €, désactivation du GPS 1 000 €, traitement d'une contravention 25 €, fourrière frais réels + 90 €, frais de gestion du litige 72 € HT (paramètre RentHub).
- L'option de protection choisie plafonne automatiquement la responsabilité du client (Standard 3 000 € / Confort 500 € au premier sinistre / Zéro 0 € au premier sinistre).
- Le client est informé avec les preuves (photos de départ et de retour) et peut répondre. Le paiement est prélevé sur la caution ou demandé par carte.
- Amendes (ANTAI) : enregistrer l'amende et désigner le conducteur d'après les données de la réservation.

### 7.9 Utilisateurs, rôles et sécurité

- Invitation des collaborateurs par e-mail ; rôles selon la section 4 ; désactivation à tout moment.
- Double authentification pour le Super administrateur et les Administrateurs.
- Journal d'audit complet (qui a modifié quel prix, quelle réservation ou quel paramètre, et quand).

### 7.10 Paramètres de l'entreprise

Une seule page de paramètres, organisée par thème, qui remplace la trentaine de panneaux de configuration de RentHub. Les valeurs de départ viennent de RentHub et des CGV :

| Thème | Paramètres (valeur actuelle) |
|---|---|
| Entreprise | Raison sociale LOCAZ SAS, SIREN 994 107 696, TVA FR94994107696, APE 7711A, adresse 22 avenue Robert Schuman 06000 Nice, e-mail, téléphone, logo, site web |
| Règles de réservation | Âge minimum (21), ancienneté du permis (1 an), durée max. (30 jours), réservation à l'avance (6 mois), délai minimum (60 min), prix minimum (35 €), marge entre locations |
| Restitution | Tolérance de retard (29 min), pénalité de retard (1 jour), forfait carburant et €/L, restitution hors zone (150 €), photos obligatoires au départ/retour (10), carburant et km obligatoires (oui) |
| Caution | Montant par défaut, libération automatique après le retour (oui), délai de libération |
| Paiements | 3-D Secure obligatoire (oui), moyens acceptés, taux de TVA |
| Annulation | Paliers de remboursement (24 h / 1 h), motif obligatoire (oui) |
| Documents | Pièce d'identité exigée (oui), permis exigé (oui), justificatif de domicile (si demandé), vérification par selfie (oui) |
| Juridique | Version des CGV, modèle de contrat de location (géré dans Contrazy), lien vers la politique de confidentialité |
| Notifications | E-mail d'expédition, e-mails d'alerte administrateur, WhatsApp (P3) |

### 7.11 Notifications

E-mail au lancement (le prestataire Resend est déjà utilisé par Contrazy) ; SMS/WhatsApp en P3.

| Quand | À qui | Contenu |
|---|---|---|
| Réservation créée, paiement en attente | Client | Lien pour terminer la vérification et le paiement |
| Réservation confirmée | Client + administrateur | Détails, lieu, heure, comment trouver le véhicule |
| 24 h et 1 h avant la prise en charge | Client | Rappel, instructions pour l'état des lieux |
| 1 h avant la fin | Client | Rappel de restitution, comment prolonger |
| Retard de restitution | Client + administrateur | Avertissement, puis avis de pénalité |
| Retour traité | Client | Reçu final, frais supplémentaires, libération de la caution |
| Nouveau litige / amende | Client | Preuves et montant |
| Échéances véhicules (P2) | Administrateur | Contrôle technique, révision, assurance à venir |

### 7.12 Rapports (P2)

Tableau de bord avec l'essentiel : réservations et chiffre d'affaires par jour/mois, taux d'occupation par catégorie et par véhicule, durée et prix moyens de location, options les plus vendues, annulations, litiges ouverts.

---

## 8. Intégration Contrazy

LOCAZ devient un vendeur Contrazy (un compte professionnel). Chaque réservation confirmée crée une **transaction Contrazy** avec le montant de la location, la caution, les documents demandés, le contrat et les étapes d'état des lieux. Le client effectue ces étapes dans un parcours aux couleurs de LOCAZ (logo et nom LOCAZ), puis revient sur le site LOCAZ.

### 8.1 Ce que Contrazy fournit déjà

| Besoin | Contrazy aujourd'hui |
|---|---|
| Envoi de la carte d'identité, du passeport, du justificatif de domicile et du permis | Oui — documents exigés (identité, justificatif de domicile, permis, personnalisés) |
| Vérification d'identité avec selfie | Oui — Stripe Identity (optionnel par transaction) |
| Contrat avec les données du client, signature électronique, PDF signé | Oui — modèles de contrat avec champs de fusion, pavé de signature, PDF signé |
| Paiement de la location + caution dans un seul parcours | Oui — transactions « hybrides » (paiement + caution) sur le compte Stripe du vendeur |
| Prélèvement (total/partiel) ou libération de la caution | Oui |
| Cautions longues (8 à 30 jours) | Oui — débit et remboursement automatique, frais affichés (offre Contrazy Pro ou Business) |
| États des lieux de départ/retour avec photos, km, carburant | Oui — rapports check-in / check-out (champs texte, nombre, choix, photo, fichier) |
| Litiges avec dossier de preuves | Oui |
| Traçabilité et e-mails | Oui |
| Français / anglais | Oui |

### 8.2 Ce que nous ajoutons à Contrazy (petites extensions)

| Extension | Pourquoi |
|---|---|
| **API partenaire** avec clés API sécurisées | Pour que la plateforme LOCAZ crée et lise les transactions automatiquement (aujourd'hui, elles sont créées depuis le tableau de bord Contrazy) |
| **Webhooks vers LOCAZ** | Prévenir LOCAZ quand les documents sont validés, le contrat signé, le paiement/la caution réussis, l'état des lieux envoyé ou un litige modifié |
| **Lien de retour** | Renvoyer le client vers `booking.locaz.co` après chaque étape |
| **Champs location dans le contrat** | Véhicule, immatriculation, catégorie, lieux et dates/heures de départ et de retour, km inclus, prix du km supplémentaire, options, niveau de protection, carburant et km au départ |
| **Date/heure de début et de fin sur les transactions** | Aujourd'hui une transaction n'a qu'une date de prestation |
| **Frais supplémentaires après le retour** | Facturer km supplémentaires, carburant, retard sur la caution ou la carte, avec un reçu détaillé |
| **Réutilisation des documents vérifiés** | Un client fidèle ne renvoie pas le même permis tant qu'il est valide |

Ces extensions sont génériques : elles rendent aussi Contrazy vendable à d'autres loueurs.

---

## 9. Boîtiers des véhicules (phase 3)

L'objectif est la location 100 % sans clé. Deux boîtiers sont prévus (choix final par LOCAZ après les rendez-vous fournisseurs) :

| Boîtier | Rôle | Candidats évoqués |
|---|---|---|
| **Boîte à clé** (sur batterie, Bluetooth, placée dans la voiture avec la clé) | Verrouiller / déverrouiller depuis l'application, sans câblage | Fournisseur transmis par LOCAZ par e-mail (documentation API et accès de test reçus) |
| **Traceur à brancher** (prise OBD, prêt à l'emploi) | Position GPS, kilométrage, niveau de carburant | Teltonika (par ex. FMB003 OBD), Invers |

**Ce que nous préparons dès la phase 1** (pour ne rien refaire ensuite) :
- Chaque véhicule enregistre l'**identifiant de sa boîte à clé** et de **son traceur**.
- Une couche « boîtiers » dans l'API LOCAZ, avec un jeu d'actions standard — *déverrouiller*, *verrouiller*, *position*, *kilométrage*, *carburant* — et un connecteur par fournisseur, pour pouvoir changer de fournisseur plus tard.
- Règles d'accès : le déverrouillage ne fonctionne que pour le locataire, entre l'heure de départ et l'heure de retour, et seulement après l'état des lieux de départ et l'autorisation de la caution.

**Ce que les boîtiers apportent en phase 3**
- Déverrouillage/verrouillage depuis la page de réservation (web), puis depuis l'application mobile.
- Km et carburant automatiques au départ et au retour (plus de relevé manuel ; le manuel reste en secours).
- Carte de la flotte en direct dans l'administration ; alerte quand un véhicule sort de la zone autorisée ou n'est pas rendu 2 h après la fin (article 12 des CGV).
- Contrôle du lieu de restitution avec le rayon de sécurité du lieu.
- Blocage moteur à distance (RentHub l'indique actif sur 4 véhicules) — seulement si le boîtier choisi le permet et si c'est légalement autorisé.

---

## 10. Application mobile et API publique (phase 4)

- Tout ce que fait le site passe par une **API documentée** (OpenAPI/Swagger), pour qu'un développeur mobile construise l'application iOS/Android sans modifier le back-end.
- Le site de réservation est **pensé mobile d'abord** dès le départ et installable sur le téléphone (PWA) : LOCAZ est utilisable sur mobile avant même l'application native.
- L'application native ajoute : déverrouillage Bluetooth (si la boîte à clé l'exige), notifications push, prise de photos guidée et navigation « trouver ma voiture ».

---

## 11. Exigences non fonctionnelles

| Sujet | Exigence |
|---|---|
| Mobile d'abord | Conçu d'abord pour le téléphone ; chaque étape utilisable d'une main ; rapide en 4G |
| Performance | Résultats de recherche en moins de 2 secondes ; prix mis à jour instantanément quand les options changent |
| Disponibilité | Service 24h/24 ; hébergé sur Vercel avec une base PostgreSQL gérée dans l'UE ; sauvegardes quotidiennes |
| Sécurité | HTTPS partout ; les données de carte ne passent jamais par les serveurs LOCAZ (Stripe) ; documents stockés chiffrés ; double authentification pour les administrateurs ; accès par rôle ; limitation des tentatives de connexion et de réservation |
| RGPD | Consentement et politique de confidentialité ; durées de conservation de la politique LOCAZ ; export/suppression des données sur demande ; hébergement dans l'UE autant que possible |
| Langues | Français (par défaut) et anglais ; italien en P2 |
| SEO | La landing page reste statique et optimisée ; les pages de réservation ont des URL propres et des métadonnées par lieu/catégorie (par ex. « Location utilitaire Nice Aéroport ») |
| Évolutivité | Prêt pour plusieurs villes (groupes de lieux) ; pas de limite du nombre de véhicules |
| Traçabilité | Journal d'audit des réservations, tarifs, paramètres et paiements |

### Technologie

Même technologie éprouvée que Contrazy, pour partager le code et les compétences : Next.js (web + API), PostgreSQL avec Prisma, Stripe, Cloudinary (photos/documents), Resend (e-mails), hébergement sur Vercel.

La plateforme LOCAZ est dans le même dépôt de code que Contrazy, comme application séparée déployée sur son propre domaine (`booking.locaz.co`). La landing page existante reste sur `locaz.co`.

---

## 12. Reprise des données RentHub

Le compte RentHub a été revu et exporté le **27 septembre 2026**, avant la fin de l'accès. L'export (fichiers CSV, captures d'écran et données brutes) se trouve dans le dossier `LOCAZ-RentHub-Export-2026-09-27` :

- Flotte : 7 catégories, 3 types, 7 marques, 8 modèles, 5 véhicules (immatriculations, km, franchises), 4 lieux.
- Tarifs : 4 listes de prix, tous les tarifs par catégorie et par durée, 2 paquets, tarifs des services, frais d'aller simple.
- Règles : paramètres de l'entreprise, motifs de liste noire, types de documents et de permis, marqueurs de dégâts, types de dépenses.

Ces données sont importées dans la nouvelle plateforme pendant la phase 1.

Les fiches clients, réservations et factures n'ont **pas** été exportées, car elles contiennent des données personnelles. Elles peuvent être exportées à la demande de LOCAZ tant que l'accès à RentHub fonctionne.

**Anomalies relevées (à corriger lors de l'import)**
- Les tarifs des services et assurances n'existent que pour les **Petites** et **Moyennes voitures**. Les utilitaires et le camion n'ont aucun tarif d'option.
- Le **paquet semaine du Petit fourgon** a expiré le 11/07/2026.
- La **Moyenne voiture** a des tarifs mais aucun modèle ni véhicule.
- Le tarif **week-end de la Petite voiture** est de 80 €/jour en km illimités (semaine : 39,90 € avec 100 km/jour). C'est le double du tarif semaine ; à confirmer.
- **Les paquets mensuels ne sont jamais appliqués** sur la page de réservation. Une location de 30 jours s'affiche à 1 800 € (Petit fourgon), 2 016 € (Grand fourgon) ou 2 550 € (camion) au lieu des paquets à 1 000 € / 1 550 € / 1 600 €.
- Le **paquet semaine du camion** (672 €) est plus cher que 7 prix journaliers (595 €).
- Le site annonce « dès 29 €/jour », alors que le prix journalier le plus bas dans RentHub est 39,90 € et que la réservation minimum est de 35 €.

---

## 13. Planning de réalisation (proposition)

| Phase | Contenu | Échéance |
|---|---|---|
| **0 — Validation** | Relecture du PRD et décisions (section 14) ; compte Stripe LOCAZ ; choix des fournisseurs de boîtiers | Début octobre 2026 |
| **1 — Socle administration** | Paramètres de l'entreprise, utilisateurs et rôles, lieux, catégories, modèles, véhicules, moteur de prix (journalier, week-end, paquets, km, options, aller simple), planning de la flotte, réservations manuelles, clients et liste noire, import des données RentHub | Octobre – novembre 2026 |
| **2 — Réservation et Contrazy** | Site de réservation public (recherche → options → compte → vérification/contrat/paiement Contrazy → confirmation), espace client, API partenaire et webhooks Contrazy, états des lieux, frais supplémentaires, gestion de la caution, litiges, e-mails, factures | Novembre – décembre 2026 |
| **3 — Boîtiers** | Ouverture/fermeture par boîte à clé, traceur (GPS, km, carburant), carte de la flotte, alertes de zone et de retard | Décembre 2026 – janvier 2027 |
| **Lancement pilote** | Nice, flotte actuelle, vrais clients | **Janvier 2027** |
| **4 — Croissance** | Documentation de l'API publique pour l'application mobile, tarifs dynamiques, coupons, location à l'heure, rapports, WhatsApp/SMS, échéances et dépenses véhicules, deuxième ville | À partir du T1 2027 |

Chaque phase se termine par une démonstration et la validation de LOCAZ avant la suivante. Les dates de la phase 3 dépendent de la livraison des boîtiers et de l'accès aux API des fournisseurs.

---

## 14. Décisions attendues de LOCAZ

| # | Question | Notre suggestion |
|---|---|---|
| 1 | Ancienneté minimale du permis : **1 an** (CGV) ou **2 ans** (FAQ du site) ? | Harmoniser les deux documents |
| 2 | Retard de restitution : **1 jour supplémentaire après 30 min** (CGV), ou la règle RentHub (tolérance de 29 min puis heures supplémentaires/forfait) ? | Garder la règle des CGV, simple et claire |
| 3 | Remise à niveau du carburant : **20 € + 2,20 €/L** (CGV) ou **36 € + 2,40 €/L** (RentHub) ? | Une seule valeur dans les paramètres, identique aux CGV |
| 4 | Caution pour les locations de plus de 7 jours : **débit et remboursement** (petits frais) ou **nouvelle autorisation tous les 7 jours** ? | Débit et remboursement (déjà développé, plus fiable) |
| 5 | Noms des protections : « Basique / Intermédiaire / Premium » (site), « Essentielle / Confort / Sérénité » (CGV) ou « Standard / Comfort / 0 Franchise » (RentHub) ? | Un seul jeu de noms partout |
| 6 | Tarifs des options et assurances pour les **utilitaires et le camion** (aucun aujourd'hui) ? | Fournir les tarifs avant l'import |
| 7 | La **location à l'heure** doit-elle être proposée en ligne dès le lancement ? | P2, après le lancement |
| 8 | **Livraison par un collaborateur** à l'aéroport/à la gare dès le lancement (nécessite des horaires) ? | Garder, avec un forfait et des horaires |
| 9 | Vérification d'identité par selfie pour **chaque** client, ou seulement au-delà d'un seuil de risque ? | Chaque client au lancement |
| 10 | Fournisseurs de boîtiers : choix final de la boîte à clé et du traceur, et boîtiers de test | Après les rendez-vous fournisseurs de LOCAZ |
| 11 | Domaine : `booking.locaz.co` (convenu en réunion) ou `app.locaz.co` ? | `booking.locaz.co` |
| 12 | Locations mensuelles pour les **voitures** : ajouter un paquet mois (les utilitaires et le camion en ont un ; les voitures utilisent le prix 30 jours) ? | En ajouter un, par cohérence |
| 13 | Le paquet semaine du camion (672 €) est plus cher que 7 prix journaliers (595 €). Lequel est correct ? | Corriger avant l'import |
| 14 | Garder « Demander un devis » (sans paiement) comme option pour les clients professionnels ? | Oui, en option P2 |

---

## 15. Prochaines étapes

1. **LOCAZ** relit ce document, répond aux décisions de la section 14 et ajoute tout besoin manquant.
2. **Réunion de revue** pour passer en revue les réponses et figer le périmètre de la phase 1.
3. **LOCAZ** crée ou confirme son compte Stripe et transmet l'accès à l'API du fournisseur de boîtiers.
4. **Démarrage du développement** avec la phase 1 (socle administration) et l'import des données RentHub.

---

## Annexe A — Configuration actuelle de LOCAZ (depuis RentHub, 27 sept. 2026)

### A.1 Tarifs journaliers — semaine (TTC, 100 km/jour inclus, km supplémentaire 0,35 €)

| Catégorie | 1 jour | 2 jours | 3 jours | 4 jours | 5 jours | 6 jours | Paquet semaine (700 km) | Paquet mois (3 000 km) |
|---|---|---|---|---|---|---|---|---|
| Petite voiture (Twingo / Aygo) | 39,90 | 78,50 | 115,50 | — | — | — | 223,44 | — (7 j et + : 31,92/j ; 30 j et + : 30,00/j) |
| Moyenne voiture | 44,90 | 88,50 | 129,90 | 169,90 | — | — | 290,00 | — |
| Grande voiture (Fiat 500X) | 49,90 | 95,00 | 140,00 | 180,00 | — | — | 290,00 | — |
| Petit fourgon (Citan) | 65,00 | 127,20 | 187,20 | 244,80 | 300,00 | 360,00 | 350,00 (expiré) | 1 000,00 |
| Moyen fourgon (Trafic) | 70,00 | 139,20 | 205,20 | 268,80 | 330,00 | 388,80 | 360,00 | 1 350,00 |
| Grand fourgon (Master / Daily) | 75,00 | 146,00 | 208,80 | 273,60 | 342,00 | 403,20 | 370,00 | 1 550,00 |
| Camion benne (Cabstar) | 102,00 | 198,00 | 285,00 | 364,00 | 440,00 | 510,00 | 672,00 | 1 600,00 |

« — » signifie qu'aucun prix n'est fixé pour cette durée. Le tarif journalier du dernier palier s'applique, par ex. Petite voiture 5 jours = 5 × 38,50 € = 192,50 €, Grande voiture 10 jours = 10 × 45 € = 450 €. Prix vérifiés sur la page de réservation RentHub en ligne le 27 sept. 2026.

### A.2 Tarifs journaliers week-end (TTC)

| Catégorie | 1 jour | 2 jours | Autres |
|---|---|---|---|
| Petite voiture | 80,00 (km illimités) | — | |
| Grande voiture | 65,00 | — | |
| Petit fourgon | 80,00 | 156,00 | |
| Moyen fourgon | 75,00 | 144,00 | 3 à 6 jours : 212,40 / 278,40 / 342,00 / 403,20 |
| Grand fourgon | 85,00 | 160,00 | |
| Camion benne | 120,00 | 230,00 | km supplémentaire 0,39 € |

Des tarifs horaires existent pour la Petite voiture (19,90 €/h) et pour les utilitaires/le camion (30 à 39 € la première heure, 10 km/h inclus). Ils ne sont pas proposés en ligne.

### A.3 Options (Petites et Moyennes voitures ; TTC)

| Option | Prix | Facturation |
|---|---|---|
| Protection Standard | Incluse (obligatoire) | — |
| Protection Confort | 19 € | par jour |
| Protection Zéro franchise | 34 € | par jour |
| Conducteur supplémentaire | 9,90 € | par jour |
| Siège bébé | 4,00 € | par jour |
| Livraison aéroport / gare | 60,00 € | une fois |
| Diable | aucun prix défini | — |

### A.4 Lieux et frais d'aller simple

| Lieu | Type | Adresse |
|---|---|---|
| Nice Gare | Gare | Avenue Thiers, 06000 Nice |
| Nice Aéroport | Aéroport | 19 rue Costes et Bellonte, 06200 Nice |
| Nice Ville | Ville | 11 avenue Auber, 06000 Nice |
| Nice Collinettes | Autre | 22 rue Robert Schuman, 06000 Nice |

Frais d'aller simple : **59 €** pour Gare ↔ Aéroport, Ville ↔ Aéroport, Gare ↔ Ville (dans les deux sens).

### A.5 Flotte

| Modèle | Catégorie | Carburant / boîte | Places | Caution | Franchises (dégâts / vol-incendie / RC) |
|---|---|---|---|---|---|
| Renault Twingo ou équiv. | Petite voiture | — | 4 | 1 500 € | 1 500 € / 2 500 € / 1 500 € |
| Toyota Aygo ou équiv. | Petite voiture | Essence, manuelle | 4 | 1 500 € | identiques |
| Fiat 500X ou équiv. | Grande voiture | Essence, automatique | 5 | 1 500 € | identiques |
| Mercedes Citan ou équiv. | Petit fourgon | Diesel, manuelle | 2 | 1 500 € | identiques |
| Renault Trafic ou équiv. | Moyen fourgon | — | 3 | 1 500 € | identiques |
| Renault Master ou équiv. | Grand fourgon | Diesel, manuelle | 3 | 1 500 € | identiques |
| Iveco Daily ou équiv. | Grand fourgon | Diesel, manuelle | 3 | 1 500 € | identiques |
| Nissan Cabstar ou équiv. | Camion benne | Diesel, manuelle | 3 | 1 500 € | identiques |

5 véhicules sont enregistrés : Iveco Daily, Fiat 500X, Mercedes Citan, Toyota Aygo et Nissan Cabstar. Ils sont disponibles dans les 4 lieux.

### A.6 Listes de référence

- **Motifs de liste noire** : Fumeur, Saleté, Carburant non refait.
- **Documents exigés** : carte d'identité, passeport, justificatif de domicile (de moins de 3 mois) ; types de permis : permis international, autre.
- **Marqueurs de dégâts** : Rayure (X), Bosse (O).
- **Types de dépenses véhicules** : Lavage, Énergie, Révision, Assurance, Pneus.

## Annexe B — Glossaire

| Terme | Signification |
|---|---|
| Catégorie | Groupe de véhicules équivalents au même prix (par ex. Grand fourgon) |
| Modèle | « Renault Master ou équivalent » — ce que voit le client |
| Véhicule | Un véhicule physique avec une immatriculation |
| Lieu / groupe de lieux | Point de prise en charge/restitution / ville |
| Paquet | Prix fixe pour une semaine ou un mois avec un forfait kilométrique |
| Caution (dépôt de garantie) | Montant bloqué sur la carte du client pendant la location |
| Franchise | Montant maximum payé par le client par sinistre, selon la protection choisie |
| Frais d'aller simple | Frais quand le véhicule est rendu dans un autre lieu |
| État des lieux (check-in / check-out) | Inspection de départ / retour avec photos, km et carburant |
| Contrazy | Plateforme de LOCAZ pour l'identité, le contrat, la signature, le paiement, la caution et les litiges |
| PRD | *Product Requirements Document* — cahier des charges produit |
