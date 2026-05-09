/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const messagesDir = path.join(__dirname, '..', 'messages');
const enPath = path.join(messagesDir, 'en.json');
const frPath = path.join(messagesDir, 'fr.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));

// ── marketing.contactPage form fields ─────────────────────────────────────
const contactFormEN = {
  formFirstName: 'First Name',
  formLastName: 'Last Name',
  formEmail: 'Email',
  formMessage: 'Message',
  formFirstNamePlaceholder: 'Enter your first name',
  formLastNamePlaceholder: 'Enter your last name',
  formEmailPlaceholder: 'Enter your email address',
  formMessagePlaceholder: 'Describe your workflow, industry, or launch timeline.',
  formSubmit: 'Send message',
  formSuccessTitle: 'Message received',
  formSuccessDesc: 'Thanks for reaching out. A member of the Contrazy team will review your message and follow up.',
};
const contactFormFR = {
  formFirstName: 'Prénom',
  formLastName: 'Nom',
  formEmail: 'E-mail',
  formMessage: 'Message',
  formFirstNamePlaceholder: 'Entrez votre prénom',
  formLastNamePlaceholder: 'Entrez votre nom',
  formEmailPlaceholder: 'Entrez votre adresse e-mail',
  formMessagePlaceholder: 'Décrivez votre flux de travail, votre secteur ou votre calendrier de lancement.',
  formSubmit: 'Envoyer le message',
  formSuccessTitle: 'Message reçu',
  formSuccessDesc: "Merci de nous avoir contactés. Un membre de l'équipe Contrazy examinera votre message et vous répondra.",
};

en.marketing.contactPage = Object.assign({}, en.marketing.contactPage, contactFormEN);
fr.marketing.contactPage = Object.assign({}, fr.marketing.contactPage, contactFormFR);

// ── dashboard.vendor.checklistEditor extra keys ────────────────────────────
const checklistEN = {
  itemLabelPlaceholder: "e.g. Driver's License",
  defaultItemLabel: 'ID Card',
  defaultItemDesc: 'Front and back',
  confirmDelete: 'Are you sure you want to delete this checklist template?',
  updatedAt: 'Updated {date}',
};
const checklistFR = {
  itemLabelPlaceholder: 'ex. Permis de conduire',
  defaultItemLabel: "Carte d'identité",
  defaultItemDesc: 'Recto et verso',
  confirmDelete: 'Êtes-vous sûr de vouloir supprimer ce modèle de liste de contrôle ?',
  updatedAt: 'Mis à jour le {date}',
};

en.dashboard.vendor.checklistEditor = Object.assign({}, en.dashboard.vendor.checklistEditor, checklistEN);
fr.dashboard.vendor.checklistEditor = Object.assign({}, fr.dashboard.vendor.checklistEditor, checklistFR);

// ── dashboard.vendor.depositQuickActions extra key ─────────────────────────
const depositEN = { noAction: 'No action' };
const depositFR = { noAction: 'Aucune action' };

en.dashboard.vendor.depositQuickActions = Object.assign({}, en.dashboard.vendor.depositQuickActions, depositEN);
fr.dashboard.vendor.depositQuickActions = Object.assign({}, fr.dashboard.vendor.depositQuickActions, depositFR);

// ── subscriptions.billing toggle / checkout error keys ─────────────────────
// (monthly, yearly, discountLabel, discountTeaser already exist)
// Add aria-label and checkout error fallback alias if missing
const billingEN = {
  toggleAriaLabel: 'Toggle billing interval',
  checkoutError: 'Unable to start the checkout session.',
  statusActive: 'Active',
  statusTrialing: 'Trial',
  statusPastDue: 'Past due',
  statusUnpaid: 'Unpaid',
  statusIncomplete: 'Incomplete',
  statusCanceled: 'Canceled',
  statusExpired: 'Expired',
};
const billingFR = {
  toggleAriaLabel: "Changer l'intervalle de facturation",
  checkoutError: 'Impossible de démarrer la session de paiement.',
  statusActive: 'Actif',
  statusTrialing: 'Essai',
  statusPastDue: 'En retard',
  statusUnpaid: 'Impayé',
  statusIncomplete: 'Incomplet',
  statusCanceled: 'Annulé',
  statusExpired: 'Expiré',
};

en.subscriptions.billing = Object.assign({}, en.subscriptions.billing, billingEN);
fr.subscriptions.billing = Object.assign({}, fr.subscriptions.billing, billingFR);

// ── site.header / site.nav extra keys (used by SiteHeader) ───────────────
const siteHeaderEN = {
  toggleMenu: 'Toggle menu',
  closeMenu: 'Close menu',
  account: 'Account',
  signedIn: 'Signed in',
  hidePassword: 'Hide password',
  showPassword: 'Show password',
};
const siteHeaderFR = {
  toggleMenu: 'Ouvrir le menu',
  closeMenu: 'Fermer le menu',
  account: 'Compte',
  signedIn: 'Connecté',
  hidePassword: 'Masquer le mot de passe',
  showPassword: 'Afficher le mot de passe',
};

en.site.header = Object.assign({}, en.site.header, siteHeaderEN);
fr.site.header = Object.assign({}, fr.site.header, siteHeaderFR);

// ── auth.resetPassword extra keys ─────────────────────────────────────────
const resetPasswordEN = {
  missingToken: 'This password reset link is missing or has expired.',
  passwordPlaceholder: 'Minimum 12 characters',
  confirmPlaceholder: 'Retype your password',
  hidePassword: 'Hide characters',
  showPassword: 'Show characters',
  invalidRequest: 'Invalid reset request',
  unableToReset: 'Unable to reset password',
  unableToResetNow: 'Unable to reset password right now',
};
const resetPasswordFR = {
  missingToken: "Ce lien de réinitialisation est manquant ou a expiré.",
  passwordPlaceholder: 'Minimum 12 caractères',
  confirmPlaceholder: 'Ressaisissez votre mot de passe',
  hidePassword: 'Masquer les caractères',
  showPassword: 'Afficher les caractères',
  invalidRequest: 'Demande de réinitialisation invalide',
  unableToReset: 'Impossible de réinitialiser le mot de passe',
  unableToResetNow: 'Impossible de réinitialiser le mot de passe pour l\'instant',
};

en.auth.resetPassword = Object.assign({}, en.auth.resetPassword, resetPasswordEN);
fr.auth.resetPassword = Object.assign({}, fr.auth.resetPassword, resetPasswordFR);

// ── auth.register error key ────────────────────────────────────────────────
en.auth.register.errors = Object.assign({}, en.auth.register.errors || {}, { invalidFormData: 'Invalid form data' });
fr.auth.register.errors = Object.assign({}, fr.auth.register.errors || {}, { invalidFormData: 'Données de formulaire invalides' });

// ── subscriptions.planCard interval meta ──────────────────────────────────
// Also add vatLabel to subscriptions.billing for use in vendor-billing-workspace
en.subscriptions.billing.vatLabel = 'excl. VAT';
fr.subscriptions.billing.vatLabel = 'HT';

const planCardEN = {
  intervalYearWithEquiv: '/ yr · {equiv}/mo',
  intervalYear: '/ yr',
  intervalMonth: '/ mo',
  vatLabel: 'excl. VAT',
};
const planCardFR = {
  intervalYearWithEquiv: '/ an · {equiv}/mois',
  intervalYear: '/ an',
  intervalMonth: '/ mois',
  vatLabel: 'HT',
};

en.subscriptions.planCard = Object.assign({}, en.subscriptions.planCard, planCardEN);
fr.subscriptions.planCard = Object.assign({}, fr.subscriptions.planCard, planCardFR);

// ── auth — password toggle keys added to login + register namespaces ───────
const pwToggleEN = { hidePassword: 'Hide password', showPassword: 'Show password' };
const pwToggleFR = { hidePassword: 'Masquer le mot de passe', showPassword: 'Afficher le mot de passe' };

en.auth.login = Object.assign({}, en.auth.login, pwToggleEN);
fr.auth.login = Object.assign({}, fr.auth.login, pwToggleFR);
en.auth.register = Object.assign({}, en.auth.register, pwToggleEN);
fr.auth.register = Object.assign({}, fr.auth.register, pwToggleFR);

// forgot-password invalidEmail fallback
en.auth.forgotPassword = Object.assign({}, en.auth.forgotPassword, { invalidEmail: 'Invalid email' });
fr.auth.forgotPassword = Object.assign({}, fr.auth.forgotPassword, { invalidEmail: 'Adresse e-mail invalide' });

// ── dashboard.vendor.checklistEditor — phoneInvalid for clientFlow ──────────
// Already added in a prior run, ensure clientFlow.profile.phoneInvalid exists
if (!en.clientFlow.profile.phoneInvalid) {
  en.clientFlow.profile.phoneInvalid = 'Please enter a valid phone number';
}
if (!fr.clientFlow.profile.phoneInvalid) {
  fr.clientFlow.profile.phoneInvalid = 'Veuillez entrer un numéro de téléphone valide';
}

// ── dashboard.vendor.contractTemplateEditor ───────────────────────────────────
const contractTemplateEditorEN = {
  backToTemplates: 'Back to templates',
  back: 'Back',
  editTitle: 'Edit template',
  createTitle: 'New template',
  subtitle: 'Draft the agreement your client will review and sign.',
  previewToggleBack: 'Back to Editor',
  previewToggle: 'Preview',
  deleteBtn: 'Delete',
  savingBtn: 'Saving...',
  saveBtn: 'Save',
  createBtn: 'Create',
  nameLabel: 'Name',
  namePlaceholder: 'Standard service agreement',
  descriptionLabel: 'Description',
  descriptionPlaceholder: 'Optional internal note',
  updatedAt: 'Updated {date}',
  unsavedDraft: 'Unsaved draft',
  editorPlaceholder: 'Write the agreement your client will review and sign.',
  localDraftTitle: 'Local draft found',
  localDraftDesc: 'A newer draft from this browser is available for this template.',
  discard: 'Discard',
  resumeDraft: 'Resume draft',
  draftRestoredTitle: 'Local draft restored',
  draftRestoredDesc: 'Recovered the newer draft saved in this browser.',
  editingUnavailableTitle: 'Editing unavailable',
  templateLimitTitle: 'Template limit reached',
  planLimitReached: 'Your current plan limit has been reached.',
  saveFailedTitle: 'Save failed',
  untitled: 'Untitled template',
  previewSubtitle: 'Review the live A4 document layout with sample values applied.',
  contractCardTitle: 'Contract',
  insertFieldsTitle: 'Insert fields',
  insertFieldsDesc: 'Add client and transaction values at the current cursor.',
  changesLocal: 'Changes are being saved locally in this browser.',
  changesSynced: 'All changes are synced with the last manual save.',
  contentTooLong: 'Contract terms cannot exceed {limit} characters.',
  saveErrorUpdate: 'Unable to update template right now.',
  saveErrorCreate: 'Unable to create template right now.',
  savedTitle: 'Template saved',
  savedDesc: 'Your changes have been saved.',
  createdTitle: 'Template created',
  createdDesc: '{name} is ready to edit and use in transactions.',
  defaultTemplateName: 'Your template',
  deleteConfirm: 'Delete this template? Existing signed transactions will stay unchanged.',
  deleteError: 'Unable to delete template right now.',
};
const contractTemplateEditorFR = {
  backToTemplates: 'Retour aux modèles',
  back: 'Retour',
  editTitle: 'Modifier le modèle',
  createTitle: 'Nouveau modèle',
  subtitle: "Rédigez l'accord que votre client examinera et signera.",
  previewToggleBack: "Retour à l'éditeur",
  previewToggle: 'Aperçu',
  deleteBtn: 'Supprimer',
  savingBtn: 'Enregistrement...',
  saveBtn: 'Enregistrer',
  createBtn: 'Créer',
  nameLabel: 'Nom',
  namePlaceholder: 'Contrat de prestation standard',
  descriptionLabel: 'Description',
  descriptionPlaceholder: 'Note interne optionnelle',
  updatedAt: 'Mis à jour le {date}',
  unsavedDraft: 'Brouillon non enregistré',
  editorPlaceholder: "Rédigez l'accord que votre client examinera et signera.",
  localDraftTitle: 'Brouillon local trouvé',
  localDraftDesc: 'Un brouillon plus récent de ce navigateur est disponible pour ce modèle.',
  discard: 'Ignorer',
  resumeDraft: 'Reprendre le brouillon',
  draftRestoredTitle: 'Brouillon local restauré',
  draftRestoredDesc: 'Le brouillon plus récent enregistré dans ce navigateur a été récupéré.',
  editingUnavailableTitle: 'Modification impossible',
  templateLimitTitle: 'Limite de modèles atteinte',
  planLimitReached: 'La limite de votre plan actuel a été atteinte.',
  saveFailedTitle: 'Échec de l\'enregistrement',
  untitled: 'Modèle sans titre',
  previewSubtitle: 'Consultez la mise en page A4 avec des valeurs exemples appliquées.',
  contractCardTitle: 'Contrat',
  insertFieldsTitle: 'Insérer des champs',
  insertFieldsDesc: 'Ajoutez des valeurs client et transaction à la position du curseur.',
  changesLocal: 'Les modifications sont sauvegardées localement dans ce navigateur.',
  changesSynced: 'Toutes les modifications sont synchronisées avec la dernière sauvegarde manuelle.',
  contentTooLong: 'Le contrat ne peut pas dépasser {limit} caractères.',
  saveErrorUpdate: 'Impossible de mettre à jour le modèle pour l\'instant.',
  saveErrorCreate: 'Impossible de créer le modèle pour l\'instant.',
  savedTitle: 'Modèle enregistré',
  savedDesc: 'Vos modifications ont été enregistrées.',
  createdTitle: 'Modèle créé',
  createdDesc: '{name} est prêt à être modifié et utilisé dans des transactions.',
  defaultTemplateName: 'Votre modèle',
  deleteConfirm: 'Supprimer ce modèle ? Les transactions signées existantes resteront inchangées.',
  deleteError: 'Impossible de supprimer le modèle pour l\'instant.',
};

if (!en.dashboard.vendor.contractTemplateEditor) en.dashboard.vendor.contractTemplateEditor = {};
if (!fr.dashboard.vendor.contractTemplateEditor) fr.dashboard.vendor.contractTemplateEditor = {};
en.dashboard.vendor.contractTemplateEditor = Object.assign({}, en.dashboard.vendor.contractTemplateEditor, contractTemplateEditorEN);
fr.dashboard.vendor.contractTemplateEditor = Object.assign({}, fr.dashboard.vendor.contractTemplateEditor, contractTemplateEditorFR);

// ── dashboard.vendor.servicePaymentRequest ────────────────────────────────────
const servicePaymentRequestEN = {
  title: 'Deferred service payment',
  description: 'Use the same secure link later when the service payment should be collected after delivery.',
  amountLabel: 'Amount',
  clientOnboardingLabel: 'Client onboarding',
  completedOn: 'Completed on {date}.',
  onboardingPending: 'The client must finish the initial profile, documents, agreement, and any deposit step first.',
  requestStatusLabel: 'Request status',
  alreadyCollected: 'Service payment already collected.',
  requestedOn: 'Requested on {date}.',
  notRequestedYet: 'Not requested yet.',
  requestBtn: 'Request service payment',
  requestError: 'Unable to request service payment right now.',
};
const servicePaymentRequestFR = {
  title: 'Paiement de service différé',
  description: 'Utilisez le même lien sécurisé plus tard lorsque le paiement doit être collecté après la livraison.',
  amountLabel: 'Montant',
  clientOnboardingLabel: 'Onboarding client',
  completedOn: 'Complété le {date}.',
  onboardingPending: "Le client doit d'abord terminer le profil, les documents, l'accord et toute étape de dépôt.",
  requestStatusLabel: 'Statut de la demande',
  alreadyCollected: 'Paiement de service déjà collecté.',
  requestedOn: 'Demandé le {date}.',
  notRequestedYet: 'Pas encore demandé.',
  requestBtn: 'Demander le paiement de service',
  requestError: 'Impossible de demander le paiement de service pour l\'instant.',
};

if (!en.dashboard.vendor.servicePaymentRequest) en.dashboard.vendor.servicePaymentRequest = {};
if (!fr.dashboard.vendor.servicePaymentRequest) fr.dashboard.vendor.servicePaymentRequest = {};
en.dashboard.vendor.servicePaymentRequest = Object.assign({}, en.dashboard.vendor.servicePaymentRequest, servicePaymentRequestEN);
fr.dashboard.vendor.servicePaymentRequest = Object.assign({}, fr.dashboard.vendor.servicePaymentRequest, servicePaymentRequestFR);

// ── marketing.pricingSection — PricingSection component keys ─────────────────
const pricingSectionExtraEN = {
  heading: 'Simple launch pricing with room to scale',
  subDescription: 'Choose a plan that fits your launch stage now, with room to expand as workflow volume grows.',
  monthly: 'Monthly',
  yearly: 'Yearly',
  perMonth: 'per month',
  perYear: 'per year',
};
const pricingSectionExtraFR = {
  heading: 'Des tarifs simples pour démarrer et évoluer',
  subDescription: "Choisissez un plan adapté à votre phase de lancement, avec la possibilité d'évoluer à mesure que vos workflows se développent.",
  monthly: 'Mensuel',
  yearly: 'Annuel',
  perMonth: 'par mois',
  perYear: 'par an',
};

en.marketing.pricingSection = Object.assign({}, en.marketing.pricingSection, pricingSectionExtraEN);
fr.marketing.pricingSection = Object.assign({}, fr.marketing.pricingSection, pricingSectionExtraFR);

// ── common — additional UI strings ───────────────────────────────────────────
const commonDashboardEN = {
  all: 'All',
  apply: 'Apply',
  reset: 'Reset',
  prev: 'Prev',
  showingResults: 'Showing {start}–{end} of {total} results',
  noRecordsYet: 'No records yet.',
};
const commonDashboardFR = {
  all: 'Tous',
  apply: 'Appliquer',
  reset: 'Réinitialiser',
  prev: 'Préc.',
  showingResults: 'Affichage {start}–{end} sur {total} résultats',
  noRecordsYet: 'Aucun enregistrement pour l\'instant.',
};

en.common = Object.assign({}, en.common, commonDashboardEN);
fr.common = Object.assign({}, fr.common, commonDashboardFR);

// ── common — UI accessibility strings ────────────────────────────────────────
const commonExtraEN = {
  dismiss: 'Dismiss',
  clear: 'Clear',
  languageSwitcher: 'Language switcher',
  openAccountMenu: 'Open account menu',
  signHere: 'Sign here',
  signHereHint: 'Mouse, stylus or finger',
  selectCountry: 'Select country',
  searchCountry: 'Search country...',
  searchCountryOrDial: 'Search country or dial code...',
  enterPhoneNumber: 'Enter phone number',
};
const commonExtraFR = {
  dismiss: 'Ignorer',
  clear: 'Effacer',
  languageSwitcher: 'Sélecteur de langue',
  openAccountMenu: 'Ouvrir le menu du compte',
  signHere: 'Signez ici',
  signHereHint: 'Souris, stylet ou doigt',
  selectCountry: 'Sélectionner un pays',
  searchCountry: 'Rechercher un pays...',
  searchCountryOrDial: 'Rechercher un pays ou un indicatif...',
  enterPhoneNumber: 'Entrez votre numéro de téléphone',
};

en.common = Object.assign({}, en.common, commonExtraEN);
fr.common = Object.assign({}, fr.common, commonExtraFR);

// ── dashboard.vendor.subscribePage ───────────────────────────────────────────
const subscribePageEN = {
  badge: 'Vendor billing',
  heading: 'Activate your workspace before launching vendor operations',
  description: 'Your business profile stays editable, but transactions, payments, KYC, contracts, and live customer links are locked until the workspace has an active subscription.',
  canceledNote: 'Stripe checkout was cancelled. Select a plan below whenever you are ready.',
  billingAccessTitle: 'Billing access',
  billingAccessDesc: 'Plans are billed on the platform account through Stripe Checkout.',
  profileStaysOpenTitle: 'Profile stays open',
  profileStaysOpenDesc: 'You can still maintain your business profile while subscription setup is pending.',
  pricingSectionLabel: 'Tarifs',
  pricingSectionHeading: 'Choose the plan that matches your volume',
  pricingSectionDesc: 'Starter, Pro, and Business use secure Stripe-hosted checkout. Enterprise remains contact-only.',
};
const subscribePageFR = {
  badge: 'Facturation vendeur',
  heading: 'Activez votre espace de travail avant de lancer vos opérations',
  description: "Votre profil professionnel reste modifiable, mais les transactions, paiements, KYC, contrats et liens clients sont verrouillés jusqu'à l'activation d'un abonnement.",
  canceledNote: 'Le paiement Stripe a été annulé. Sélectionnez un plan ci-dessous quand vous êtes prêt.',
  billingAccessTitle: 'Accès à la facturation',
  billingAccessDesc: 'Les plans sont facturés via le compte plateforme par Stripe Checkout.',
  profileStaysOpenTitle: 'Profil toujours accessible',
  profileStaysOpenDesc: "Vous pouvez toujours gérer votre profil professionnel pendant la configuration de l'abonnement.",
  pricingSectionLabel: 'Tarifs',
  pricingSectionHeading: 'Choisissez le plan adapté à votre volume',
  pricingSectionDesc: 'Les plans Starter, Pro et Business utilisent le paiement sécurisé Stripe. Enterprise est sur devis uniquement.',
};

if (!en.dashboard.vendor.subscribePage) en.dashboard.vendor.subscribePage = {};
if (!fr.dashboard.vendor.subscribePage) fr.dashboard.vendor.subscribePage = {};
en.dashboard.vendor.subscribePage = Object.assign({}, en.dashboard.vendor.subscribePage, subscribePageEN);
fr.dashboard.vendor.subscribePage = Object.assign({}, fr.dashboard.vendor.subscribePage, subscribePageFR);

// ── dashboard.vendor.transactionCreation — reqLabelPlaceholder ───────────────
if (!en.dashboard.vendor.transactionCreation.reqLabelPlaceholder) {
  en.dashboard.vendor.transactionCreation.reqLabelPlaceholder = "e.g. Driver's license";
  fr.dashboard.vendor.transactionCreation.reqLabelPlaceholder = "ex. Permis de conduire";
}

// ── clientFlow.embeddedPayment — dynamic button + step indicator keys ─────────
const embeddedPaymentEN = {
  authorizeHold: 'Authorize {amount} Hold',
  payNow: 'Pay {amount} Now',
  stepOf: 'Step {step} of {total}',
};
const embeddedPaymentFR = {
  authorizeHold: 'Autoriser le hold de {amount}',
  payNow: 'Payer {amount} maintenant',
  stepOf: 'Étape {step} sur {total}',
};

en.clientFlow.embeddedPayment = Object.assign({}, en.clientFlow.embeddedPayment, embeddedPaymentEN);
fr.clientFlow.embeddedPayment = Object.assign({}, fr.clientFlow.embeddedPayment, embeddedPaymentFR);

// ── dashboard.vendor.contractTemplateEditor — toolbar + link keys ─────────────
const editorToolbarEN = {
  headingNormal: 'Normal',
  headingH1: 'Heading 1',
  headingH2: 'Heading 2',
  headingH3: 'Heading 3',
  toolBold: 'Bold (Ctrl+B)',
  toolItalic: 'Italic (Ctrl+I)',
  toolUnderline: 'Underline (Ctrl+U)',
  toolStrike: 'Strikethrough',
  toolOrderedList: 'Numbered list',
  toolBulletList: 'Bullet list',
  toolAlignLeft: 'Align left',
  toolAlignCenter: 'Align center',
  toolAlignRight: 'Align right',
  toolAlignJustify: 'Justify',
  toolBlockquote: 'Blockquote',
  toolLink: 'Insert / edit link',
  toolClearFormat: 'Clear formatting',
  linkPlaceholder: 'https://example.com',
  linkApply: 'Apply link',
  linkRemove: 'Remove link',
  cancel: 'Cancel',
};
const editorToolbarFR = {
  headingNormal: 'Normal',
  headingH1: 'Titre 1',
  headingH2: 'Titre 2',
  headingH3: 'Titre 3',
  toolBold: 'Gras (Ctrl+B)',
  toolItalic: 'Italique (Ctrl+I)',
  toolUnderline: 'Souligné (Ctrl+U)',
  toolStrike: 'Barré',
  toolOrderedList: 'Liste numérotée',
  toolBulletList: 'Liste à puces',
  toolAlignLeft: 'Aligner à gauche',
  toolAlignCenter: 'Centrer',
  toolAlignRight: 'Aligner à droite',
  toolAlignJustify: 'Justifier',
  toolBlockquote: 'Citation',
  toolLink: 'Insérer / modifier un lien',
  toolClearFormat: 'Supprimer la mise en forme',
  linkPlaceholder: 'https://exemple.com',
  linkApply: 'Appliquer le lien',
  linkRemove: 'Supprimer le lien',
  cancel: 'Annuler',
};

if (!en.dashboard.vendor.contractTemplateEditor) en.dashboard.vendor.contractTemplateEditor = {};
if (!fr.dashboard.vendor.contractTemplateEditor) fr.dashboard.vendor.contractTemplateEditor = {};
en.dashboard.vendor.contractTemplateEditor = Object.assign({}, en.dashboard.vendor.contractTemplateEditor, editorToolbarEN);
fr.dashboard.vendor.contractTemplateEditor = Object.assign({}, fr.dashboard.vendor.contractTemplateEditor, editorToolbarFR);

// ── Shared contract-flow option labels ───────────────────────────────────────
// Added to transactionCreation, checklistEditor, and clientFlow.uploads

const contractFlowOptionsEN = {
  paymentTimingAfterSigningLabel: 'Collect after signing',
  paymentTimingAfterSigningDesc: 'The client pays the service amount during the same secure flow.',
  paymentTimingAfterServiceLabel: 'Collect after service',
  paymentTimingAfterServiceDesc: 'The client finishes onboarding now and you trigger the service payment later.',
  reqTypeDocument: 'Document',
  reqTypePhoto: 'Photo',
  reqTypeText: 'Text input',
  reqCategoryId: 'ID',
  reqCategoryProofOfAddress: 'Proof of address',
  reqCategoryDriverLicense: 'Driver license',
  reqCategoryCompanyRegistration: 'Company registration',
  reqCategoryContractAttachment: 'Contract attachment',
  reqCategoryCustom: 'Custom document',
  reqCategoryOther: 'Other',
};
const contractFlowOptionsFR = {
  paymentTimingAfterSigningLabel: 'Paiement après signature',
  paymentTimingAfterSigningDesc: "Le client paie le montant du service lors du même flux sécurisé.",
  paymentTimingAfterServiceLabel: 'Paiement après la prestation',
  paymentTimingAfterServiceDesc: "Le client termine l'onboarding maintenant et vous déclenchez le paiement ultérieurement.",
  reqTypeDocument: 'Document',
  reqTypePhoto: 'Photo',
  reqTypeText: 'Saisie texte',
  reqCategoryId: 'Pièce d\'identité',
  reqCategoryProofOfAddress: 'Justificatif de domicile',
  reqCategoryDriverLicense: 'Permis de conduire',
  reqCategoryCompanyRegistration: 'Immatriculation de société',
  reqCategoryContractAttachment: 'Annexe contractuelle',
  reqCategoryCustom: 'Document personnalisé',
  reqCategoryOther: 'Autre',
};

// Add to transactionCreation
en.dashboard.vendor.transactionCreation = Object.assign({}, en.dashboard.vendor.transactionCreation, contractFlowOptionsEN);
fr.dashboard.vendor.transactionCreation = Object.assign({}, fr.dashboard.vendor.transactionCreation, contractFlowOptionsFR);

// Add to checklistEditor
if (!en.dashboard.vendor.checklistEditor) en.dashboard.vendor.checklistEditor = {};
if (!fr.dashboard.vendor.checklistEditor) fr.dashboard.vendor.checklistEditor = {};
const checklistCategoryEN = Object.fromEntries(Object.entries(contractFlowOptionsEN).filter(([k]) => k.startsWith('reqCategory')));
const checklistCategoryFR = Object.fromEntries(Object.entries(contractFlowOptionsFR).filter(([k]) => k.startsWith('reqCategory')));
en.dashboard.vendor.checklistEditor = Object.assign({}, en.dashboard.vendor.checklistEditor, checklistCategoryEN);
fr.dashboard.vendor.checklistEditor = Object.assign({}, fr.dashboard.vendor.checklistEditor, checklistCategoryFR);

// Add to clientFlow.uploads
if (!en.clientFlow) en.clientFlow = {};
if (!fr.clientFlow) fr.clientFlow = {};
if (!en.clientFlow.uploads) en.clientFlow.uploads = {};
if (!fr.clientFlow.uploads) fr.clientFlow.uploads = {};
const uploadsOptionsEN = {
  ...Object.fromEntries(Object.entries(contractFlowOptionsEN).filter(([k]) => k.startsWith('reqCategory'))),
  reqTextPlaceholderProofOfAddress: 'Enter the address evidence details',
  reqTextPlaceholderCompanyRegistration: 'Enter the registration details',
  reqTextPlaceholderContractAttachment: 'Add the attachment notes or reference',
  reqTextPlaceholderOther: 'Enter the requested information',
  reqTextPlaceholderDefault: 'Type the requested information',
};
const uploadsOptionsFR = {
  ...Object.fromEntries(Object.entries(contractFlowOptionsFR).filter(([k]) => k.startsWith('reqCategory'))),
  reqTextPlaceholderProofOfAddress: "Entrez les justificatifs d'adresse",
  reqTextPlaceholderCompanyRegistration: "Entrez les informations d'immatriculation",
  reqTextPlaceholderContractAttachment: "Ajoutez les notes ou la référence de l'annexe",
  reqTextPlaceholderOther: 'Entrez les informations demandées',
  reqTextPlaceholderDefault: 'Saisissez les informations demandées',
};
en.clientFlow.uploads = Object.assign({}, en.clientFlow.uploads, uploadsOptionsEN);
fr.clientFlow.uploads = Object.assign({}, fr.clientFlow.uploads, uploadsOptionsFR);

fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
fs.writeFileSync(frPath, JSON.stringify(fr, null, 2));
console.log('Both files updated successfully');

function countKeys(obj) {
  let count = 0;
  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) count += countKeys(val);
    else count += 1;
  }
  return count;
}
console.log('EN keys:', countKeys(en), '| FR keys:', countKeys(fr));
