-- =====================================================================
-- Supabase Schema DDL: Tables, Constraints, and Indexes
-- Generated and topologically ordered by dependencies
-- =====================================================================
-- 0. Schema: budget
-- Schema for budget tables
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS budget;

-- Enable UUID / cryptographic extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- Table: budget.tuser
-- User profiles linked to external identities or messaging channels
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.tuser (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    email_user VARCHAR(100) NOT NULL UNIQUE,
    locale VARCHAR(10) NOT NULL DEFAULT 'es',
    timezone VARCHAR(20) NOT NULL DEFAULT 'UTC',
    role VARCHAR(30) NOT NULL DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT tuser_pkey PRIMARY KEY (id),
    CONSTRAINT tuser_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT tuser_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT tuser_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.tuser ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.tbusiness_type
-- Business type
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.tbusiness_type (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT tbusiness_type_pkey PRIMARY KEY (id),
    CONSTRAINT tbusiness_type_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT tbusiness_type_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT tbusiness_type_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.tbusiness_type ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.tlanguage
-- System supported languages and locales
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.tlanguage (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    code VARCHAR(10) NOT NULL,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT tlanguage_pkey PRIMARY KEY (id),
    CONSTRAINT tlanguage_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT tlanguage_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT tlanguage_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.tlanguage ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.tmessage
-- Multi-language message template catalog
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.tmessage (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(300),
    default_translation VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT tmessage_pkey PRIMARY KEY (id),
    CONSTRAINT tmessage_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT tmessage_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT tmessage_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.tmessage ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.tmessage_translation
-- Translations for message templates per locale
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.tmessage_translation (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL,
    language_id UUID NOT NULL,
    translation VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT tmessage_translation_pkey PRIMARY KEY (id),
    CONSTRAINT tmessage_translation_message_id_fkey FOREIGN KEY (message_id) REFERENCES budget.tmessage (id) ON DELETE CASCADE,
    CONSTRAINT tmessage_translation_language_id_fkey FOREIGN KEY (language_id) REFERENCES budget.tlanguage (id),
    CONSTRAINT tmessage_translation_message_id_language_id_unique UNIQUE (message_id, language_id),
    CONSTRAINT tmessage_translation_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT tmessage_translation_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT tmessage_translation_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.tmessage_translation ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.tchannel
-- External integration channels (e.g., WhatsApp, Telegram) per user
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.tchannel (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID,
    channel_type VARCHAR(30) DEFAULT 'whatsapp',
    channel_code VARCHAR(50) NOT NULL,
    config_json VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT tchannel_pkey PRIMARY KEY (id),
    CONSTRAINT tchannel_user_id_fkey FOREIGN KEY (user_id) REFERENCES budget.tuser (id) ON DELETE CASCADE,
    CONSTRAINT tchannel_channel_type_check CHECK (channel_type::text = ANY (ARRAY['whatsapp'::character varying, 'telegram'::character varying]::text[])),
    CONSTRAINT tchannel_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT tchannel_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT tchannel_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.tchannel ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.taccount_type
-- Catalog of account classifications (Asset, Liability, Equity, Income, Expense)
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.taccount_type (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(60) NOT NULL,
    normal_balance VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT taccount_type_pkey PRIMARY KEY (id),
    CONSTRAINT taccount_type_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT taccount_type_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT taccount_type_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.taccount_type ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.thousehold
-- Household entities for shared family budgeting
-- (Nota: la FK hacia budget.tauxiliar se añade posteriormente para evitar dependencia circular)
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.thousehold (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    business_type_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    currency VARCHAR(10) DEFAULT 'BOB',
    auxiliar_id UUID,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT thousehold_pkey PRIMARY KEY (id),
    CONSTRAINT thousehold_business_type_id_fkey FOREIGN KEY (business_type_id) REFERENCES budget.tbusiness_type (id),
    CONSTRAINT thousehold_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT thousehold_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT thousehold_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.thousehold ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.tauxiliar_type
-- Types/categories of auxiliary sub-ledgers (e.g., Customer, Supplier, Member)
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.tauxiliar_type (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT tauxiliar_type_pkey PRIMARY KEY (id),
    CONSTRAINT uq_tauxiliar_type_code UNIQUE (code),
    CONSTRAINT tauxiliar_type_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT tauxiliar_type_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT tauxiliar_type_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.tauxiliar_type ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.tauxiliar
-- Auxiliary sub-ledger entities (Clients, Vendors, Employees, Projects)
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.tauxiliar (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    auxiliar_type_id UUID NOT NULL,
    parent_id UUID,
    household_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT tauxiliar_pkey PRIMARY KEY (id),
    CONSTRAINT tauxiliar_household_id_fkey 
        FOREIGN KEY (household_id) REFERENCES budget.thousehold (id) ON DELETE CASCADE,
    CONSTRAINT tauxiliar_auxiliar_type_id_fkey 
        FOREIGN KEY (auxiliar_type_id) REFERENCES budget.tauxiliar_type (id) ON DELETE CASCADE,
    CONSTRAINT tauxiliar_parent_id_fkey 
        FOREIGN KEY (parent_id) REFERENCES budget.tauxiliar (id) ON DELETE SET NULL,
    CONSTRAINT tuq_auxiliar_household_code UNIQUE (household_id, code),
    CONSTRAINT tauxiliar_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT tauxiliar_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT tauxiliar_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.tauxiliar ENABLE ROW LEVEL SECURITY;

-- FK diferida para resolver la referencia circular thousehold -> tauxiliar
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'thousehold_auxiliar_id_fkey'
    ) THEN
        ALTER TABLE budget.thousehold
            ADD CONSTRAINT thousehold_auxiliar_id_fkey
            FOREIGN KEY (auxiliar_id) REFERENCES budget.tauxiliar (id) ON DELETE SET NULL;
    END IF;
END $$;

-- =====================================================================
-- Table: budget.taccount
-- Chart of accounts (Plan de Cuentas)
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.taccount (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    household_id UUID,
    account_type_id UUID NOT NULL,
    parent_id UUID,
    required_auxiliar_type_id UUID,
    business_type_id UUID,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(120) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'BOB',
    requires_auxiliar BOOLEAN NOT NULL DEFAULT false,
    is_postable BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT taccount_pkey PRIMARY KEY (id),
    CONSTRAINT taccount_business_type_id_fkey FOREIGN KEY (business_type_id) REFERENCES budget.tbusiness_type (id),
    CONSTRAINT taccount_household_id_fkey 
        FOREIGN KEY (household_id) REFERENCES budget.thousehold (id) ON DELETE CASCADE,
    CONSTRAINT taccount_account_type_id_fkey 
        FOREIGN KEY (account_type_id) REFERENCES budget.taccount_type (id),
    CONSTRAINT taccount_parent_id_fkey 
        FOREIGN KEY (parent_id) REFERENCES budget.taccount (id) ON DELETE SET NULL,
    CONSTRAINT taccount_required_auxiliar_type_id_fkey 
        FOREIGN KEY (required_auxiliar_type_id) REFERENCES budget.tauxiliar_type (id) ON DELETE SET NULL,
    CONSTRAINT uq_taccount_household_code UNIQUE (household_id, code),
    CONSTRAINT taccount_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT taccount_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT taccount_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.taccount ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.thousehold_member
-- Mapping between users and households with role permissions
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.thousehold_member (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role VARCHAR(30) DEFAULT 'member',
    auxiliar_id UUID,
    member_type VARCHAR(30) NOT NULL DEFAULT 'other', -- dad, mom, son, daughter, other
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT thousehold_member_pkey PRIMARY KEY (id),
    CONSTRAINT thousehold_member_household_id_fkey FOREIGN KEY (household_id) REFERENCES budget.thousehold (id) ON DELETE CASCADE,
    CONSTRAINT thousehold_member_user_id_fkey FOREIGN KEY (user_id) REFERENCES budget.tuser (id),
    CONSTRAINT thousehold_member_auxiliar_id_fkey FOREIGN KEY (auxiliar_id) REFERENCES budget.tauxiliar (id),
    CONSTRAINT thousehold_member_household_id_user_id_key UNIQUE (household_id, user_id),
    CONSTRAINT thousehold_member_role_check CHECK (role::text = ANY (ARRAY['admin'::character varying, 'member'::character varying]::text[])),
    CONSTRAINT thousehold_member_type_check CHECK (member_type::text = ANY (ARRAY['dad'::character varying, 'mom'::character varying, 'son'::character varying, 'other'::character varying]::text[])),
    CONSTRAINT thousehold_member_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT thousehold_member_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT thousehold_member_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.thousehold_member ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.thousehold_task
-- Tasks assigned to household members
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.thousehold_task (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    household_id UUID,
    household_member_id UUID,
    type VARCHAR(15), -- task, meet, etc.
    description TEXT,
    task_date  TIMESTAMP WITH TIME ZONE DEFAULT now(),
    schedule_json JSONB NOT NULL DEFAULT '{}'::jsonb, -- Configuracion para envio de notificaciones, por dia, horas, recurrente, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT tthousehold_task_pkey PRIMARY KEY (id),
    CONSTRAINT tthousehold_task_household_id_fkey FOREIGN KEY (household_id) REFERENCES budget.thousehold (id) ON DELETE CASCADE,
    CONSTRAINT tthousehold_task_household_member_id_fkey FOREIGN KEY (household_member_id) REFERENCES budget.thousehold_member (id) ON DELETE CASCADE,
    CONSTRAINT tthousehold_task_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT tthousehold_task_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT tthousehold_task_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.thousehold_task ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.ttemplate_transaction
-- Accounting calculation templates / formulas definition
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.ttemplate_transaction (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    business_type_id UUID,
    household_id UUID,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT ttemplate_transaction_pkey PRIMARY KEY (id),
    CONSTRAINT ttemplate_transaction_type_id_fkey FOREIGN KEY (business_type_id) REFERENCES budget.tbusiness_type (id),
    CONSTRAINT ttemplate_transaction_household_id_fkey 
        FOREIGN KEY (household_id) REFERENCES budget.thousehold (id) ON DELETE CASCADE,
    CONSTRAINT uq_ttemplate_transaction_household_code_ver UNIQUE (household_id, code, version),
    CONSTRAINT ttemplate_transaction_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT ttemplate_transaction_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT ttemplate_transaction_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.ttemplate_transaction ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.ttemplate_transaction_det
-- Line item definitions and accounting rules per template
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.ttemplate_transaction_det (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    template_transaction_id UUID NOT NULL,
    line_number INTEGER NOT NULL,
    account_id UUID,
    account_input_key VARCHAR(120),
    side VARCHAR(30) NOT NULL,
    amount_rule JSONB NOT NULL DEFAULT '{}'::jsonb,
    auxiliar_input_key VARCHAR(120),
    item_input_key VARCHAR(120),
    repeat_input_key VARCHAR(120),
    quantity_input_key VARCHAR(120),
    unit_price_input_key VARCHAR(120),
    unit_input_key VARCHAR(120),
    description_template VARCHAR(250),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT ttemplate_transaction_det_pkey PRIMARY KEY (id),
    CONSTRAINT ttemplate_transaction_det_template_transaction_id_fkey 
        FOREIGN KEY (template_transaction_id) REFERENCES budget.ttemplate_transaction (id) ON DELETE CASCADE,
    CONSTRAINT ttemplate_transaction_det_account_id_fkey 
        FOREIGN KEY (account_id) REFERENCES budget.taccount (id) ON DELETE SET NULL,
    CONSTRAINT uq_ttemplate_transaction_line UNIQUE (template_transaction_id, line_number),
    CONSTRAINT ttemplate_transaction_det_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT ttemplate_transaction_det_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT ttemplate_transaction_det_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.ttemplate_transaction_det ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.tbudget_type
-- Catalog of budget categories with pyramid level classification
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.tbudget_type (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    household_id UUID,
    business_type_id UUID,
    category_key VARCHAR(50) NOT NULL,
    name VARCHAR(300) NOT NULL,
    description VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT tbudget_type_pkey PRIMARY KEY (id),
    CONSTRAINT tbudget_type_business_id_fkey FOREIGN KEY (business_type_id) REFERENCES budget.tbusiness_type (id),
    CONSTRAINT tbudget_type_household_id_fkey FOREIGN KEY (household_id) REFERENCES budget.thousehold (id),
    CONSTRAINT tbudget_type_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT tbudget_type_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT tbudget_type_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.tbudget_type ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.tbudget
-- Household budget limits assigned per category/envelope
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.tbudget (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    household_id UUID,
    budget_type_id UUID,
    monthly_limit NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15),
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT tbudget_pkey PRIMARY KEY (id),
    CONSTRAINT tbudget_household_id_fkey FOREIGN KEY (household_id) REFERENCES budget.thousehold (id) ON DELETE CASCADE,
    CONSTRAINT tbudget_budget_type_id_fkey FOREIGN KEY (budget_type_id) REFERENCES budget.tbudget_type (id) ON DELETE CASCADE,
    CONSTRAINT uq_household_category UNIQUE (household_id, budget_type_id),
    CONSTRAINT tbudget_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT tbudget_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT tbudget_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.tbudget ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.ttransaction
-- Financial transactions (incomes and expenses)
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.ttransaction (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    household_id UUID,
    template_transaction_id UUID,
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    operation_code VARCHAR(50),
    concept VARCHAR(200),
    type VARCHAR(10),
    amount NUMERIC NOT NULL,
    external_reference VARCHAR(150),
    source_text TEXT,
    input_data JSONB NOT NULL DEFAULT '{}'::jsonb, 
    recorded_via VARCHAR(30) DEFAULT 'whatsapp',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT ttransaction_pkey PRIMARY KEY (id),
    CONSTRAINT ttransaction_household_id_fkey FOREIGN KEY (household_id) REFERENCES budget.thousehold (id) ON DELETE CASCADE,
    CONSTRAINT ttransaction_type_check CHECK (type::text = ANY (ARRAY['expense'::character varying, 'income'::character varying]::text[])),
    CONSTRAINT ttransaction_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT ttransaction_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT ttransaction_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.ttransaction ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.ttransaction_detail
-- Detailed itemized breakdown for transactions
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.ttransaction_detail (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL,

    account_id UUID NOT NULL,
    auxiliar_id UUID NOT NULL,
    budget_type_id UUID NOT NULL,

    item_code VARCHAR(30),
    description VARCHAR(500) NOT NULL,
    unit_measure_code VARCHAR(30) DEFAULT 'unit',
    quantity NUMERIC(18,6) DEFAULT 0,
    unit_price NUMERIC(18,6) DEFAULT 0,
    debit_base NUMERIC(18,6) DEFAULT 0,
    credit_base NUMERIC(18,6) DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT ttransaction_detail_pkey PRIMARY KEY (id),
    CONSTRAINT ttransaction_detail_budget_type_id_fkey FOREIGN KEY (budget_type_id) REFERENCES budget.tbudget_type (id) ON DELETE CASCADE,
    CONSTRAINT ttransaction_detail_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES budget.ttransaction (id) ON DELETE CASCADE,

    CONSTRAINT ttransaction_detail_account_id_fkey FOREIGN KEY (account_id) REFERENCES budget.taccount (id) ON DELETE CASCADE,
    CONSTRAINT ttransaction_detail_auxiliar_id_fkey FOREIGN KEY (auxiliar_id) REFERENCES budget.tauxiliar (id) ON DELETE CASCADE,

    CONSTRAINT ttransaction_detail_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT ttransaction_detail_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT ttransaction_detail_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.ttransaction_detail ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.thousehold_summary
-- Monthly aggregated summary of income, expense, and budget per household
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.thousehold_summary (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL,
    month DATE NOT NULL,
    total_income NUMERIC NOT NULL DEFAULT 0,
    total_expense NUMERIC NOT NULL DEFAULT 0,
    total_budget NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT thousehold_summary_pkey PRIMARY KEY (id),
    CONSTRAINT thousehold_summary_household_id_fkey FOREIGN KEY (household_id) REFERENCES budget.thousehold (id) ON DELETE CASCADE,
    CONSTRAINT thousehold_summary_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT thousehold_summary_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT thousehold_summary_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.thousehold_summary ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.tfinancial_pyramid
-- Financial Pyramid
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.tfinancial_pyramid (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    business_type_id UUID,
    household_id UUID,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(100),
    description VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT tfinancial_pyramid_pkey PRIMARY KEY (id),
    CONSTRAINT tfinancial_pyramid_type_id_fkey FOREIGN KEY (business_type_id) REFERENCES budget.tbusiness_type (id),
    CONSTRAINT tfinancial_pyramid_household_id_fkey FOREIGN KEY (household_id) REFERENCES budget.thousehold (id) ON DELETE CASCADE,
    CONSTRAINT tfinancial_pyramid_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT tfinancial_pyramid_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT tfinancial_pyramid_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.tfinancial_pyramid ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.tfinancial_pyramid_level
-- Financial Pyramid Level
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.tfinancial_pyramid_level (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    financial_pyramid_id UUID NOT NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(100),
    order_by INT,
    min_percentage NUMERIC NOT NULL DEFAULT 0,
    max_percentage NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT tfinancial_pyramid_level_pkey PRIMARY KEY (id),
    CONSTRAINT tfinancial_pyramid_level_financial_pyramid_id_fkey FOREIGN KEY (financial_pyramid_id) REFERENCES budget.tfinancial_pyramid (id) ON DELETE CASCADE,
    CONSTRAINT tfinancial_pyramid_level_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT tfinancial_pyramid_level_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT tfinancial_pyramid_level_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.tfinancial_pyramid_level ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.tbudget_type_pyramid_level
-- Financial Pyramid Goal
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.tbudget_type_pyramid_level (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    financial_pyramid_level_id UUID NOT NULL,
    budget_type_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT tbudget_type_pyramid_level_pkey PRIMARY KEY (id),
    CONSTRAINT tbudget_type_pyramid_level_financial_pyramid_level_id_fkey FOREIGN KEY (financial_pyramid_level_id) REFERENCES budget.tfinancial_pyramid_level (id) ON DELETE CASCADE,
    CONSTRAINT tbudget_type_pyramid_level_budget_type_id_fkey FOREIGN KEY (budget_type_id) REFERENCES budget.tbudget_type (id) ON DELETE CASCADE,
    CONSTRAINT tbudget_type_pyramid_level_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT tbudget_type_pyramid_level_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT tbudget_type_pyramid_level_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.tbudget_type_pyramid_level ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.tmodel_response
-- Financial Pyramid Goal
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.tmodel_response (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    household_id UUID,
    household_member_id UUID,
    name_model VARCHAR(100),
    prompt TEXT,
    response JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT tmodel_response_pkey PRIMARY KEY (id),
    CONSTRAINT tmodel_response_household_id_fkey FOREIGN KEY (household_id) REFERENCES budget.thousehold (id) ON DELETE CASCADE,
    CONSTRAINT tmodel_response_household_member_id_fkey FOREIGN KEY (household_member_id) REFERENCES budget.thousehold_member (id) ON DELETE CASCADE,
    CONSTRAINT tmodel_response_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT tmodel_response_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT tmodel_response_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.tmodel_response ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.tcommunity
-- Community (Grupo de household que comparten intereses para compartir cierta informacion)
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.tcommunity (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    code VARCHAR(50),
    name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT tcommunity_pkey PRIMARY KEY (id),
    CONSTRAINT tcommunity_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT tcommunity_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT tcommunity_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.tcommunity ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Table: budget.thousehold_community
-- Household Community (Grupo de household que comparten intereses para compartir cierta informacion)
-- =====================================================================
CREATE TABLE IF NOT EXISTS budget.thousehold_community (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL,
    community_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID,
    status VARCHAR(15) DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    CONSTRAINT thousehold_community_pkey PRIMARY KEY (id),
    CONSTRAINT thousehold_community_household_id_fkey FOREIGN KEY (household_id) REFERENCES budget.thousehold (id) ON DELETE CASCADE,
    CONSTRAINT thousehold_community_community_id_fkey FOREIGN KEY (community_id) REFERENCES budget.tcommunity (id) ON DELETE CASCADE,
    CONSTRAINT thousehold_community_created_by_fkey FOREIGN KEY (created_by) REFERENCES budget.tuser (id),
    CONSTRAINT thousehold_community_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES budget.tuser (id),
    CONSTRAINT thousehold_community_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES budget.tuser (id)
);

ALTER TABLE budget.thousehold_community ENABLE ROW LEVEL SECURITY;



-- =====================================================================
-- Performance Indexes for Foreign Keys & Queries
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_taccount_household_id ON budget.taccount (household_id);
CREATE INDEX IF NOT EXISTS idx_taccount_account_type_id ON budget.taccount (account_type_id);
CREATE INDEX IF NOT EXISTS idx_taccount_parent_id ON budget.taccount (parent_id);
CREATE INDEX IF NOT EXISTS idx_taccount_required_auxiliar_type_id ON budget.taccount (required_auxiliar_type_id);

CREATE INDEX IF NOT EXISTS idx_tauxiliar_household_id ON budget.tauxiliar (household_id);
CREATE INDEX IF NOT EXISTS idx_tauxiliar_auxiliar_type_id ON budget.tauxiliar (auxiliar_type_id);
CREATE INDEX IF NOT EXISTS idx_tauxiliar_parent_id ON budget.tauxiliar (parent_id);

CREATE INDEX IF NOT EXISTS idx_thousehold_auxiliar_id ON budget.thousehold (auxiliar_id);

CREATE INDEX IF NOT EXISTS idx_thousehold_member_household_id ON budget.thousehold_member (household_id);
CREATE INDEX IF NOT EXISTS idx_thousehold_member_user_id ON budget.thousehold_member (user_id);
CREATE INDEX IF NOT EXISTS idx_thousehold_member_auxiliar_id ON budget.thousehold_member (auxiliar_id);

CREATE INDEX IF NOT EXISTS idx_ttemplate_transaction_household_id ON budget.ttemplate_transaction (household_id);
CREATE INDEX IF NOT EXISTS idx_ttemplate_transaction_det_template ON budget.ttemplate_transaction_det (template_transaction_id);
CREATE INDEX IF NOT EXISTS idx_ttemplate_transaction_det_account ON budget.ttemplate_transaction_det (account_id);

CREATE INDEX IF NOT EXISTS idx_tbudget_type_household_id ON budget.tbudget_type (household_id);

CREATE INDEX IF NOT EXISTS idx_tbudget_household_id ON budget.tbudget (household_id);
CREATE INDEX IF NOT EXISTS idx_tbudget_budget_type_id ON budget.tbudget (budget_type_id);

CREATE INDEX IF NOT EXISTS idx_ttransaction_household_id ON budget.ttransaction (household_id);
CREATE INDEX IF NOT EXISTS idx_ttransaction_date ON budget.ttransaction (transaction_date);

CREATE INDEX IF NOT EXISTS idx_ttransaction_detail_transaction ON budget.ttransaction_detail (transaction_id);

CREATE INDEX IF NOT EXISTS idx_thousehold_summary_household_month ON budget.thousehold_summary (household_id, month);

CREATE INDEX IF NOT EXISTS idx_tmessage_translation_message_id ON budget.tmessage_translation (message_id);
CREATE INDEX IF NOT EXISTS idx_tmessage_translation_language_id ON budget.tmessage_translation (language_id);

CREATE INDEX IF NOT EXISTS idx_tchannel_user_id ON budget.tchannel (user_id);
