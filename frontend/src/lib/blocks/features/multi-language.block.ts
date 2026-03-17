import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

/**
 * Multi-Language Block — i18n system for generated projects
 *
 * Generates:
 * - src/lib/i18n.tsx — React context + useT() hook + translations (EN/DE/RU)
 * - src/components/LanguageSwitcher.tsx — dropdown language selector
 *
 * All UI strings go through t('key') — falls back to English if key missing.
 * Language persisted in localStorage.
 */
export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const primaryOutput = ctx.safe.primaryOutput || 'result';
  const primaryOutputCap = primaryOutput.charAt(0).toUpperCase() + primaryOutput.slice(1);

  return {
    'src/lib/i18n.tsx': `'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type Locale = 'en' | 'de' | 'ru';

const LOCALE_KEY = 'app_locale';

// ─── Translation Dictionary ───

const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.createNew': 'Create New',
    'nav.history': 'History',
    'nav.clients': 'Clients',
    'nav.reports': 'Reports',
    'nav.settings': 'Settings',
    'nav.legalPages': 'Legal Pages',
    'nav.billing': 'Billing',
    'nav.signIn': 'Sign In',
    'nav.signOut': 'Sign Out',
    'nav.getStarted': 'Get Started',
    'nav.backToHome': 'Back to Home',

    // Common actions
    'action.save': 'Save',
    'action.saveAll': 'Save All',
    'action.cancel': 'Cancel',
    'action.delete': 'Delete',
    'action.edit': 'Edit',
    'action.create': 'Create',
    'action.send': 'Send',
    'action.download': 'Download',
    'action.export': 'Export',
    'action.import': 'Import',
    'action.search': 'Search...',
    'action.filter': 'Filter',
    'action.back': 'Back',
    'action.next': 'Next',
    'action.preview': 'Preview',
    'action.duplicate': 'Duplicate',
    'action.close': 'Close',
    'action.confirm': 'Confirm',
    'action.add': 'Add',
    'action.remove': 'Remove',
    'action.upload': 'Upload',
    'action.csv': 'CSV',
    'action.pdf': 'PDF',

    // Status
    'status.draft': 'Draft',
    'status.sent': 'Sent',
    'status.paid': 'Paid',
    'status.overdue': 'Overdue',
    'status.cancelled': 'Cancelled',
    'status.partial': 'Partial',
    'status.pending': 'Pending',
    'status.active': 'Active',
    'status.completed': 'Completed',

    // Common labels
    'label.email': 'Email',
    'label.password': 'Password',
    'label.name': 'Name',
    'label.phone': 'Phone',
    'label.address': 'Address',
    'label.company': 'Company',
    'label.website': 'Website',
    'label.date': 'Date',
    'label.amount': 'Amount',
    'label.total': 'Total',
    'label.subtotal': 'Subtotal',
    'label.tax': 'Tax',
    'label.notes': 'Notes',
    'label.description': 'Description',
    'label.quantity': 'Quantity',
    'label.rate': 'Rate',
    'label.number': 'Number',
    'label.currency': 'Currency',
    'label.status': 'Status',
    'label.client': 'Client',
    'label.from': 'From',
    'label.to': 'To',
    'label.dueDate': 'Due Date',
    'label.issueDate': 'Issue Date',

    // Common messages
    'msg.loading': 'Loading...',
    'msg.noResults': 'No results found',
    'msg.noData': 'No data available',
    'msg.saved': 'Saved!',
    'msg.deleted': 'Deleted',
    'msg.error': 'Something went wrong',
    'msg.success': 'Success',
    'msg.confirmDelete': 'Are you sure you want to delete this?',
    'msg.processing': 'Processing...',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.revenue': 'Revenue',
    'dashboard.revenueThisMonth': 'Revenue This Month',
    'dashboard.outstanding': 'Outstanding',
    'dashboard.totalItems': 'Total ${primaryOutputCap}s',
    'dashboard.totalClients': 'Total Clients',
    'dashboard.recentItems': 'Recent ${primaryOutputCap}s',
    'dashboard.quickActions': 'Quick Actions',
    'dashboard.overdue': 'Overdue',
    'dashboard.newItem': 'New ${primaryOutputCap}',
    'dashboard.viewAll': 'View All',
    'dashboard.last30Days': 'Last 30 Days',
    'dashboard.noItems': 'No ${primaryOutput}s yet. Create your first one!',

    // Create / Form
    'create.title': 'New ${primaryOutputCap}',
    'create.editTitle': 'Edit ${primaryOutputCap}',
    'create.from': 'From (Your Business)',
    'create.to': 'To (Recipient)',
    'create.details': 'Details',
    'create.lineItems': 'Line Items',
    'create.addItem': 'Add Item',
    'create.paymentTerms': 'Payment Terms',
    'create.taxRate': 'Tax Rate',
    'create.submit': 'Create ${primaryOutputCap}',
    'create.update': 'Update ${primaryOutputCap}',
    'create.itemDescription': 'Item description',

    // History
    'history.title': 'History',
    'history.all': 'All',
    'history.searchPlaceholder': 'Search by number, client...',
    'history.deleteConfirm': 'Delete this item?',
    'history.noItems': 'No items found',

    // Clients
    'clients.title': 'Clients',
    'clients.addClient': 'Add Client',
    'clients.editClient': 'Edit Client',
    'clients.searchPlaceholder': 'Search clients...',
    'clients.noClients': 'No clients yet',
    'clients.totalBilled': 'Total Billed',
    'clients.totalPaid': 'Total Paid',
    'clients.invoices': 'invoices',

    // Reports
    'reports.title': 'Reports',
    'reports.totalBilled': 'Total Billed',
    'reports.collected': 'Collected',
    'reports.unpaid': 'Unpaid',
    'reports.totalTax': 'Total Tax',
    'reports.income': 'Income',
    'reports.byClient': 'By Client',
    'reports.monthlyBreakdown': 'Monthly Breakdown',
    'reports.taxSummary': 'Tax Summary',
    'reports.revenueByClient': 'Revenue by Client',
    'reports.noData': 'No data for this period',
    'reports.ofTotal': 'of total',
    'reports.billed': 'Billed',

    // Settings
    'settings.title': 'Settings',
    'settings.business': 'Business',
    'settings.invoiceDefaults': 'Invoice Defaults',
    'settings.payment': 'Payment',
    'settings.businessName': 'Business Name',
    'settings.logo': 'Logo',
    'settings.uploadLogo': 'Upload Logo',
    'settings.taxId': 'Tax ID',
    'settings.invoicePrefix': 'Invoice Prefix',
    'settings.defaultTaxRate': 'Default Tax Rate',
    'settings.taxLabel': 'Tax Label',

    // Legal
    'legal.privacyPolicy': 'Privacy Policy',
    'legal.termsOfService': 'Terms of Service',
    'legal.aboutUs': 'About Us',
    'legal.faq': 'FAQ',
    'legal.editor': 'Legal Pages Editor',
    'legal.editorSubtitle': 'Edit your Privacy Policy, Terms, About, and FAQ',
    'legal.placeholdersNeedData': 'placeholders need your data',
    'legal.typeAndEnter': 'Type a value and press Enter to replace all occurrences.',

    // Landing
    'landing.features': 'Features',
    'landing.howItWorks': 'How It Works',
    'landing.pricing': 'Pricing',
    'landing.getStartedFree': 'Get Started Free',
    'landing.seeHowItWorks': 'See How It Works',
    'landing.startFreeTrial': 'Start Free Trial',
    'landing.mostPopular': 'Most Popular',
    'landing.free': 'Free',
    'landing.perMonth': '/month',
    'landing.readyToStart': 'Ready to get started?',
    'landing.joinUsers': 'Join hundreds of users who already save time.',
    'landing.threeSteps': 'Three simple steps',
    'landing.startFree': 'Start free, upgrade when ready',
    'landing.noCreditCard': 'No credit card required. Cancel anytime.',
    'landing.activeUsers': 'Active Users',
    'landing.rating': 'Rating',
    'landing.fasterResults': 'Faster Results',
    'landing.sectionProblem': 'THE PROBLEM',
    'landing.soundFamiliar': 'Sound familiar?',
    'landing.sectionFeatures': 'FEATURES',
    'landing.builtToSolve': 'Built to solve real problems',
    'landing.everythingYouNeed': 'Everything you need',
    'landing.everyFeature': 'Every feature addresses a real pain point.',
    'landing.powerfulTools': 'Powerful tools designed for speed and simplicity.',
    'landing.sectionHowItWorks': 'HOW IT WORKS',
    'landing.fromStartToFinish': 'From start to finish in minutes',
    'landing.sectionPricing': 'PRICING',
    'landing.createFirst': 'Create Your First',

    // Create page form labels
    'create.businessName': 'Business Name',
    'create.clientName': 'Client Name',
    'create.clientEmail': 'Client Email',
    'create.clientAddress': 'Client Address',
    'create.saveDefault': 'Save as default',
    'create.saved': 'Saved',
    'create.notesPlaceholder': 'Payment instructions, thank you message, or additional terms...',
    'create.taxAmount': 'Tax amount',
    'create.items': 'Items',

    // Payment terms
    'payment.dueOnReceipt': 'Due on Receipt',
    'payment.net15': 'Net 15',
    'payment.net30': 'Net 30',
    'payment.net60': 'Net 60',

    // Stripe / Payment settings
    'settings.stripeConfig': 'Stripe Configuration',
    'settings.stripeDescription': 'Connect your Stripe account to accept payments from your customers.',
    'settings.publishableKey': 'Publishable Key',
    'settings.secretKey': 'Secret Key',
    'settings.stripeConnected': 'Connected',
    'settings.stripeNotConnected': 'Not connected',
    'settings.stripeInstructions': 'Get your API keys from',
    'settings.stripeDashboard': 'Stripe Dashboard',
    'settings.testConnection': 'Test Connection',
    'settings.stripeTestSuccess': 'Connection successful!',
    'settings.stripeTestFailed': 'Connection failed. Please check your keys.',
    'settings.paymentInstructions': 'Payment Instructions',
    'settings.paymentInstructionsHint': 'These instructions will appear at the bottom of your invoices and PDF exports.',
    'settings.account': 'Account',
    'settings.logoHint': 'PNG or JPG, max 500KB. Shows on invoices and PDF.',
    'settings.defaultValues': 'Default Values',
    'settings.invoiceNumberPrefix': 'Invoice Number Prefix',
    'settings.defaultNotes': 'Default Notes',
    'settings.defaultNotesHint': 'This will appear on every new invoice by default.',

    // Periods
    'period.7d': '7 days',
    'period.30d': '30 days',
    'period.90d': '90 days',
    'period.12m': '12 months',
    'period.all': 'All time',
  },

  de: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.createNew': 'Neu erstellen',
    'nav.history': 'Verlauf',
    'nav.clients': 'Kunden',
    'nav.reports': 'Berichte',
    'nav.settings': 'Einstellungen',
    'nav.legalPages': 'Rechtliches',
    'nav.billing': 'Abrechnung',
    'nav.signIn': 'Anmelden',
    'nav.signOut': 'Abmelden',
    'nav.getStarted': 'Loslegen',
    'nav.backToHome': 'Zur Startseite',

    // Common actions
    'action.save': 'Speichern',
    'action.saveAll': 'Alles speichern',
    'action.cancel': 'Abbrechen',
    'action.delete': 'L\\u00f6schen',
    'action.edit': 'Bearbeiten',
    'action.create': 'Erstellen',
    'action.send': 'Senden',
    'action.download': 'Herunterladen',
    'action.export': 'Exportieren',
    'action.import': 'Importieren',
    'action.search': 'Suchen...',
    'action.filter': 'Filtern',
    'action.back': 'Zur\\u00fcck',
    'action.next': 'Weiter',
    'action.preview': 'Vorschau',
    'action.duplicate': 'Duplizieren',
    'action.close': 'Schlie\\u00dfen',
    'action.confirm': 'Best\\u00e4tigen',
    'action.add': 'Hinzuf\\u00fcgen',
    'action.remove': 'Entfernen',
    'action.upload': 'Hochladen',
    'action.csv': 'CSV',
    'action.pdf': 'PDF',

    // Status
    'status.draft': 'Entwurf',
    'status.sent': 'Gesendet',
    'status.paid': 'Bezahlt',
    'status.overdue': '\\u00dcberf\\u00e4llig',
    'status.cancelled': 'Storniert',
    'status.partial': 'Teilweise',
    'status.pending': 'Ausstehend',
    'status.active': 'Aktiv',
    'status.completed': 'Abgeschlossen',

    // Common labels
    'label.email': 'E-Mail',
    'label.password': 'Passwort',
    'label.name': 'Name',
    'label.phone': 'Telefon',
    'label.address': 'Adresse',
    'label.company': 'Unternehmen',
    'label.website': 'Webseite',
    'label.date': 'Datum',
    'label.amount': 'Betrag',
    'label.total': 'Gesamt',
    'label.subtotal': 'Zwischensumme',
    'label.tax': 'Steuer',
    'label.notes': 'Notizen',
    'label.description': 'Beschreibung',
    'label.quantity': 'Menge',
    'label.rate': 'Preis',
    'label.number': 'Nummer',
    'label.currency': 'W\\u00e4hrung',
    'label.status': 'Status',
    'label.client': 'Kunde',
    'label.from': 'Von',
    'label.to': 'An',
    'label.dueDate': 'F\\u00e4lligkeitsdatum',
    'label.issueDate': 'Ausstellungsdatum',

    // Common messages
    'msg.loading': 'Wird geladen...',
    'msg.noResults': 'Keine Ergebnisse gefunden',
    'msg.noData': 'Keine Daten verf\\u00fcgbar',
    'msg.saved': 'Gespeichert!',
    'msg.deleted': 'Gel\\u00f6scht',
    'msg.error': 'Etwas ist schiefgelaufen',
    'msg.success': 'Erfolgreich',
    'msg.confirmDelete': 'M\\u00f6chten Sie dies wirklich l\\u00f6schen?',
    'msg.processing': 'Verarbeitung...',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.revenue': 'Umsatz',
    'dashboard.revenueThisMonth': 'Umsatz diesen Monat',
    'dashboard.outstanding': 'Ausstehend',
    'dashboard.totalItems': 'Gesamt',
    'dashboard.totalClients': 'Kunden gesamt',
    'dashboard.recentItems': 'Neueste Eintr\\u00e4ge',
    'dashboard.quickActions': 'Schnellaktionen',
    'dashboard.overdue': '\\u00dcberf\\u00e4llig',
    'dashboard.newItem': 'Neu erstellen',
    'dashboard.viewAll': 'Alle anzeigen',
    'dashboard.last30Days': 'Letzte 30 Tage',
    'dashboard.noItems': 'Noch keine Eintr\\u00e4ge. Erstellen Sie den ersten!',

    // Create / Form
    'create.title': 'Neu erstellen',
    'create.editTitle': 'Bearbeiten',
    'create.from': 'Von (Ihr Unternehmen)',
    'create.to': 'An (Empf\\u00e4nger)',
    'create.details': 'Details',
    'create.lineItems': 'Positionen',
    'create.addItem': 'Position hinzuf\\u00fcgen',
    'create.paymentTerms': 'Zahlungsbedingungen',
    'create.taxRate': 'Steuersatz',
    'create.submit': 'Erstellen',
    'create.update': 'Aktualisieren',
    'create.itemDescription': 'Beschreibung der Position',

    // History
    'history.title': 'Verlauf',
    'history.all': 'Alle',
    'history.searchPlaceholder': 'Suche nach Nummer, Kunde...',
    'history.deleteConfirm': 'Diesen Eintrag l\\u00f6schen?',
    'history.noItems': 'Keine Eintr\\u00e4ge gefunden',

    // Clients
    'clients.title': 'Kunden',
    'clients.addClient': 'Kunde hinzuf\\u00fcgen',
    'clients.editClient': 'Kunde bearbeiten',
    'clients.searchPlaceholder': 'Kunden suchen...',
    'clients.noClients': 'Noch keine Kunden',
    'clients.totalBilled': 'Gesamt berechnet',
    'clients.totalPaid': 'Gesamt bezahlt',
    'clients.invoices': 'Rechnungen',

    // Reports
    'reports.title': 'Berichte',
    'reports.totalBilled': 'Gesamt berechnet',
    'reports.collected': 'Eingegangen',
    'reports.unpaid': 'Unbezahlt',
    'reports.totalTax': 'Steuer gesamt',
    'reports.income': 'Einnahmen',
    'reports.byClient': 'Nach Kunde',
    'reports.monthlyBreakdown': 'Monatliche Aufschl\\u00fcsselung',
    'reports.taxSummary': 'Steuer\\u00fcbersicht',
    'reports.revenueByClient': 'Umsatz nach Kunde',
    'reports.noData': 'Keine Daten f\\u00fcr diesen Zeitraum',
    'reports.ofTotal': 'vom Gesamt',
    'reports.billed': 'Berechnet',

    // Settings
    'settings.title': 'Einstellungen',
    'settings.business': 'Unternehmen',
    'settings.invoiceDefaults': 'Rechnungsstandards',
    'settings.payment': 'Zahlung',
    'settings.businessName': 'Unternehmensname',
    'settings.logo': 'Logo',
    'settings.uploadLogo': 'Logo hochladen',
    'settings.taxId': 'Steuernummer',
    'settings.invoicePrefix': 'Rechnungspr\\u00e4fix',
    'settings.defaultTaxRate': 'Standard-Steuersatz',
    'settings.taxLabel': 'Steuerbezeichnung',

    // Legal
    'legal.privacyPolicy': 'Datenschutzerkl\\u00e4rung',
    'legal.termsOfService': 'Nutzungsbedingungen',
    'legal.aboutUs': '\\u00dcber uns',
    'legal.faq': 'FAQ',
    'legal.editor': 'Rechtstexte bearbeiten',
    'legal.editorSubtitle': 'Datenschutz, AGB, \\u00dcber uns und FAQ bearbeiten',
    'legal.placeholdersNeedData': 'Platzhalter ben\\u00f6tigen Ihre Daten',
    'legal.typeAndEnter': 'Wert eingeben und Enter dr\\u00fccken, um alle Vorkommen zu ersetzen.',

    // Landing
    'landing.features': 'Funktionen',
    'landing.howItWorks': 'So funktioniert es',
    'landing.pricing': 'Preise',
    'landing.getStartedFree': 'Kostenlos starten',
    'landing.seeHowItWorks': 'So funktioniert es',
    'landing.startFreeTrial': 'Kostenlos testen',
    'landing.mostPopular': 'Am beliebtesten',
    'landing.free': 'Kostenlos',
    'landing.perMonth': '/Monat',
    'landing.readyToStart': 'Bereit loszulegen?',
    'landing.joinUsers': 'Hunderte Nutzer sparen bereits Zeit.',
    'landing.threeSteps': 'Drei einfache Schritte',
    'landing.startFree': 'Kostenlos starten, sp\\u00e4ter upgraden',
    'landing.noCreditCard': 'Keine Kreditkarte erforderlich. Jederzeit k\\u00fcndbar.',
    'landing.activeUsers': 'Aktive Nutzer',
    'landing.rating': 'Bewertung',
    'landing.fasterResults': 'Schnellere Ergebnisse',
    'landing.sectionProblem': 'DAS PROBLEM',
    'landing.soundFamiliar': 'Kommt Ihnen das bekannt vor?',
    'landing.sectionFeatures': 'FUNKTIONEN',
    'landing.builtToSolve': 'Entwickelt um echte Probleme zu l\\u00f6sen',
    'landing.everythingYouNeed': 'Alles was Sie brauchen',
    'landing.everyFeature': 'Jede Funktion l\\u00f6st ein echtes Problem.',
    'landing.powerfulTools': 'Leistungsstarke Tools f\\u00fcr Geschwindigkeit und Einfachheit.',
    'landing.sectionHowItWorks': 'SO FUNKTIONIERT ES',
    'landing.fromStartToFinish': 'Von Anfang bis Ende in Minuten',
    'landing.sectionPricing': 'PREISE',
    'landing.createFirst': 'Erstellen Sie Ihr erstes',

    // Create page form labels
    'create.businessName': 'Firmenname',
    'create.clientName': 'Kundenname',
    'create.clientEmail': 'Kunden-E-Mail',
    'create.clientAddress': 'Kundenadresse',
    'create.saveDefault': 'Als Standard speichern',
    'create.saved': 'Gespeichert',
    'create.notesPlaceholder': 'Zahlungsanweisungen, Dankesbotschaft oder zus\\u00e4tzliche Bedingungen...',
    'create.taxAmount': 'Steuerbetrag',
    'create.items': 'Positionen',

    // Payment terms
    'payment.dueOnReceipt': 'Bei Erhalt f\\u00e4llig',
    'payment.net15': 'Netto 15',
    'payment.net30': 'Netto 30',
    'payment.net60': 'Netto 60',

    // Stripe / Payment settings
    'settings.stripeConfig': 'Stripe-Konfiguration',
    'settings.stripeDescription': 'Verbinden Sie Ihr Stripe-Konto, um Zahlungen von Ihren Kunden zu akzeptieren.',
    'settings.publishableKey': 'Ver\\u00f6ffentlichbarer Schl\\u00fcssel',
    'settings.secretKey': 'Geheimer Schl\\u00fcssel',
    'settings.stripeConnected': 'Verbunden',
    'settings.stripeNotConnected': 'Nicht verbunden',
    'settings.stripeInstructions': 'Holen Sie sich Ihre API-Schl\\u00fcssel vom',
    'settings.stripeDashboard': 'Stripe Dashboard',
    'settings.testConnection': 'Verbindung testen',
    'settings.stripeTestSuccess': 'Verbindung erfolgreich!',
    'settings.stripeTestFailed': 'Verbindung fehlgeschlagen. Bitte \\u00fcberpr\\u00fcfen Sie Ihre Schl\\u00fcssel.',
    'settings.paymentInstructions': 'Zahlungsanweisungen',
    'settings.paymentInstructionsHint': 'Diese Anweisungen erscheinen am Ende Ihrer Rechnungen und PDF-Exporte.',
    'settings.account': 'Konto',
    'settings.logoHint': 'PNG oder JPG, max 500KB. Erscheint auf Rechnungen und PDF.',
    'settings.defaultValues': 'Standardwerte',
    'settings.invoiceNumberPrefix': 'Rechnungsnummern-Pr\\u00e4fix',
    'settings.defaultNotes': 'Standardnotizen',
    'settings.defaultNotesHint': 'Dies erscheint standardm\\u00e4\\u00dfig auf jeder neuen Rechnung.',

    // Periods
    'period.7d': '7 Tage',
    'period.30d': '30 Tage',
    'period.90d': '90 Tage',
    'period.12m': '12 Monate',
    'period.all': 'Gesamter Zeitraum',
  },

  ru: {
    // Navigation
    'nav.dashboard': '\\u041f\\u0430\\u043d\\u0435\\u043b\\u044c',
    'nav.createNew': '\\u0421\\u043e\\u0437\\u0434\\u0430\\u0442\\u044c',
    'nav.history': '\\u0418\\u0441\\u0442\\u043e\\u0440\\u0438\\u044f',
    'nav.clients': '\\u041a\\u043b\\u0438\\u0435\\u043d\\u0442\\u044b',
    'nav.reports': '\\u041e\\u0442\\u0447\\u0451\\u0442\\u044b',
    'nav.settings': '\\u041d\\u0430\\u0441\\u0442\\u0440\\u043e\\u0439\\u043a\\u0438',
    'nav.legalPages': '\\u042e\\u0440\\u0438\\u0434\\u0438\\u0447\\u0435\\u0441\\u043a\\u043e\\u0435',
    'nav.billing': '\\u041e\\u043f\\u043b\\u0430\\u0442\\u0430',
    'nav.signIn': '\\u0412\\u043e\\u0439\\u0442\\u0438',
    'nav.signOut': '\\u0412\\u044b\\u0439\\u0442\\u0438',
    'nav.getStarted': '\\u041d\\u0430\\u0447\\u0430\\u0442\\u044c',
    'nav.backToHome': '\\u041d\\u0430 \\u0433\\u043b\\u0430\\u0432\\u043d\\u0443\\u044e',

    // Common actions
    'action.save': '\\u0421\\u043e\\u0445\\u0440\\u0430\\u043d\\u0438\\u0442\\u044c',
    'action.saveAll': '\\u0421\\u043e\\u0445\\u0440\\u0430\\u043d\\u0438\\u0442\\u044c \\u0432\\u0441\\u0451',
    'action.cancel': '\\u041e\\u0442\\u043c\\u0435\\u043d\\u0430',
    'action.delete': '\\u0423\\u0434\\u0430\\u043b\\u0438\\u0442\\u044c',
    'action.edit': '\\u0420\\u0435\\u0434\\u0430\\u043a\\u0442\\u0438\\u0440\\u043e\\u0432\\u0430\\u0442\\u044c',
    'action.create': '\\u0421\\u043e\\u0437\\u0434\\u0430\\u0442\\u044c',
    'action.send': '\\u041e\\u0442\\u043f\\u0440\\u0430\\u0432\\u0438\\u0442\\u044c',
    'action.download': '\\u0421\\u043a\\u0430\\u0447\\u0430\\u0442\\u044c',
    'action.export': '\\u042d\\u043a\\u0441\\u043f\\u043e\\u0440\\u0442',
    'action.import': '\\u0418\\u043c\\u043f\\u043e\\u0440\\u0442',
    'action.search': '\\u041f\\u043e\\u0438\\u0441\\u043a...',
    'action.filter': '\\u0424\\u0438\\u043b\\u044c\\u0442\\u0440',
    'action.back': '\\u041d\\u0430\\u0437\\u0430\\u0434',
    'action.next': '\\u0414\\u0430\\u043b\\u0435\\u0435',
    'action.preview': '\\u041f\\u0440\\u0435\\u0434\\u043f\\u0440\\u043e\\u0441\\u043c\\u043e\\u0442\\u0440',
    'action.duplicate': '\\u0414\\u0443\\u0431\\u043b\\u0438\\u0440\\u043e\\u0432\\u0430\\u0442\\u044c',
    'action.close': '\\u0417\\u0430\\u043a\\u0440\\u044b\\u0442\\u044c',
    'action.confirm': '\\u041f\\u043e\\u0434\\u0442\\u0432\\u0435\\u0440\\u0434\\u0438\\u0442\\u044c',
    'action.add': '\\u0414\\u043e\\u0431\\u0430\\u0432\\u0438\\u0442\\u044c',
    'action.remove': '\\u0423\\u0431\\u0440\\u0430\\u0442\\u044c',
    'action.upload': '\\u0417\\u0430\\u0433\\u0440\\u0443\\u0437\\u0438\\u0442\\u044c',
    'action.csv': 'CSV',
    'action.pdf': 'PDF',

    // Status
    'status.draft': '\\u0427\\u0435\\u0440\\u043d\\u043e\\u0432\\u0438\\u043a',
    'status.sent': '\\u041e\\u0442\\u043f\\u0440\\u0430\\u0432\\u043b\\u0435\\u043d\\u043e',
    'status.paid': '\\u041e\\u043f\\u043b\\u0430\\u0447\\u0435\\u043d\\u043e',
    'status.overdue': '\\u041f\\u0440\\u043e\\u0441\\u0440\\u043e\\u0447\\u0435\\u043d\\u043e',
    'status.cancelled': '\\u041e\\u0442\\u043c\\u0435\\u043d\\u0435\\u043d\\u043e',
    'status.partial': '\\u0427\\u0430\\u0441\\u0442\\u0438\\u0447\\u043d\\u043e',
    'status.pending': '\\u041e\\u0436\\u0438\\u0434\\u0430\\u043d\\u0438\\u0435',
    'status.active': '\\u0410\\u043a\\u0442\\u0438\\u0432\\u043d\\u043e',
    'status.completed': '\\u0417\\u0430\\u0432\\u0435\\u0440\\u0448\\u0435\\u043d\\u043e',

    // Common labels
    'label.email': 'Email',
    'label.password': '\\u041f\\u0430\\u0440\\u043e\\u043b\\u044c',
    'label.name': '\\u0418\\u043c\\u044f',
    'label.phone': '\\u0422\\u0435\\u043b\\u0435\\u0444\\u043e\\u043d',
    'label.address': '\\u0410\\u0434\\u0440\\u0435\\u0441',
    'label.company': '\\u041a\\u043e\\u043c\\u043f\\u0430\\u043d\\u0438\\u044f',
    'label.website': '\\u0421\\u0430\\u0439\\u0442',
    'label.date': '\\u0414\\u0430\\u0442\\u0430',
    'label.amount': '\\u0421\\u0443\\u043c\\u043c\\u0430',
    'label.total': '\\u0418\\u0442\\u043e\\u0433\\u043e',
    'label.subtotal': '\\u041f\\u043e\\u0434\\u0438\\u0442\\u043e\\u0433',
    'label.tax': '\\u041d\\u0430\\u043b\\u043e\\u0433',
    'label.notes': '\\u041f\\u0440\\u0438\\u043c\\u0435\\u0447\\u0430\\u043d\\u0438\\u044f',
    'label.description': '\\u041e\\u043f\\u0438\\u0441\\u0430\\u043d\\u0438\\u0435',
    'label.quantity': '\\u041a\\u043e\\u043b-\\u0432\\u043e',
    'label.rate': '\\u0426\\u0435\\u043d\\u0430',
    'label.number': '\\u041d\\u043e\\u043c\\u0435\\u0440',
    'label.currency': '\\u0412\\u0430\\u043b\\u044e\\u0442\\u0430',
    'label.status': '\\u0421\\u0442\\u0430\\u0442\\u0443\\u0441',
    'label.client': '\\u041a\\u043b\\u0438\\u0435\\u043d\\u0442',
    'label.from': '\\u041e\\u0442',
    'label.to': '\\u041a\\u043e\\u043c\\u0443',
    'label.dueDate': '\\u0421\\u0440\\u043e\\u043a \\u043e\\u043f\\u043b\\u0430\\u0442\\u044b',
    'label.issueDate': '\\u0414\\u0430\\u0442\\u0430 \\u0432\\u044b\\u0441\\u0442\\u0430\\u0432\\u043b\\u0435\\u043d\\u0438\\u044f',

    // Common messages
    'msg.loading': '\\u0417\\u0430\\u0433\\u0440\\u0443\\u0437\\u043a\\u0430...',
    'msg.noResults': '\\u041d\\u0438\\u0447\\u0435\\u0433\\u043e \\u043d\\u0435 \\u043d\\u0430\\u0439\\u0434\\u0435\\u043d\\u043e',
    'msg.noData': '\\u041d\\u0435\\u0442 \\u0434\\u0430\\u043d\\u043d\\u044b\\u0445',
    'msg.saved': '\\u0421\\u043e\\u0445\\u0440\\u0430\\u043d\\u0435\\u043d\\u043e!',
    'msg.deleted': '\\u0423\\u0434\\u0430\\u043b\\u0435\\u043d\\u043e',
    'msg.error': '\\u0427\\u0442\\u043e-\\u0442\\u043e \\u043f\\u043e\\u0448\\u043b\\u043e \\u043d\\u0435 \\u0442\\u0430\\u043a',
    'msg.success': '\\u0423\\u0441\\u043f\\u0435\\u0448\\u043d\\u043e',
    'msg.confirmDelete': '\\u0412\\u044b \\u0443\\u0432\\u0435\\u0440\\u0435\\u043d\\u044b, \\u0447\\u0442\\u043e \\u0445\\u043e\\u0442\\u0438\\u0442\\u0435 \\u0443\\u0434\\u0430\\u043b\\u0438\\u0442\\u044c?',
    'msg.processing': '\\u041e\\u0431\\u0440\\u0430\\u0431\\u043e\\u0442\\u043a\\u0430...',

    // Dashboard
    'dashboard.title': '\\u041f\\u0430\\u043d\\u0435\\u043b\\u044c \\u0443\\u043f\\u0440\\u0430\\u0432\\u043b\\u0435\\u043d\\u0438\\u044f',
    'dashboard.revenue': '\\u0414\\u043e\\u0445\\u043e\\u0434',
    'dashboard.revenueThisMonth': '\\u0414\\u043e\\u0445\\u043e\\u0434 \\u0437\\u0430 \\u043c\\u0435\\u0441\\u044f\\u0446',
    'dashboard.outstanding': '\\u041e\\u0436\\u0438\\u0434\\u0430\\u0435\\u0442 \\u043e\\u043f\\u043b\\u0430\\u0442\\u044b',
    'dashboard.totalItems': '\\u0412\\u0441\\u0435\\u0433\\u043e',
    'dashboard.totalClients': '\\u0412\\u0441\\u0435\\u0433\\u043e \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442\\u043e\\u0432',
    'dashboard.recentItems': '\\u041f\\u043e\\u0441\\u043b\\u0435\\u0434\\u043d\\u0438\\u0435',
    'dashboard.quickActions': '\\u0411\\u044b\\u0441\\u0442\\u0440\\u044b\\u0435 \\u0434\\u0435\\u0439\\u0441\\u0442\\u0432\\u0438\\u044f',
    'dashboard.overdue': '\\u041f\\u0440\\u043e\\u0441\\u0440\\u043e\\u0447\\u0435\\u043d\\u043e',
    'dashboard.newItem': '\\u0421\\u043e\\u0437\\u0434\\u0430\\u0442\\u044c',
    'dashboard.viewAll': '\\u041f\\u043e\\u043a\\u0430\\u0437\\u0430\\u0442\\u044c \\u0432\\u0441\\u0435',
    'dashboard.last30Days': '\\u041f\\u043e\\u0441\\u043b\\u0435\\u0434\\u043d\\u0438\\u0435 30 \\u0434\\u043d\\u0435\\u0439',
    'dashboard.noItems': '\\u041f\\u043e\\u043a\\u0430 \\u043d\\u0438\\u0447\\u0435\\u0433\\u043e \\u043d\\u0435\\u0442. \\u0421\\u043e\\u0437\\u0434\\u0430\\u0439\\u0442\\u0435 \\u043f\\u0435\\u0440\\u0432\\u044b\\u0439!',

    // Create / Form
    'create.title': '\\u0421\\u043e\\u0437\\u0434\\u0430\\u0442\\u044c',
    'create.editTitle': '\\u0420\\u0435\\u0434\\u0430\\u043a\\u0442\\u0438\\u0440\\u043e\\u0432\\u0430\\u0442\\u044c',
    'create.from': '\\u041e\\u0442 (\\u0412\\u0430\\u0448 \\u0431\\u0438\\u0437\\u043d\\u0435\\u0441)',
    'create.to': '\\u041a\\u043e\\u043c\\u0443 (\\u041f\\u043e\\u043b\\u0443\\u0447\\u0430\\u0442\\u0435\\u043b\\u044c)',
    'create.details': '\\u0414\\u0435\\u0442\\u0430\\u043b\\u0438',
    'create.lineItems': '\\u041f\\u043e\\u0437\\u0438\\u0446\\u0438\\u0438',
    'create.addItem': '\\u0414\\u043e\\u0431\\u0430\\u0432\\u0438\\u0442\\u044c \\u043f\\u043e\\u0437\\u0438\\u0446\\u0438\\u044e',
    'create.paymentTerms': '\\u0423\\u0441\\u043b\\u043e\\u0432\\u0438\\u044f \\u043e\\u043f\\u043b\\u0430\\u0442\\u044b',
    'create.taxRate': '\\u0421\\u0442\\u0430\\u0432\\u043a\\u0430 \\u043d\\u0430\\u043b\\u043e\\u0433\\u0430',
    'create.submit': '\\u0421\\u043e\\u0437\\u0434\\u0430\\u0442\\u044c',
    'create.update': '\\u041e\\u0431\\u043d\\u043e\\u0432\\u0438\\u0442\\u044c',
    'create.itemDescription': '\\u041e\\u043f\\u0438\\u0441\\u0430\\u043d\\u0438\\u0435 \\u043f\\u043e\\u0437\\u0438\\u0446\\u0438\\u0438',

    // History
    'history.title': '\\u0418\\u0441\\u0442\\u043e\\u0440\\u0438\\u044f',
    'history.all': '\\u0412\\u0441\\u0435',
    'history.searchPlaceholder': '\\u041f\\u043e\\u0438\\u0441\\u043a \\u043f\\u043e \\u043d\\u043e\\u043c\\u0435\\u0440\\u0443, \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442\\u0443...',
    'history.deleteConfirm': '\\u0423\\u0434\\u0430\\u043b\\u0438\\u0442\\u044c \\u044d\\u0442\\u043e\\u0442 \\u044d\\u043b\\u0435\\u043c\\u0435\\u043d\\u0442?',
    'history.noItems': '\\u041d\\u0438\\u0447\\u0435\\u0433\\u043e \\u043d\\u0435 \\u043d\\u0430\\u0439\\u0434\\u0435\\u043d\\u043e',

    // Clients
    'clients.title': '\\u041a\\u043b\\u0438\\u0435\\u043d\\u0442\\u044b',
    'clients.addClient': '\\u0414\\u043e\\u0431\\u0430\\u0432\\u0438\\u0442\\u044c \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442\\u0430',
    'clients.editClient': '\\u0420\\u0435\\u0434\\u0430\\u043a\\u0442\\u0438\\u0440\\u043e\\u0432\\u0430\\u0442\\u044c \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442\\u0430',
    'clients.searchPlaceholder': '\\u041f\\u043e\\u0438\\u0441\\u043a \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442\\u043e\\u0432...',
    'clients.noClients': '\\u041a\\u043b\\u0438\\u0435\\u043d\\u0442\\u043e\\u0432 \\u043f\\u043e\\u043a\\u0430 \\u043d\\u0435\\u0442',
    'clients.totalBilled': '\\u0412\\u044b\\u0441\\u0442\\u0430\\u0432\\u043b\\u0435\\u043d\\u043e',
    'clients.totalPaid': '\\u041e\\u043f\\u043b\\u0430\\u0447\\u0435\\u043d\\u043e',
    'clients.invoices': '\\u0441\\u0447\\u0435\\u0442\\u043e\\u0432',

    // Reports
    'reports.title': '\\u041e\\u0442\\u0447\\u0451\\u0442\\u044b',
    'reports.totalBilled': '\\u0412\\u044b\\u0441\\u0442\\u0430\\u0432\\u043b\\u0435\\u043d\\u043e',
    'reports.collected': '\\u041f\\u043e\\u043b\\u0443\\u0447\\u0435\\u043d\\u043e',
    'reports.unpaid': '\\u041d\\u0435 \\u043e\\u043f\\u043b\\u0430\\u0447\\u0435\\u043d\\u043e',
    'reports.totalTax': '\\u041d\\u0430\\u043b\\u043e\\u0433 \\u0438\\u0442\\u043e\\u0433\\u043e',
    'reports.income': '\\u0414\\u043e\\u0445\\u043e\\u0434',
    'reports.byClient': '\\u041f\\u043e \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442\\u0430\\u043c',
    'reports.monthlyBreakdown': '\\u041f\\u043e \\u043c\\u0435\\u0441\\u044f\\u0446\\u0430\\u043c',
    'reports.taxSummary': '\\u041d\\u0430\\u043b\\u043e\\u0433\\u043e\\u0432\\u044b\\u0439 \\u043e\\u0442\\u0447\\u0451\\u0442',
    'reports.revenueByClient': '\\u0414\\u043e\\u0445\\u043e\\u0434 \\u043f\\u043e \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442\\u0430\\u043c',
    'reports.noData': '\\u041d\\u0435\\u0442 \\u0434\\u0430\\u043d\\u043d\\u044b\\u0445 \\u0437\\u0430 \\u044d\\u0442\\u043e\\u0442 \\u043f\\u0435\\u0440\\u0438\\u043e\\u0434',
    'reports.ofTotal': '\\u043e\\u0442 \\u043e\\u0431\\u0449\\u0435\\u0433\\u043e',
    'reports.billed': '\\u0412\\u044b\\u0441\\u0442\\u0430\\u0432\\u043b\\u0435\\u043d\\u043e',

    // Settings
    'settings.title': '\\u041d\\u0430\\u0441\\u0442\\u0440\\u043e\\u0439\\u043a\\u0438',
    'settings.business': '\\u0411\\u0438\\u0437\\u043d\\u0435\\u0441',
    'settings.invoiceDefaults': '\\u0421\\u0442\\u0430\\u043d\\u0434\\u0430\\u0440\\u0442\\u044b \\u0441\\u0447\\u0435\\u0442\\u043e\\u0432',
    'settings.payment': '\\u041e\\u043f\\u043b\\u0430\\u0442\\u0430',
    'settings.businessName': '\\u041d\\u0430\\u0437\\u0432\\u0430\\u043d\\u0438\\u0435 \\u043a\\u043e\\u043c\\u043f\\u0430\\u043d\\u0438\\u0438',
    'settings.logo': '\\u041b\\u043e\\u0433\\u043e\\u0442\\u0438\\u043f',
    'settings.uploadLogo': '\\u0417\\u0430\\u0433\\u0440\\u0443\\u0437\\u0438\\u0442\\u044c \\u043b\\u043e\\u0433\\u043e',
    'settings.taxId': '\\u0418\\u041d\\u041d',
    'settings.invoicePrefix': '\\u041f\\u0440\\u0435\\u0444\\u0438\\u043a\\u0441 \\u0441\\u0447\\u0451\\u0442\\u0430',
    'settings.defaultTaxRate': '\\u0421\\u0442\\u0430\\u0432\\u043a\\u0430 \\u043d\\u0430\\u043b\\u043e\\u0433\\u0430',
    'settings.taxLabel': '\\u041d\\u0430\\u0437\\u0432\\u0430\\u043d\\u0438\\u0435 \\u043d\\u0430\\u043b\\u043e\\u0433\\u0430',

    // Legal
    'legal.privacyPolicy': '\\u041f\\u043e\\u043b\\u0438\\u0442\\u0438\\u043a\\u0430 \\u043a\\u043e\\u043d\\u0444\\u0438\\u0434\\u0435\\u043d\\u0446\\u0438\\u0430\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438',
    'legal.termsOfService': '\\u0423\\u0441\\u043b\\u043e\\u0432\\u0438\\u044f \\u0438\\u0441\\u043f\\u043e\\u043b\\u044c\\u0437\\u043e\\u0432\\u0430\\u043d\\u0438\\u044f',
    'legal.aboutUs': '\\u041e \\u043d\\u0430\\u0441',
    'legal.faq': '\\u0427\\u0430\\u0412\\u043e',
    'legal.editor': '\\u0420\\u0435\\u0434\\u0430\\u043a\\u0442\\u043e\\u0440 \\u044e\\u0440. \\u0441\\u0442\\u0440\\u0430\\u043d\\u0438\\u0446',
    'legal.editorSubtitle': '\\u0420\\u0435\\u0434\\u0430\\u043a\\u0442\\u0438\\u0440\\u043e\\u0432\\u0430\\u043d\\u0438\\u0435 \\u043f\\u043e\\u043b\\u0438\\u0442\\u0438\\u043a\\u0438, \\u0443\\u0441\\u043b\\u043e\\u0432\\u0438\\u0439, FAQ',
    'legal.placeholdersNeedData': '\\u043f\\u043e\\u043b\\u0435\\u0439 \\u0442\\u0440\\u0435\\u0431\\u0443\\u044e\\u0442 \\u0432\\u0430\\u0448\\u0438\\u0445 \\u0434\\u0430\\u043d\\u043d\\u044b\\u0445',
    'legal.typeAndEnter': '\\u0412\\u0432\\u0435\\u0434\\u0438\\u0442\\u0435 \\u0437\\u043d\\u0430\\u0447\\u0435\\u043d\\u0438\\u0435 \\u0438 \\u043d\\u0430\\u0436\\u043c\\u0438\\u0442\\u0435 Enter \\u0434\\u043b\\u044f \\u0437\\u0430\\u043c\\u0435\\u043d\\u044b.',

    // Landing
    'landing.features': '\\u0424\\u0443\\u043d\\u043a\\u0446\\u0438\\u0438',
    'landing.howItWorks': '\\u041a\\u0430\\u043a \\u044d\\u0442\\u043e \\u0440\\u0430\\u0431\\u043e\\u0442\\u0430\\u0435\\u0442',
    'landing.pricing': '\\u0426\\u0435\\u043d\\u044b',
    'landing.getStartedFree': '\\u041d\\u0430\\u0447\\u0430\\u0442\\u044c \\u0431\\u0435\\u0441\\u043f\\u043b\\u0430\\u0442\\u043d\\u043e',
    'landing.seeHowItWorks': '\\u041a\\u0430\\u043a \\u044d\\u0442\\u043e \\u0440\\u0430\\u0431\\u043e\\u0442\\u0430\\u0435\\u0442',
    'landing.startFreeTrial': '\\u041f\\u043e\\u043f\\u0440\\u043e\\u0431\\u043e\\u0432\\u0430\\u0442\\u044c \\u0431\\u0435\\u0441\\u043f\\u043b\\u0430\\u0442\\u043d\\u043e',
    'landing.mostPopular': '\\u041f\\u043e\\u043f\\u0443\\u043b\\u044f\\u0440\\u043d\\u044b\\u0439',
    'landing.free': '\\u0411\\u0435\\u0441\\u043f\\u043b\\u0430\\u0442\\u043d\\u043e',
    'landing.perMonth': '/\\u043c\\u0435\\u0441.',
    'landing.readyToStart': '\\u0413\\u043e\\u0442\\u043e\\u0432\\u044b \\u043d\\u0430\\u0447\\u0430\\u0442\\u044c?',
    'landing.joinUsers': '\\u0421\\u043e\\u0442\\u043d\\u0438 \\u043f\\u043e\\u043b\\u044c\\u0437\\u043e\\u0432\\u0430\\u0442\\u0435\\u043b\\u0435\\u0439 \\u0443\\u0436\\u0435 \\u044d\\u043a\\u043e\\u043d\\u043e\\u043c\\u044f\\u0442 \\u0432\\u0440\\u0435\\u043c\\u044f.',
    'landing.threeSteps': '\\u0422\\u0440\\u0438 \\u043f\\u0440\\u043e\\u0441\\u0442\\u044b\\u0445 \\u0448\\u0430\\u0433\\u0430',
    'landing.startFree': '\\u041d\\u0430\\u0447\\u043d\\u0438\\u0442\\u0435 \\u0431\\u0435\\u0441\\u043f\\u043b\\u0430\\u0442\\u043d\\u043e, \\u043e\\u0431\\u043d\\u043e\\u0432\\u0438\\u0442\\u0435 \\u043f\\u043e\\u0437\\u0436\\u0435',
    'landing.noCreditCard': '\\u0411\\u0435\\u0437 \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043d\\u043e\\u0439 \\u043a\\u0430\\u0440\\u0442\\u044b. \\u041e\\u0442\\u043c\\u0435\\u043d\\u0430 \\u0432 \\u043b\\u044e\\u0431\\u043e\\u0435 \\u0432\\u0440\\u0435\\u043c\\u044f.',
    'landing.activeUsers': '\\u0410\\u043a\\u0442\\u0438\\u0432\\u043d\\u044b\\u0445 \\u043f\\u043e\\u043b\\u044c\\u0437\\u043e\\u0432\\u0430\\u0442\\u0435\\u043b\\u0435\\u0439',
    'landing.rating': '\\u0420\\u0435\\u0439\\u0442\\u0438\\u043d\\u0433',
    'landing.fasterResults': '\\u0411\\u044b\\u0441\\u0442\\u0440\\u0435\\u0435 \\u0440\\u0435\\u0437\\u0443\\u043b\\u044c\\u0442\\u0430\\u0442',
    'landing.sectionProblem': '\\u041f\\u0420\\u041e\\u0411\\u041b\\u0415\\u041c\\u0410',
    'landing.soundFamiliar': '\\u0417\\u043d\\u0430\\u043a\\u043e\\u043c\\u043e?',
    'landing.sectionFeatures': '\\u0424\\u0423\\u041d\\u041a\\u0426\\u0418\\u0418',
    'landing.builtToSolve': '\\u0421\\u043e\\u0437\\u0434\\u0430\\u043d\\u043e \\u0434\\u043b\\u044f \\u0440\\u0435\\u0448\\u0435\\u043d\\u0438\\u044f \\u0440\\u0435\\u0430\\u043b\\u044c\\u043d\\u044b\\u0445 \\u043f\\u0440\\u043e\\u0431\\u043b\\u0435\\u043c',
    'landing.everythingYouNeed': '\\u0412\\u0441\\u0451 \\u0447\\u0442\\u043e \\u0432\\u0430\\u043c \\u043d\\u0443\\u0436\\u043d\\u043e',
    'landing.everyFeature': '\\u041a\\u0430\\u0436\\u0434\\u0430\\u044f \\u0444\\u0443\\u043d\\u043a\\u0446\\u0438\\u044f \\u0440\\u0435\\u0448\\u0430\\u0435\\u0442 \\u0440\\u0435\\u0430\\u043b\\u044c\\u043d\\u0443\\u044e \\u043f\\u0440\\u043e\\u0431\\u043b\\u0435\\u043c\\u0443.',
    'landing.powerfulTools': '\\u041c\\u043e\\u0449\\u043d\\u044b\\u0435 \\u0438\\u043d\\u0441\\u0442\\u0440\\u0443\\u043c\\u0435\\u043d\\u0442\\u044b \\u0434\\u043b\\u044f \\u0441\\u043a\\u043e\\u0440\\u043e\\u0441\\u0442\\u0438 \\u0438 \\u043f\\u0440\\u043e\\u0441\\u0442\\u043e\\u0442\\u044b.',
    'landing.sectionHowItWorks': '\\u041a\\u0410\\u041a \\u042d\\u0422\\u041e \\u0420\\u0410\\u0411\\u041e\\u0422\\u0410\\u0415\\u0422',
    'landing.fromStartToFinish': '\\u041e\\u0442 \\u043d\\u0430\\u0447\\u0430\\u043b\\u0430 \\u0434\\u043e \\u043a\\u043e\\u043d\\u0446\\u0430 \\u0437\\u0430 \\u043c\\u0438\\u043d\\u0443\\u0442\\u044b',
    'landing.sectionPricing': '\\u0426\\u0415\\u041d\\u042b',
    'landing.createFirst': '\\u0421\\u043e\\u0437\\u0434\\u0430\\u0439\\u0442\\u0435 \\u0441\\u0432\\u043e\\u0439 \\u043f\\u0435\\u0440\\u0432\\u044b\\u0439',

    // Create page form labels
    'create.businessName': '\\u041d\\u0430\\u0437\\u0432\\u0430\\u043d\\u0438\\u0435 \\u043a\\u043e\\u043c\\u043f\\u0430\\u043d\\u0438\\u0438',
    'create.clientName': '\\u0418\\u043c\\u044f \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442\\u0430',
    'create.clientEmail': 'Email \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442\\u0430',
    'create.clientAddress': '\\u0410\\u0434\\u0440\\u0435\\u0441 \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442\\u0430',
    'create.saveDefault': '\\u0421\\u043e\\u0445\\u0440\\u0430\\u043d\\u0438\\u0442\\u044c \\u043a\\u0430\\u043a \\u0448\\u0430\\u0431\\u043b\\u043e\\u043d',
    'create.saved': '\\u0421\\u043e\\u0445\\u0440\\u0430\\u043d\\u0435\\u043d\\u043e',
    'create.notesPlaceholder': '\\u0420\\u0435\\u043a\\u0432\\u0438\\u0437\\u0438\\u0442\\u044b, \\u0431\\u043b\\u0430\\u0433\\u043e\\u0434\\u0430\\u0440\\u043d\\u043e\\u0441\\u0442\\u044c \\u0438\\u043b\\u0438 \\u0434\\u043e\\u043f. \\u0443\\u0441\\u043b\\u043e\\u0432\\u0438\\u044f...',
    'create.taxAmount': '\\u0421\\u0443\\u043c\\u043c\\u0430 \\u043d\\u0430\\u043b\\u043e\\u0433\\u0430',
    'create.items': '\\u041f\\u043e\\u0437\\u0438\\u0446\\u0438\\u0438',

    // Payment terms
    'payment.dueOnReceipt': '\\u041f\\u0440\\u0438 \\u043f\\u043e\\u043b\\u0443\\u0447\\u0435\\u043d\\u0438\\u0438',
    'payment.net15': '15 \\u0434\\u043d\\u0435\\u0439',
    'payment.net30': '30 \\u0434\\u043d\\u0435\\u0439',
    'payment.net60': '60 \\u0434\\u043d\\u0435\\u0439',

    // Stripe / Payment settings
    'settings.stripeConfig': '\\u041d\\u0430\\u0441\\u0442\\u0440\\u043e\\u0439\\u043a\\u0430 Stripe',
    'settings.stripeDescription': '\\u041f\\u043e\\u0434\\u043a\\u043b\\u044e\\u0447\\u0438\\u0442\\u0435 \\u0430\\u043a\\u043a\\u0430\\u0443\\u043d\\u0442 Stripe \\u0434\\u043b\\u044f \\u043f\\u0440\\u0438\\u0451\\u043c\\u0430 \\u043e\\u043f\\u043b\\u0430\\u0442 \\u043e\\u0442 \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442\\u043e\\u0432.',
    'settings.publishableKey': '\\u041f\\u0443\\u0431\\u043b\\u0438\\u0447\\u043d\\u044b\\u0439 \\u043a\\u043b\\u044e\\u0447',
    'settings.secretKey': '\\u0421\\u0435\\u043a\\u0440\\u0435\\u0442\\u043d\\u044b\\u0439 \\u043a\\u043b\\u044e\\u0447',
    'settings.stripeConnected': '\\u041f\\u043e\\u0434\\u043a\\u043b\\u044e\\u0447\\u0435\\u043d\\u043e',
    'settings.stripeNotConnected': '\\u041d\\u0435 \\u043f\\u043e\\u0434\\u043a\\u043b\\u044e\\u0447\\u0435\\u043d\\u043e',
    'settings.stripeInstructions': '\\u041f\\u043e\\u043b\\u0443\\u0447\\u0438\\u0442\\u0435 API-\\u043a\\u043b\\u044e\\u0447\\u0438 \\u0432',
    'settings.stripeDashboard': '\\u041f\\u0430\\u043d\\u0435\\u043b\\u044c Stripe',
    'settings.testConnection': '\\u041f\\u0440\\u043e\\u0432\\u0435\\u0440\\u0438\\u0442\\u044c \\u043f\\u043e\\u0434\\u043a\\u043b\\u044e\\u0447\\u0435\\u043d\\u0438\\u0435',
    'settings.stripeTestSuccess': '\\u041f\\u043e\\u0434\\u043a\\u043b\\u044e\\u0447\\u0435\\u043d\\u0438\\u0435 \\u0443\\u0441\\u043f\\u0435\\u0448\\u043d\\u043e!',
    'settings.stripeTestFailed': '\\u041e\\u0448\\u0438\\u0431\\u043a\\u0430 \\u043f\\u043e\\u0434\\u043a\\u043b\\u044e\\u0447\\u0435\\u043d\\u0438\\u044f. \\u041f\\u0440\\u043e\\u0432\\u0435\\u0440\\u044c\\u0442\\u0435 \\u043a\\u043b\\u044e\\u0447\\u0438.',
    'settings.paymentInstructions': '\\u0420\\u0435\\u043a\\u0432\\u0438\\u0437\\u0438\\u0442\\u044b \\u0434\\u043b\\u044f \\u043e\\u043f\\u043b\\u0430\\u0442\\u044b',
    'settings.paymentInstructionsHint': '\\u042d\\u0442\\u0438 \\u0440\\u0435\\u043a\\u0432\\u0438\\u0437\\u0438\\u0442\\u044b \\u0431\\u0443\\u0434\\u0443\\u0442 \\u043e\\u0442\\u043e\\u0431\\u0440\\u0430\\u0436\\u0430\\u0442\\u044c\\u0441\\u044f \\u0432\\u043d\\u0438\\u0437\\u0443 \\u0441\\u0447\\u0435\\u0442\\u043e\\u0432 \\u0438 PDF.',
    'settings.account': '\\u0410\\u043a\\u043a\\u0430\\u0443\\u043d\\u0442',
    'settings.logoHint': 'PNG \\u0438\\u043b\\u0438 JPG, \\u043c\\u0430\\u043a\\u0441. 500KB. \\u041e\\u0442\\u043e\\u0431\\u0440\\u0430\\u0436\\u0430\\u0435\\u0442\\u0441\\u044f \\u043d\\u0430 \\u0441\\u0447\\u0435\\u0442\\u0430\\u0445 \\u0438 PDF.',
    'settings.defaultValues': '\\u0417\\u043d\\u0430\\u0447\\u0435\\u043d\\u0438\\u044f \\u043f\\u043e \\u0443\\u043c\\u043e\\u043b\\u0447\\u0430\\u043d\\u0438\\u044e',
    'settings.invoiceNumberPrefix': '\\u041f\\u0440\\u0435\\u0444\\u0438\\u043a\\u0441 \\u043d\\u043e\\u043c\\u0435\\u0440\\u0430 \\u0441\\u0447\\u0451\\u0442\\u0430',
    'settings.defaultNotes': '\\u041f\\u0440\\u0438\\u043c\\u0435\\u0447\\u0430\\u043d\\u0438\\u044f \\u043f\\u043e \\u0443\\u043c\\u043e\\u043b\\u0447\\u0430\\u043d\\u0438\\u044e',
    'settings.defaultNotesHint': '\\u042d\\u0442\\u043e \\u0431\\u0443\\u0434\\u0435\\u0442 \\u043d\\u0430 \\u043a\\u0430\\u0436\\u0434\\u043e\\u043c \\u043d\\u043e\\u0432\\u043e\\u043c \\u0441\\u0447\\u0451\\u0442\\u0435 \\u043f\\u043e \\u0443\\u043c\\u043e\\u043b\\u0447\\u0430\\u043d\\u0438\\u044e.',

    // Periods
    'period.7d': '7 \\u0434\\u043d\\u0435\\u0439',
    'period.30d': '30 \\u0434\\u043d\\u0435\\u0439',
    'period.90d': '90 \\u0434\\u043d\\u0435\\u0439',
    'period.12m': '12 \\u043c\\u0435\\u0441\\u044f\\u0446\\u0435\\u0432',
    'period.all': '\\u0412\\u0441\\u0451 \\u0432\\u0440\\u0435\\u043c\\u044f',
  },
};

// ─── Locale display names ───

export const LOCALE_OPTIONS: { code: Locale; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '\\ud83c\\uddfa\\ud83c\\uddf8' },
  { code: 'de', name: 'Deutsch', flag: '\\ud83c\\udde9\\ud83c\\uddea' },
  { code: 'ru', name: '\\u0420\\u0443\\u0441\\u0441\\u043a\\u0438\\u0439', flag: '\\ud83c\\uddf7\\ud83c\\uddfa' },
];

// ─── Context ───

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key: string, fallback?: string) => fallback || key,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const saved = localStorage.getItem(LOCALE_KEY) as Locale | null;
    if (saved && translations[saved]) {
      setLocaleState(saved);
      document.documentElement.lang = saved;
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(LOCALE_KEY, l);
    document.documentElement.lang = l;
  }, []);

  const t = useCallback((key: string, fallback?: string): string => {
    return translations[locale]?.[key]
      || translations.en[key]
      || fallback
      || key;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(I18nContext);
  return ctx.t;
}

export function useLocale() {
  return useContext(I18nContext);
}
`,

    'src/components/LanguageSwitcher.tsx': `'use client';

import { useState, useRef, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';
import { useLocale, LOCALE_OPTIONS } from '@/lib/i18n';

export default function LanguageSwitcher({ compact }: { compact?: boolean } = {}) {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const current = LOCALE_OPTIONS.find(l => l.code === locale) || LOCALE_OPTIONS[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-all hover:bg-white/[0.06]"
        style={{ color: '${t.text70}' }}
        title="Language"
      >
        <Globe className="w-4 h-4" />
        {!compact && <span className="hidden sm:inline">{current.flag} {current.name}</span>}
        {compact && <span>{current.flag}</span>}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-40 rounded-xl border shadow-lg z-50 py-1 overflow-hidden"
          style={{ background: '${t.bg}', borderColor: '${t.primary}20', boxShadow: '${t.shadowMd}' }}
        >
          {LOCALE_OPTIONS.map(opt => (
            <button
              key={opt.code}
              onClick={() => { setLocale(opt.code); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-all hover:bg-white/[0.04]"
              style={{
                color: opt.code === locale ? '${t.primary}' : '${t.text}',
                background: opt.code === locale ? '${t.primary}08' : 'transparent',
              }}
            >
              <span>{opt.flag}</span>
              <span className="flex-1">{opt.name}</span>
              {opt.code === locale && <Check className="w-3.5 h-3.5" style={{ color: '${t.primary}' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
`,
  };
}
