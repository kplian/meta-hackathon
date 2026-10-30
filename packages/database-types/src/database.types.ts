
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "budget": {
          Tables: {
            "taccount": {
                  Row: {
                    "account_type_id": string,"business_type_id": string | null,"code": string,"created_at": string | null,"created_by": string | null,"currency": string,"deleted_at": string | null,"deleted_by": string | null,"household_id": string | null,"id": string,"is_postable": boolean,"name": string,"parent_id": string | null,"required_auxiliar_type_id": string | null,"requires_auxiliar": boolean,"status": string | null,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_type_id": string,"business_type_id"?: string | null,"code": string,"created_at"?: string | null,"created_by"?: string | null,"currency"?: string,"deleted_at"?: string | null,"deleted_by"?: string | null,"household_id"?: string | null,"id"?: string,"is_postable"?: boolean,"name": string,"parent_id"?: string | null,"required_auxiliar_type_id"?: string | null,"requires_auxiliar"?: boolean,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "account_type_id"?: string,"business_type_id"?: string | null,"code"?: string,"created_at"?: string | null,"created_by"?: string | null,"currency"?: string,"deleted_at"?: string | null,"deleted_by"?: string | null,"household_id"?: string | null,"id"?: string,"is_postable"?: boolean,"name"?: string,"parent_id"?: string | null,"required_auxiliar_type_id"?: string | null,"requires_auxiliar"?: boolean,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "taccount_account_type_id_fkey"
      columns: ["account_type_id"]
isOneToOne: false
      referencedRelation: "taccount_type"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "taccount_business_type_id_fkey"
      columns: ["business_type_id"]
isOneToOne: false
      referencedRelation: "tbusiness_type"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "taccount_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "taccount_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "taccount_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "thousehold"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "taccount_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "taccount"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "taccount_required_auxiliar_type_id_fkey"
      columns: ["required_auxiliar_type_id"]
isOneToOne: false
      referencedRelation: "tauxiliar_type"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "taccount_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"taccount_type": {
                  Row: {
                    "code": string,"created_at": string | null,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"id": string,"name": string,"normal_balance": string,"status": string | null,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string | null,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"id"?: string,"name": string,"normal_balance": string,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "code"?: string,"created_at"?: string | null,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"id"?: string,"name"?: string,"normal_balance"?: string,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "taccount_type_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "taccount_type_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "taccount_type_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"tauxiliar": {
                  Row: {
                    "auxiliar_type_id": string,"code": string,"created_at": string | null,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"description": string | null,"household_id": string,"id": string,"name": string,"parent_id": string | null,"status": string | null,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "auxiliar_type_id": string,"code": string,"created_at"?: string | null,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"household_id": string,"id"?: string,"name": string,"parent_id"?: string | null,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "auxiliar_type_id"?: string,"code"?: string,"created_at"?: string | null,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"household_id"?: string,"id"?: string,"name"?: string,"parent_id"?: string | null,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tauxiliar_auxiliar_type_id_fkey"
      columns: ["auxiliar_type_id"]
isOneToOne: false
      referencedRelation: "tauxiliar_type"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tauxiliar_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tauxiliar_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tauxiliar_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "thousehold"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tauxiliar_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "tauxiliar"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tauxiliar_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"tauxiliar_type": {
                  Row: {
                    "code": string,"created_at": string | null,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"id": string,"name": string,"status": string | null,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string | null,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"id"?: string,"name": string,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "code"?: string,"created_at"?: string | null,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"id"?: string,"name"?: string,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tauxiliar_type_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tauxiliar_type_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tauxiliar_type_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"tbudget": {
                  Row: {
                    "budget_type_id": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"household_id": string | null,"id": string,"monthly_limit": number,"status": string | null,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "budget_type_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"household_id"?: string | null,"id"?: string,"monthly_limit": number,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "budget_type_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"household_id"?: string | null,"id"?: string,"monthly_limit"?: number,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tbudget_budget_type_id_fkey"
      columns: ["budget_type_id"]
isOneToOne: false
      referencedRelation: "tbudget_type"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tbudget_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tbudget_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tbudget_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "thousehold"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tbudget_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"tbudget_type": {
                  Row: {
                    "business_type_id": string | null,"category_key": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"description": string | null,"household_id": string | null,"id": string,"name": string,"status": string | null,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_type_id"?: string | null,"category_key": string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"household_id"?: string | null,"id"?: string,"name": string,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "business_type_id"?: string | null,"category_key"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"household_id"?: string | null,"id"?: string,"name"?: string,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tbudget_type_business_id_fkey"
      columns: ["business_type_id"]
isOneToOne: false
      referencedRelation: "tbusiness_type"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tbudget_type_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tbudget_type_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tbudget_type_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "thousehold"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tbudget_type_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"tbudget_type_pyramid_level": {
                  Row: {
                    "budget_type_id": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"financial_pyramid_level_id": string,"id": string,"status": string | null,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "budget_type_id": string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"financial_pyramid_level_id": string,"id"?: string,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "budget_type_id"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"financial_pyramid_level_id"?: string,"id"?: string,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tbudget_type_pyramid_level_budget_type_id_fkey"
      columns: ["budget_type_id"]
isOneToOne: false
      referencedRelation: "tbudget_type"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tbudget_type_pyramid_level_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tbudget_type_pyramid_level_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tbudget_type_pyramid_level_financial_pyramid_level_id_fkey"
      columns: ["financial_pyramid_level_id"]
isOneToOne: false
      referencedRelation: "tfinancial_pyramid_level"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tbudget_type_pyramid_level_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"tbusiness_type": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"id": string,"name": string,"status": string | null,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"id"?: string,"name": string,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"id"?: string,"name"?: string,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tbusiness_type_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tbusiness_type_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tbusiness_type_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"tchannel": {
                  Row: {
                    "channel_code": string,"channel_type": string | null,"config_json": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"id": string,"status": string | null,"updated_at": string | null,"updated_by": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "channel_code": string,"channel_type"?: string | null,"config_json"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"id"?: string,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "channel_code"?: string,"channel_type"?: string | null,"config_json"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"id"?: string,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tchannel_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tchannel_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tchannel_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tchannel_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"tcommunity": {
                  Row: {
                    "code": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"id": string,"name": string | null,"status": string | null,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"id"?: string,"name"?: string | null,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "code"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"id"?: string,"name"?: string | null,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tcommunity_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tcommunity_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tcommunity_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"tfinancial_pyramid": {
                  Row: {
                    "business_type_id": string | null,"code": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"description": string | null,"household_id": string | null,"id": string,"name": string | null,"status": string | null,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_type_id"?: string | null,"code": string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"household_id"?: string | null,"id"?: string,"name"?: string | null,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "business_type_id"?: string | null,"code"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"household_id"?: string | null,"id"?: string,"name"?: string | null,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tfinancial_pyramid_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tfinancial_pyramid_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tfinancial_pyramid_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "thousehold"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tfinancial_pyramid_type_id_fkey"
      columns: ["business_type_id"]
isOneToOne: false
      referencedRelation: "tbusiness_type"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tfinancial_pyramid_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"tfinancial_pyramid_level": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"financial_pyramid_id": string,"id": string,"max_percentage": number,"min_percentage": number,"name": string | null,"order_by": number | null,"status": string | null,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"financial_pyramid_id": string,"id"?: string,"max_percentage"?: number,"min_percentage"?: number,"name"?: string | null,"order_by"?: number | null,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"financial_pyramid_id"?: string,"id"?: string,"max_percentage"?: number,"min_percentage"?: number,"name"?: string | null,"order_by"?: number | null,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tfinancial_pyramid_level_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tfinancial_pyramid_level_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tfinancial_pyramid_level_financial_pyramid_id_fkey"
      columns: ["financial_pyramid_id"]
isOneToOne: false
      referencedRelation: "tfinancial_pyramid"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tfinancial_pyramid_level_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"thousehold": {
                  Row: {
                    "auxiliar_id": string | null,"business_type_id": string,"created_at": string,"created_by": string | null,"currency": string | null,"deleted_at": string | null,"deleted_by": string | null,"id": string,"name": string,"preferences": Json | null,"status": string | null,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "auxiliar_id"?: string | null,"business_type_id": string,"created_at"?: string,"created_by"?: string | null,"currency"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"id"?: string,"name": string,"preferences"?: Json | null,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "auxiliar_id"?: string | null,"business_type_id"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"id"?: string,"name"?: string,"preferences"?: Json | null,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "thousehold_auxiliar_id_fkey"
      columns: ["auxiliar_id"]
isOneToOne: false
      referencedRelation: "tauxiliar"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "thousehold_business_type_id_fkey"
      columns: ["business_type_id"]
isOneToOne: false
      referencedRelation: "tbusiness_type"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "thousehold_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "thousehold_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "thousehold_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"thousehold_community": {
                  Row: {
                    "community_id": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"household_id": string,"id": string,"status": string | null,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "community_id": string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"household_id": string,"id"?: string,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "community_id"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"household_id"?: string,"id"?: string,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "thousehold_community_community_id_fkey"
      columns: ["community_id"]
isOneToOne: false
      referencedRelation: "tcommunity"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "thousehold_community_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "thousehold_community_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "thousehold_community_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "thousehold"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "thousehold_community_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"thousehold_member": {
                  Row: {
                    "auxiliar_id": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"household_id": string,"id": string,"member_type": string,"preferences": Json | null,"role": string | null,"status": string | null,"updated_at": string | null,"updated_by": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auxiliar_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"household_id": string,"id"?: string,"member_type"?: string,"preferences"?: Json | null,"role"?: string | null,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null,"user_id": string
                  }
                  Update: {
                    "auxiliar_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"household_id"?: string,"id"?: string,"member_type"?: string,"preferences"?: Json | null,"role"?: string | null,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "thousehold_member_auxiliar_id_fkey"
      columns: ["auxiliar_id"]
isOneToOne: false
      referencedRelation: "tauxiliar"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "thousehold_member_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "thousehold_member_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "thousehold_member_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "thousehold"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "thousehold_member_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "thousehold_member_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"thousehold_summary": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"household_id": string,"id": string,"month": string,"status": string | null,"total_budget": number | null,"total_expense": number,"total_income": number,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"household_id": string,"id"?: string,"month": string,"status"?: string | null,"total_budget"?: number | null,"total_expense"?: number,"total_income"?: number,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"household_id"?: string,"id"?: string,"month"?: string,"status"?: string | null,"total_budget"?: number | null,"total_expense"?: number,"total_income"?: number,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "thousehold_summary_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "thousehold_summary_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "thousehold_summary_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "thousehold"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "thousehold_summary_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"thousehold_task": {
                  Row: {
                    "created_at": string | null,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"description": string | null,"household_id": string | null,"household_member_id": string | null,"id": string,"schedule_json": NonNullable<Json>,"status": string | null,"task_date": string | null,"type": string | null,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"household_id"?: string | null,"household_member_id"?: string | null,"id"?: string,"schedule_json"?: NonNullable<Json>,"status"?: string | null,"task_date"?: string | null,"type"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"household_id"?: string | null,"household_member_id"?: string | null,"id"?: string,"schedule_json"?: NonNullable<Json>,"status"?: string | null,"task_date"?: string | null,"type"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tthousehold_task_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tthousehold_task_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tthousehold_task_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "thousehold"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tthousehold_task_household_member_id_fkey"
      columns: ["household_member_id"]
isOneToOne: false
      referencedRelation: "thousehold_member"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tthousehold_task_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"tlanguage": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"id": string,"name": string,"status": string | null,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"id"?: string,"name": string,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"id"?: string,"name"?: string,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tlanguage_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tlanguage_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tlanguage_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"tmessage": {
                  Row: {
                    "created_at": string,"created_by": string | null,"default_translation": string | null,"deleted_at": string | null,"deleted_by": string | null,"description": string | null,"id": string,"key": string,"status": string | null,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"default_translation"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"id"?: string,"key": string,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"default_translation"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"id"?: string,"key"?: string,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tmessage_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tmessage_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tmessage_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"tmessage_translation": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"id": string,"language_id": string,"message_id": string,"status": string | null,"translation": string,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"id"?: string,"language_id": string,"message_id": string,"status"?: string | null,"translation": string,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"id"?: string,"language_id"?: string,"message_id"?: string,"status"?: string | null,"translation"?: string,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tmessage_translation_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tmessage_translation_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tmessage_translation_language_id_fkey"
      columns: ["language_id"]
isOneToOne: false
      referencedRelation: "tlanguage"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tmessage_translation_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "tmessage"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tmessage_translation_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"tmodel_response": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"household_id": string | null,"household_member_id": string | null,"id": string,"name_model": string | null,"prompt": string | null,"response": Json | null,"status": string | null,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"household_id"?: string | null,"household_member_id"?: string | null,"id"?: string,"name_model"?: string | null,"prompt"?: string | null,"response"?: Json | null,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"household_id"?: string | null,"household_member_id"?: string | null,"id"?: string,"name_model"?: string | null,"prompt"?: string | null,"response"?: Json | null,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tmodel_response_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tmodel_response_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tmodel_response_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "thousehold"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tmodel_response_household_member_id_fkey"
      columns: ["household_member_id"]
isOneToOne: false
      referencedRelation: "thousehold_member"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tmodel_response_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"ttemplate_transaction": {
                  Row: {
                    "business_type_id": string | null,"code": string,"created_at": string | null,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"description": string | null,"household_id": string | null,"id": string,"input_schema": NonNullable<Json>,"name": string,"status": string | null,"updated_at": string | null,"updated_by": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "business_type_id"?: string | null,"code": string,"created_at"?: string | null,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"household_id"?: string | null,"id"?: string,"input_schema"?: NonNullable<Json>,"name": string,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null,"version"?: number
                  }
                  Update: {
                    "business_type_id"?: string | null,"code"?: string,"created_at"?: string | null,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"household_id"?: string | null,"id"?: string,"input_schema"?: NonNullable<Json>,"name"?: string,"status"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "ttemplate_transaction_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ttemplate_transaction_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ttemplate_transaction_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "thousehold"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ttemplate_transaction_type_id_fkey"
      columns: ["business_type_id"]
isOneToOne: false
      referencedRelation: "tbusiness_type"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ttemplate_transaction_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"ttemplate_transaction_det": {
                  Row: {
                    "account_id": string | null,"account_input_key": string | null,"amount_rule": NonNullable<Json>,"auxiliar_input_key": string | null,"created_at": string | null,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"description_template": string | null,"id": string,"item_input_key": string | null,"line_number": number,"quantity_input_key": string | null,"repeat_input_key": string | null,"side": string,"status": string | null,"template_transaction_id": string,"unit_input_key": string | null,"unit_price_input_key": string | null,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"account_input_key"?: string | null,"amount_rule"?: NonNullable<Json>,"auxiliar_input_key"?: string | null,"created_at"?: string | null,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description_template"?: string | null,"id"?: string,"item_input_key"?: string | null,"line_number": number,"quantity_input_key"?: string | null,"repeat_input_key"?: string | null,"side": string,"status"?: string | null,"template_transaction_id": string,"unit_input_key"?: string | null,"unit_price_input_key"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "account_id"?: string | null,"account_input_key"?: string | null,"amount_rule"?: NonNullable<Json>,"auxiliar_input_key"?: string | null,"created_at"?: string | null,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description_template"?: string | null,"id"?: string,"item_input_key"?: string | null,"line_number"?: number,"quantity_input_key"?: string | null,"repeat_input_key"?: string | null,"side"?: string,"status"?: string | null,"template_transaction_id"?: string,"unit_input_key"?: string | null,"unit_price_input_key"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ttemplate_transaction_det_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "taccount"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ttemplate_transaction_det_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ttemplate_transaction_det_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ttemplate_transaction_det_template_transaction_id_fkey"
      columns: ["template_transaction_id"]
isOneToOne: false
      referencedRelation: "ttemplate_transaction"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ttemplate_transaction_det_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"ttransaction": {
                  Row: {
                    "amount": number,"concept": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"external_reference": string | null,"household_id": string | null,"id": string,"input_data": NonNullable<Json>,"operation_code": string | null,"recorded_via": string | null,"source_text": string | null,"status": string | null,"template_transaction_id": string | null,"transaction_date": string,"type": string | null,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"concept"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"external_reference"?: string | null,"household_id"?: string | null,"id"?: string,"input_data"?: NonNullable<Json>,"operation_code"?: string | null,"recorded_via"?: string | null,"source_text"?: string | null,"status"?: string | null,"template_transaction_id"?: string | null,"transaction_date"?: string,"type"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"concept"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"external_reference"?: string | null,"household_id"?: string | null,"id"?: string,"input_data"?: NonNullable<Json>,"operation_code"?: string | null,"recorded_via"?: string | null,"source_text"?: string | null,"status"?: string | null,"template_transaction_id"?: string | null,"transaction_date"?: string,"type"?: string | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ttransaction_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ttransaction_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ttransaction_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "thousehold"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ttransaction_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"ttransaction_detail": {
                  Row: {
                    "account_id": string,"auxiliar_id": string,"budget_type_id": string,"created_at": string,"created_by": string | null,"credit_base": number | null,"debit_base": number | null,"deleted_at": string | null,"deleted_by": string | null,"description": string,"id": string,"item_code": string | null,"quantity": number | null,"status": string | null,"transaction_id": string,"unit_measure_code": string | null,"unit_price": number | null,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"auxiliar_id": string,"budget_type_id": string,"created_at"?: string,"created_by"?: string | null,"credit_base"?: number | null,"debit_base"?: number | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description": string,"id"?: string,"item_code"?: string | null,"quantity"?: number | null,"status"?: string | null,"transaction_id": string,"unit_measure_code"?: string | null,"unit_price"?: number | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "account_id"?: string,"auxiliar_id"?: string,"budget_type_id"?: string,"created_at"?: string,"created_by"?: string | null,"credit_base"?: number | null,"debit_base"?: number | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string,"id"?: string,"item_code"?: string | null,"quantity"?: number | null,"status"?: string | null,"transaction_id"?: string,"unit_measure_code"?: string | null,"unit_price"?: number | null,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ttransaction_detail_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "taccount"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ttransaction_detail_auxiliar_id_fkey"
      columns: ["auxiliar_id"]
isOneToOne: false
      referencedRelation: "tauxiliar"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ttransaction_detail_budget_type_id_fkey"
      columns: ["budget_type_id"]
isOneToOne: false
      referencedRelation: "tbudget_type"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ttransaction_detail_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ttransaction_detail_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ttransaction_detail_transaction_id_fkey"
      columns: ["transaction_id"]
isOneToOne: false
      referencedRelation: "ttransaction"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ttransaction_detail_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                },"tuser": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"email_user": string,"full_name": string,"id": string,"locale": string,"role": string,"status": string | null,"timezone": string,"updated_at": string | null,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"email_user": string,"full_name": string,"id"?: string,"locale"?: string,"role"?: string,"status"?: string | null,"timezone"?: string,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"email_user"?: string,"full_name"?: string,"id"?: string,"locale"?: string,"role"?: string,"status"?: string | null,"timezone"?: string,"updated_at"?: string | null,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tuser_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tuser_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tuser_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "tuser"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "f_create_household":
{ Args: { "p_channel_code": string,"p_currency"?: string,"p_name": string }; Returns: Json
                           },
"f_get_user_households":
{ Args: { "p_channel_code": string }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"storage": {
          Tables: {
            "buckets": {
                  Row: {
                    "allowed_mime_types": (string)[] | null,"avif_autodetection": boolean | null,"created_at": string | null,"file_size_limit": number | null,"id": string,"lifecycle_configuration": Json | null,"lifecycle_configuration_generation": string | null,"name": string,"owner": string | null,"owner_id": string | null,"public": boolean | null,"type": Database["storage"]['Enums']["buckettype"],"updated_at": string | null,"versioning_status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allowed_mime_types"?: (string)[] | null,"avif_autodetection"?: boolean | null,"created_at"?: string | null,"file_size_limit"?: number | null,"id": string,"lifecycle_configuration"?: Json | null,"lifecycle_configuration_generation"?: string | null,"name": string,"owner"?: string | null,"owner_id"?: string | null,"public"?: boolean | null,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string | null,"versioning_status"?: string
                  }
                  Update: {
                    "allowed_mime_types"?: (string)[] | null,"avif_autodetection"?: boolean | null,"created_at"?: string | null,"file_size_limit"?: number | null,"id"?: string,"lifecycle_configuration"?: Json | null,"lifecycle_configuration_generation"?: string | null,"name"?: string,"owner"?: string | null,"owner_id"?: string | null,"public"?: boolean | null,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string | null,"versioning_status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"buckets_analytics": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"format": string,"id": string,"name": string,"type": Database["storage"]['Enums']["buckettype"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"format"?: string,"id"?: string,"name": string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"format"?: string,"id"?: string,"name"?: string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"buckets_vectors": {
                  Row: {
                    "created_at": string,"id": string,"type": Database["storage"]['Enums']["buckettype"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id": string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"iceberg_namespaces": {
                  Row: {
                    "bucket_name": string,"catalog_id": string,"created_at": string,"id": string,"metadata": NonNullable<Json>,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_name": string,"catalog_id": string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "bucket_name"?: string,"catalog_id"?: string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
      columns: ["catalog_id"]
isOneToOne: false
      referencedRelation: "buckets_analytics"
      referencedColumns: ["id"]
    }
                  ]
                },"iceberg_tables": {
                  Row: {
                    "bucket_name": string,"catalog_id": string,"created_at": string,"id": string,"location": string,"name": string,"namespace_id": string,"remote_table_id": string | null,"shard_id": string | null,"shard_key": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_name": string,"catalog_id": string,"created_at"?: string,"id"?: string,"location": string,"name": string,"namespace_id": string,"remote_table_id"?: string | null,"shard_id"?: string | null,"shard_key"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "bucket_name"?: string,"catalog_id"?: string,"created_at"?: string,"id"?: string,"location"?: string,"name"?: string,"namespace_id"?: string,"remote_table_id"?: string | null,"shard_id"?: string | null,"shard_key"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "iceberg_tables_catalog_id_fkey"
      columns: ["catalog_id"]
isOneToOne: false
      referencedRelation: "buckets_analytics"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "iceberg_tables_namespace_id_fkey"
      columns: ["namespace_id"]
isOneToOne: false
      referencedRelation: "iceberg_namespaces"
      referencedColumns: ["id"]
    }
                  ]
                },"migrations": {
                  Row: {
                    "executed_at": string | null,"hash": string,"id": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "executed_at"?: string | null,"hash": string,"id": number,"name": string
                  }
                  Update: {
                    "executed_at"?: string | null,"hash"?: string,"id"?: number,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"objects": {
                  Row: {
                    "archived_at": string | null,"bucket_id": string | null,"created_at": string | null,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"last_accessed_at": string | null,"metadata": Json | null,"name": string | null,"owner": string | null,"owner_id": string | null,"path_tokens": (string)[] | null,"updated_at": string | null,"user_metadata": Json | null,"version": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"bucket_id"?: string | null,"created_at"?: string | null,"id"?: string,"is_delete_marker"?: boolean,"is_versioned"?: boolean,"last_accessed_at"?: string | null,"metadata"?: Json | null,"name"?: string | null,"owner"?: string | null,"owner_id"?: string | null,"path_tokens"?: never,"updated_at"?: string | null,"user_metadata"?: Json | null,"version"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"bucket_id"?: string | null,"created_at"?: string | null,"id"?: string,"is_delete_marker"?: boolean,"is_versioned"?: boolean,"last_accessed_at"?: string | null,"metadata"?: Json | null,"name"?: string | null,"owner"?: string | null,"owner_id"?: string | null,"path_tokens"?: never,"updated_at"?: string | null,"user_metadata"?: Json | null,"version"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "objects_bucketId_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    }
                  ]
                },"s3_multipart_uploads": {
                  Row: {
                    "bucket_id": string,"created_at": string,"id": string,"in_progress_size": number,"key": string,"metadata": Json | null,"owner_id": string | null,"upload_signature": string,"user_metadata": Json | null,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_id": string,"created_at"?: string,"id": string,"in_progress_size"?: number,"key": string,"metadata"?: Json | null,"owner_id"?: string | null,"upload_signature": string,"user_metadata"?: Json | null,"version": string
                  }
                  Update: {
                    "bucket_id"?: string,"created_at"?: string,"id"?: string,"in_progress_size"?: number,"key"?: string,"metadata"?: Json | null,"owner_id"?: string | null,"upload_signature"?: string,"user_metadata"?: Json | null,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    }
                  ]
                },"s3_multipart_uploads_parts": {
                  Row: {
                    "bucket_id": string,"created_at": string,"etag": string,"id": string,"key": string,"owner_id": string | null,"part_number": number,"size": number,"upload_id": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_id": string,"created_at"?: string,"etag": string,"id"?: string,"key": string,"owner_id"?: string | null,"part_number": number,"size"?: number,"upload_id": string,"version": string
                  }
                  Update: {
                    "bucket_id"?: string,"created_at"?: string,"etag"?: string,"id"?: string,"key"?: string,"owner_id"?: string | null,"part_number"?: number,"size"?: number,"upload_id"?: string,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
      columns: ["upload_id"]
isOneToOne: false
      referencedRelation: "s3_multipart_uploads"
      referencedColumns: ["id"]
    }
                  ]
                },"vector_indexes": {
                  Row: {
                    "bucket_id": string,"created_at": string,"data_type": string,"dimension": number,"distance_metric": string,"id": string,"metadata_configuration": Json | null,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_id": string,"created_at"?: string,"data_type": string,"dimension": number,"distance_metric": string,"id"?: string,"metadata_configuration"?: Json | null,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "bucket_id"?: string,"created_at"?: string,"data_type"?: string,"dimension"?: number,"distance_metric"?: string,"id"?: string,"metadata_configuration"?: Json | null,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vector_indexes_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets_vectors"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "allow_any_operation":
{ Args: { "expected_operations": (string)[] }; Returns: boolean
                           },
"allow_only_operation":
{ Args: { "expected_operation": string }; Returns: boolean
                           },
"can_insert_object":
{ Args: { "bucketid": string,"metadata": Json,"name": string,"owner": string }; Returns: undefined
                           },
"extension":
{ Args: { "name": string }; Returns: string
                           },
"filename":
{ Args: { "name": string }; Returns: string
                           },
"foldername":
{ Args: { "name": string }; Returns: (string)[]
                           },
"get_common_prefix":
{ Args: { "p_delimiter": string,"p_key": string,"p_prefix": string }; Returns: string
                           },
"get_size_by_bucket":
{ Args: { "delete_markers"?: string,"noncurrent_versions"?: string }; Returns: {
              "bucket_id": string,"size": number
            }[]
                           },
"list_multipart_uploads_with_delimiter":
{ Args: { "bucket_id": string,"delimiter_param": string,"max_keys"?: number,"next_key_token"?: string,"next_upload_token"?: string,"prefix_param": string,"raw_prefix_param"?: string }; Returns: {
              "created_at": string,"id": string,"key": string
            }[]
                           },
"list_objects_with_delimiter":
{ Args: { "_bucket_id": string,"delete_markers"?: string,"delimiter_param": string,"max_keys"?: number,"next_token"?: string,"next_token_archived_at"?: string,"next_token_version"?: string,"noncurrent_versions"?: string,"prefix_param": string,"sort_order"?: string,"start_after"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           },
"operation":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"search":
{ Args: { "bucketname": string,"delete_markers"?: string,"levels"?: number,"limits"?: number,"noncurrent_versions"?: string,"offsets"?: number,"prefix": string,"search"?: string,"sortcolumn"?: string,"sortorder"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           },
"search_by_timestamp":
{ Args: { "delete_markers"?: string,"noncurrent_versions"?: string,"p_bucket_id": string,"p_level": number,"p_limit": number,"p_prefix": string,"p_sort_column": string,"p_sort_column_after": string,"p_sort_order": string,"p_start_after": string,"p_start_after_version"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"key": string,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           },
"search_v2":
{ Args: { "bucket_name": string,"delete_markers"?: string,"levels"?: number,"limits"?: number,"noncurrent_versions"?: string,"prefix": string,"sort_column"?: string,"sort_column_after"?: string,"sort_order"?: string,"start_after"?: string,"start_after_archived_at"?: string,"start_after_is_continuation"?: boolean,"start_after_version"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"key": string,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           }
          }
          Enums: {
            "buckettype": "STANDARD"|"ANALYTICS"|"VECTOR"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "budget": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        },"storage": {
          Enums: {
            "buckettype": ["STANDARD", "ANALYTICS", "VECTOR"]
          }
        }
} as const
