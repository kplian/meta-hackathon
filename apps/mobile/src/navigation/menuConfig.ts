import { NAV_CONSTANTS } from '../i18n/constants';

export type ViewId =
  | 'dashboard'
  // Bottom Bar specific views
  | 'members'
  | 'journal'
  | 'profile'
  // ADMIN section (Drawer)
  | 'account_type'
  | 'auxiliar_type'
  | 'users'
  // FOR BUSINESS section (Drawer)
  | 'business_type'
  | 'account'
  | 'budget_type'
  | 'financial_pyramid'
  | 'template_transaction'
  // BUDGET section (Drawer & Bottom Bar)
  | 'household'
  | 'budget'
  | 'auxiliar';

export type BottomTabId = 'dashboard' | 'journal' | 'profile';

export interface DrawerMenuItem {
  id: ViewId;
  label: string;
  labelKey: string;
  iconFamily: 'ionicons' | 'mci' | 'feather';
  iconName: string;
  badgeCount?: number;
  hasDot?: boolean;
}

export interface DrawerMenuSection {
  title: string;
  titleKey: string;
  count: number;
  items: DrawerMenuItem[];
}

export const DRAWER_SECTIONS: DrawerMenuSection[] = [
  {
    title: 'ADMIN',
    titleKey: NAV_CONSTANTS.SECTION_ADMIN,
    count: 3,
    items: [
      {
        id: 'account_type',
        label: 'Account type',
        labelKey: NAV_CONSTANTS.ACCOUNT_TYPE_LABEL,
        iconFamily: 'ionicons',
        iconName: 'card-outline',
      },
      {
        id: 'auxiliar_type',
        label: 'Auxiliar type',
        labelKey: NAV_CONSTANTS.AUXILIAR_TYPE_LABEL,
        iconFamily: 'mci',
        iconName: 'shape-outline',
      },
      {
        id: 'users',
        label: 'Users',
        labelKey: NAV_CONSTANTS.USERS_LABEL,
        iconFamily: 'ionicons',
        iconName: 'people-outline',
        badgeCount: 4,
      },
    ],
  },
  {
    title: 'FOR BUSINESS',
    titleKey: NAV_CONSTANTS.SECTION_FOR_BUSINESS,
    count: 5,
    items: [
      {
        id: 'business_type',
        label: 'Business Type',
        labelKey: NAV_CONSTANTS.BUSINESS_TYPE_LABEL,
        iconFamily: 'mci',
        iconName: 'storefront-outline',
      },
      {
        id: 'account',
        label: 'Account',
        labelKey: NAV_CONSTANTS.ACCOUNT_LABEL,
        iconFamily: 'mci',
        iconName: 'bank-outline',
      },
      {
        id: 'budget_type',
        label: 'Budget Type',
        labelKey: NAV_CONSTANTS.BUDGET_TYPE_LABEL,
        iconFamily: 'ionicons',
        iconName: 'options-outline',
      },
      {
        id: 'financial_pyramid',
        label: 'Financial Pyramid',
        labelKey: NAV_CONSTANTS.FINANCIAL_PYRAMID_LABEL,
        iconFamily: 'mci',
        iconName: 'triangle-outline',
        hasDot: true,
      },
      {
        id: 'template_transaction',
        label: 'Template transaction',
        labelKey: NAV_CONSTANTS.TEMPLATE_TRANSACTION_LABEL,
        iconFamily: 'mci',
        iconName: 'file-document-edit-outline',
      },
    ],
  },
  {
    title: 'BUDGET',
    titleKey: NAV_CONSTANTS.SECTION_BUDGET,
    count: 3,
    items: [
      {
        id: 'household',
        label: 'Household',
        labelKey: NAV_CONSTANTS.HOUSEHOLD_LABEL,
        iconFamily: 'ionicons',
        iconName: 'home-outline',
      },
      {
        id: 'budget',
        label: 'Budget',
        labelKey: NAV_CONSTANTS.BUDGET_LABEL,
        iconFamily: 'ionicons',
        iconName: 'wallet-outline',
      },
      {
        id: 'auxiliar',
        label: 'Auxiliar',
        labelKey: NAV_CONSTANTS.AUXILIAR_LABEL,
        iconFamily: 'ionicons',
        iconName: 'swap-horizontal-outline',
      },
    ],
  },
];

export interface BottomTabItem {
  id: BottomTabId;
  label: string;
  labelKey: string;
  iconFamily: 'ionicons' | 'mci';
  iconName: string;
  activeIconName: string;
}

export const BOTTOM_TABS: BottomTabItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    labelKey: NAV_CONSTANTS.DASHBOARD_LABEL,
    iconFamily: 'ionicons',
    iconName: 'grid-outline',
    activeIconName: 'grid',
  },
  {
    id: 'journal',
    label: 'Journal',
    labelKey: NAV_CONSTANTS.JOURNAL_LABEL,
    iconFamily: 'ionicons',
    iconName: 'cash-outline',
    activeIconName: 'cash',
  },
  {
    id: 'profile',
    label: 'Profile',
    labelKey: NAV_CONSTANTS.PROFILE_LABEL,
    iconFamily: 'ionicons',
    iconName: 'person-outline',
    activeIconName: 'person',
  },
];

export const VIEW_META: Record<
  ViewId,
  {
    title: string;
    titleKey: string;
    subtitle: string;
    subtitleKey: string;
    category: string;
    table?:
      | 'taccount_type'
      | 'tauxiliar_type'
      | 'tuser'
      | 'tbusiness_type'
      | 'taccount'
      | 'tbudget_type'
      | 'tfinancial_pyramid'
      | 'ttemplate_transaction'
      | 'thousehold'
      | 'tbudget'
      | 'tauxiliar'
      | 'thousehold_member'
      | 'ttransaction';
  }
> = {
  dashboard: {
    title: 'Dashboard',
    titleKey: NAV_CONSTANTS.DASHBOARD_LABEL,
    subtitle: 'Resumen general de ingresos, gastos y presupuestos del hogar',
    subtitleKey: NAV_CONSTANTS.DASHBOARD_SUBTITLE,
    category: 'MAIN',
  },
  members: {
    title: 'Members',
    titleKey: NAV_CONSTANTS.MEMBERS_LABEL,
    subtitle: 'Miembros vinculados al hogar y permisos',
    subtitleKey: NAV_CONSTANTS.MEMBERS_SUBTITLE,
    category: 'BOTTOM MENU',
    table: 'thousehold_member',
  },
  budget: {
    title: 'Budget',
    titleKey: NAV_CONSTANTS.BUDGET_LABEL,
    subtitle: 'Límites mensuales asignados por categoría',
    subtitleKey: NAV_CONSTANTS.BUDGET_SUBTITLE,
    category: 'BUDGET',
    table: 'tbudget',
  },
  journal: {
    title: 'Journal',
    titleKey: NAV_CONSTANTS.JOURNAL_LABEL,
    subtitle: 'Libro diario de transacciones (ingresos y gastos)',
    subtitleKey: NAV_CONSTANTS.JOURNAL_SUBTITLE,
    category: 'BOTTOM MENU',
    table: 'ttransaction',
  },
  profile: {
    title: 'Profile',
    titleKey: NAV_CONSTANTS.PROFILE_LABEL,
    subtitle: 'Configuración de tu cuenta, canales de mensajería y preferencias',
    subtitleKey: NAV_CONSTANTS.PROFILE_SUBTITLE,
    category: 'BOTTOM MENU',
  },
  account_type: {
    title: 'Account type',
    titleKey: NAV_CONSTANTS.ACCOUNT_TYPE_LABEL,
    subtitle: 'Clasificación de cuentas contables (Activo, Pasivo, Patrimonio, Ingreso, Gasto)',
    subtitleKey: NAV_CONSTANTS.ACCOUNT_TYPE_SUBTITLE,
    category: 'ADMIN',
    table: 'taccount_type',
  },
  auxiliar_type: {
    title: 'Auxiliar type',
    titleKey: NAV_CONSTANTS.AUXILIAR_TYPE_LABEL,
    subtitle: 'Tipos de sub-cuentas auxiliares (Cliente, Proveedor, Miembro, Proyecto)',
    subtitleKey: NAV_CONSTANTS.AUXILIAR_TYPE_SUBTITLE,
    category: 'ADMIN',
    table: 'tauxiliar_type',
  },
  users: {
    title: 'Users',
    titleKey: NAV_CONSTANTS.USERS_LABEL,
    subtitle: 'Directorio de usuarios registrados en la plataforma',
    subtitleKey: NAV_CONSTANTS.USERS_SUBTITLE,
    category: 'ADMIN',
    table: 'tuser',
  },
  business_type: {
    title: 'Business Type',
    titleKey: NAV_CONSTANTS.BUSINESS_TYPE_LABEL,
    subtitle: 'Tipos de negocio o estructura familiar',
    subtitleKey: NAV_CONSTANTS.BUSINESS_TYPE_SUBTITLE,
    category: 'FOR BUSINESS',
    table: 'tbusiness_type',
  },
  account: {
    title: 'Account',
    titleKey: NAV_CONSTANTS.ACCOUNT_LABEL,
    subtitle: 'Plan de cuentas contables (Chart of Accounts)',
    subtitleKey: NAV_CONSTANTS.ACCOUNT_SUBTITLE,
    category: 'FOR BUSINESS',
    table: 'taccount',
  },
  budget_type: {
    title: 'Budget Type',
    titleKey: NAV_CONSTANTS.BUDGET_TYPE_LABEL,
    subtitle: 'Catálogo de categorías de presupuesto',
    subtitleKey: NAV_CONSTANTS.BUDGET_TYPE_SUBTITLE,
    category: 'FOR BUSINESS',
    table: 'tbudget_type',
  },
  financial_pyramid: {
    title: 'Financial Pyramid',
    titleKey: NAV_CONSTANTS.FINANCIAL_PYRAMID_LABEL,
    subtitle: 'Niveles y metas de la pirámide financiera',
    subtitleKey: NAV_CONSTANTS.FINANCIAL_PYRAMID_SUBTITLE,
    category: 'FOR BUSINESS',
    table: 'tfinancial_pyramid',
  },
  template_transaction: {
    title: 'Template transaction',
    titleKey: NAV_CONSTANTS.TEMPLATE_TRANSACTION_LABEL,
    subtitle: 'Plantillas y reglas contables para transacciones automáticas',
    subtitleKey: NAV_CONSTANTS.TEMPLATE_TRANSACTION_SUBTITLE,
    category: 'FOR BUSINESS',
    table: 'ttemplate_transaction',
  },
  household: {
    title: 'Household',
    titleKey: NAV_CONSTANTS.HOUSEHOLD_LABEL,
    subtitle: 'Hogares y espacios de gasto común',
    subtitleKey: NAV_CONSTANTS.HOUSEHOLD_SUBTITLE,
    category: 'BUDGET',
    table: 'thousehold',
  },
  auxiliar: {
    title: 'Auxiliar',
    titleKey: NAV_CONSTANTS.AUXILIAR_LABEL,
    subtitle: 'Entidades auxiliares vinculadas al hogar',
    subtitleKey: NAV_CONSTANTS.AUXILIAR_SUBTITLE,
    category: 'BUDGET',
    table: 'tauxiliar',
  },
};

