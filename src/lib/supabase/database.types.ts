
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "ai_usage_log": {
                  Row: {
                    "created_at": string,"created_by": string,"error_code": string | null,"id": number,"model": string,"provider": string,"purpose": string,"research_session_id": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"error_code"?: string | null,"id"?: never,"model": string,"provider": string,"purpose": string,"research_session_id"?: string | null,"status": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"error_code"?: string | null,"id"?: never,"model"?: string,"provider"?: string,"purpose"?: string,"research_session_id"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_usage_log_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_usage_log_research_session_id_fkey"
      columns: ["research_session_id"]
isOneToOne: false
      referencedRelation: "research_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"commercial_activities": {
                  Row: {
                    "activity_type": Database["public"]['Enums']["activity_type"],"created_at": string,"id": string,"new_status": string | null,"note": string | null,"opportunity_id": string,"previous_status": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_type": Database["public"]['Enums']["activity_type"],"created_at"?: string,"id"?: string,"new_status"?: string | null,"note"?: string | null,"opportunity_id": string,"previous_status"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "activity_type"?: Database["public"]['Enums']["activity_type"],"created_at"?: string,"id"?: string,"new_status"?: string | null,"note"?: string | null,"opportunity_id"?: string,"previous_status"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "commercial_activities_new_status_fkey"
      columns: ["new_status"]
isOneToOne: false
      referencedRelation: "commercial_statuses"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "commercial_activities_new_status_fkey"
      columns: ["new_status"]
isOneToOne: false
      referencedRelation: "opportunity_status_counts"
      referencedColumns: ["commercial_status"]
    },{
      foreignKeyName: "commercial_activities_opportunity_id_fkey"
      columns: ["opportunity_id"]
isOneToOne: false
      referencedRelation: "company_overview"
      referencedColumns: ["best_opportunity_id"]
    },{
      foreignKeyName: "commercial_activities_opportunity_id_fkey"
      columns: ["opportunity_id"]
isOneToOne: false
      referencedRelation: "opportunities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "commercial_activities_previous_status_fkey"
      columns: ["previous_status"]
isOneToOne: false
      referencedRelation: "commercial_statuses"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "commercial_activities_previous_status_fkey"
      columns: ["previous_status"]
isOneToOne: false
      referencedRelation: "opportunity_status_counts"
      referencedColumns: ["commercial_status"]
    },{
      foreignKeyName: "commercial_activities_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"commercial_statuses": {
                  Row: {
                    "category": string,"is_active": boolean,"key": string,"label": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"is_active"?: boolean,"key": string,"label": string,"position": number
                  }
                  Update: {
                    "category"?: string,"is_active"?: boolean,"key"?: string,"label"?: string,"position"?: number
                  }
                  Relationships: [
                    
                  ]
                },"companies": {
                  Row: {
                    "address": string | null,"city": string | null,"cnpj": string | null,"created_at": string,"created_by": string,"field_provenance": NonNullable<Json>,"id": string,"latitude": number | null,"location_status": Database["public"]['Enums']["information_status"],"location_verified_at": string | null,"longitude": number | null,"name": string,"neighborhood": string | null,"normalized_name": string,"phone": string | null,"phone_normalized": string | null,"postal_code": string | null,"segment": string | null,"state": string | null,"updated_at": string,"website": string | null,"website_domain": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"city"?: string | null,"cnpj"?: string | null,"created_at"?: string,"created_by"?: string,"field_provenance"?: NonNullable<Json>,"id"?: string,"latitude"?: number | null,"location_status"?: Database["public"]['Enums']["information_status"],"location_verified_at"?: string | null,"longitude"?: number | null,"name": string,"neighborhood"?: string | null,"normalized_name": string,"phone"?: string | null,"phone_normalized"?: string | null,"postal_code"?: string | null,"segment"?: string | null,"state"?: string | null,"updated_at"?: string,"website"?: string | null,"website_domain"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"city"?: string | null,"cnpj"?: string | null,"created_at"?: string,"created_by"?: string,"field_provenance"?: NonNullable<Json>,"id"?: string,"latitude"?: number | null,"location_status"?: Database["public"]['Enums']["information_status"],"location_verified_at"?: string | null,"longitude"?: number | null,"name"?: string,"neighborhood"?: string | null,"normalized_name"?: string,"phone"?: string | null,"phone_normalized"?: string | null,"postal_code"?: string | null,"segment"?: string | null,"state"?: string | null,"updated_at"?: string,"website"?: string | null,"website_domain"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "companies_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"company_sources": {
                  Row: {
                    "collected_at": string,"company_id": string,"created_at": string,"evidence_metadata": NonNullable<Json>,"id": string,"last_verified_at": string | null,"research_session_id": string | null,"source_name": string,"source_record_id": string | null,"source_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "collected_at"?: string,"company_id": string,"created_at"?: string,"evidence_metadata"?: NonNullable<Json>,"id"?: string,"last_verified_at"?: string | null,"research_session_id"?: string | null,"source_name": string,"source_record_id"?: string | null,"source_url"?: string | null
                  }
                  Update: {
                    "collected_at"?: string,"company_id"?: string,"created_at"?: string,"evidence_metadata"?: NonNullable<Json>,"id"?: string,"last_verified_at"?: string | null,"research_session_id"?: string | null,"source_name"?: string,"source_record_id"?: string | null,"source_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "company_sources_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "company_sources_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "company_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "company_sources_research_session_id_fkey"
      columns: ["research_session_id"]
isOneToOne: false
      referencedRelation: "research_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"opportunities": {
                  Row: {
                    "commercial_status": string,"company_id": string,"confidence": number | null,"created_at": string,"created_by": string,"current_score_id": string | null,"id": string,"is_saved": boolean,"product_idea_id": string | null,"research_session_id": string | null,"saved_at": string | null,"score": number | null,"score_is_complete": boolean | null,"score_version": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "commercial_status"?: string,"company_id": string,"confidence"?: number | null,"created_at"?: string,"created_by"?: string,"current_score_id"?: string | null,"id"?: string,"is_saved"?: boolean,"product_idea_id"?: string | null,"research_session_id"?: string | null,"saved_at"?: string | null,"score"?: number | null,"score_is_complete"?: boolean | null,"score_version"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "commercial_status"?: string,"company_id"?: string,"confidence"?: number | null,"created_at"?: string,"created_by"?: string,"current_score_id"?: string | null,"id"?: string,"is_saved"?: boolean,"product_idea_id"?: string | null,"research_session_id"?: string | null,"saved_at"?: string | null,"score"?: number | null,"score_is_complete"?: boolean | null,"score_version"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "opportunities_commercial_status_fkey"
      columns: ["commercial_status"]
isOneToOne: false
      referencedRelation: "commercial_statuses"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "opportunities_commercial_status_fkey"
      columns: ["commercial_status"]
isOneToOne: false
      referencedRelation: "opportunity_status_counts"
      referencedColumns: ["commercial_status"]
    },{
      foreignKeyName: "opportunities_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunities_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "company_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunities_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunities_current_score_fk"
      columns: ["current_score_id"]
isOneToOne: false
      referencedRelation: "opportunity_scores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunities_product_idea_id_fkey"
      columns: ["product_idea_id"]
isOneToOne: false
      referencedRelation: "product_ideas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunities_research_session_id_fkey"
      columns: ["research_session_id"]
isOneToOne: false
      referencedRelation: "research_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunities_score_version_fkey"
      columns: ["score_version"]
isOneToOne: false
      referencedRelation: "scoring_configs"
      referencedColumns: ["version"]
    }
                  ]
                },"opportunity_scores": {
                  Row: {
                    "computed_at": string,"computed_by": string | null,"confidence": number,"explanation": NonNullable<Json>,"id": string,"input_snapshot": NonNullable<Json>,"is_complete": boolean,"opportunity_id": string,"score": number,"score_max": number,"score_min": number,"score_version": number,"stars": number
                  }
                  ComputedFields: never
                  Insert: {
                    "computed_at"?: string,"computed_by"?: string | null,"confidence": number,"explanation": NonNullable<Json>,"id"?: string,"input_snapshot": NonNullable<Json>,"is_complete": boolean,"opportunity_id": string,"score": number,"score_max": number,"score_min": number,"score_version": number,"stars": number
                  }
                  Update: {
                    "computed_at"?: string,"computed_by"?: string | null,"confidence"?: number,"explanation"?: NonNullable<Json>,"id"?: string,"input_snapshot"?: NonNullable<Json>,"is_complete"?: boolean,"opportunity_id"?: string,"score"?: number,"score_max"?: number,"score_min"?: number,"score_version"?: number,"stars"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "opportunity_scores_computed_by_fkey"
      columns: ["computed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunity_scores_opportunity_id_fkey"
      columns: ["opportunity_id"]
isOneToOne: false
      referencedRelation: "company_overview"
      referencedColumns: ["best_opportunity_id"]
    },{
      foreignKeyName: "opportunity_scores_opportunity_id_fkey"
      columns: ["opportunity_id"]
isOneToOne: false
      referencedRelation: "opportunities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "opportunity_scores_score_version_fkey"
      columns: ["score_version"]
isOneToOne: false
      referencedRelation: "scoring_configs"
      referencedColumns: ["version"]
    }
                  ]
                },"product_idea_decisions": {
                  Row: {
                    "created_at": string,"decided_by": string,"id": number,"new_status": Database["public"]['Enums']["approval_status"],"note": string | null,"previous_status": Database["public"]['Enums']["approval_status"],"product_idea_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"decided_by": string,"id"?: never,"new_status": Database["public"]['Enums']["approval_status"],"note"?: string | null,"previous_status": Database["public"]['Enums']["approval_status"],"product_idea_id": string
                  }
                  Update: {
                    "created_at"?: string,"decided_by"?: string,"id"?: never,"new_status"?: Database["public"]['Enums']["approval_status"],"note"?: string | null,"previous_status"?: Database["public"]['Enums']["approval_status"],"product_idea_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_idea_decisions_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_idea_decisions_product_idea_id_fkey"
      columns: ["product_idea_id"]
isOneToOne: false
      referencedRelation: "product_ideas"
      referencedColumns: ["id"]
    }
                  ]
                },"product_ideas": {
                  Row: {
                    "ai_model": string | null,"ai_provider": string | null,"approval_status": Database["public"]['Enums']["approval_status"],"created_at": string,"created_by": string,"decided_at": string | null,"decided_by": string | null,"decision_note": string | null,"description": string | null,"evidence": NonNullable<Json>,"expected_benefit": string | null,"id": string,"missing_information": string | null,"name": string,"normalized_name": string,"origin": Database["public"]['Enums']["idea_origin"],"problem_statement": string | null,"proposed_application": string | null,"research_session_id": string | null,"target_segment": string | null,"technical_constraints": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_model"?: string | null,"ai_provider"?: string | null,"approval_status"?: Database["public"]['Enums']["approval_status"],"created_at"?: string,"created_by"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"description"?: string | null,"evidence"?: NonNullable<Json>,"expected_benefit"?: string | null,"id"?: string,"missing_information"?: string | null,"name": string,"normalized_name": string,"origin": Database["public"]['Enums']["idea_origin"],"problem_statement"?: string | null,"proposed_application"?: string | null,"research_session_id"?: string | null,"target_segment"?: string | null,"technical_constraints"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "ai_model"?: string | null,"ai_provider"?: string | null,"approval_status"?: Database["public"]['Enums']["approval_status"],"created_at"?: string,"created_by"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"description"?: string | null,"evidence"?: NonNullable<Json>,"expected_benefit"?: string | null,"id"?: string,"missing_information"?: string | null,"name"?: string,"normalized_name"?: string,"origin"?: Database["public"]['Enums']["idea_origin"],"problem_statement"?: string | null,"proposed_application"?: string | null,"research_session_id"?: string | null,"target_segment"?: string | null,"technical_constraints"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_ideas_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_ideas_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_ideas_research_session_id_fkey"
      columns: ["research_session_id"]
isOneToOne: false
      referencedRelation: "research_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"production_settings": {
                  Row: {
                    "created_at": string,"created_by": string,"id": string,"settings": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"settings": NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"settings"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "production_settings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string,"is_active": boolean,"role": Database["public"]['Enums']["app_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"id": string,"is_active"?: boolean,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string,"is_active"?: boolean,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"research_session_results": {
                  Row: {
                    "company_id": string,"created_at": string,"id": number,"match_reason": string,"opportunity_id": string,"product_idea_id": string | null,"rank": number,"research_session_id": string,"source_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"created_at"?: string,"id"?: never,"match_reason": string,"opportunity_id": string,"product_idea_id"?: string | null,"rank": number,"research_session_id": string,"source_name": string
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"id"?: never,"match_reason"?: string,"opportunity_id"?: string,"product_idea_id"?: string | null,"rank"?: number,"research_session_id"?: string,"source_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "research_session_results_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "research_session_results_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "company_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "research_session_results_opportunity_id_fkey"
      columns: ["opportunity_id"]
isOneToOne: false
      referencedRelation: "company_overview"
      referencedColumns: ["best_opportunity_id"]
    },{
      foreignKeyName: "research_session_results_opportunity_id_fkey"
      columns: ["opportunity_id"]
isOneToOne: false
      referencedRelation: "opportunities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "research_session_results_product_idea_id_fkey"
      columns: ["product_idea_id"]
isOneToOne: false
      referencedRelation: "product_ideas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "research_session_results_research_session_id_fkey"
      columns: ["research_session_id"]
isOneToOne: false
      referencedRelation: "research_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"research_sessions": {
                  Row: {
                    "completed_at": string | null,"configuration_snapshot": NonNullable<Json>,"created_at": string,"created_by": string,"error_message": string | null,"filters": NonNullable<Json>,"id": string,"objective": string | null,"query": string,"radius_km": number | null,"reference_latitude": number | null,"reference_longitude": number | null,"region_label": string | null,"rerun_of": string | null,"research_type": Database["public"]['Enums']["research_type"],"started_at": string | null,"status": Database["public"]['Enums']["research_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"configuration_snapshot"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string,"error_message"?: string | null,"filters"?: NonNullable<Json>,"id"?: string,"objective"?: string | null,"query": string,"radius_km"?: number | null,"reference_latitude"?: number | null,"reference_longitude"?: number | null,"region_label"?: string | null,"rerun_of"?: string | null,"research_type": Database["public"]['Enums']["research_type"],"started_at"?: string | null,"status"?: Database["public"]['Enums']["research_status"],"updated_at"?: string
                  }
                  Update: {
                    "completed_at"?: string | null,"configuration_snapshot"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string,"error_message"?: string | null,"filters"?: NonNullable<Json>,"id"?: string,"objective"?: string | null,"query"?: string,"radius_km"?: number | null,"reference_latitude"?: number | null,"reference_longitude"?: number | null,"region_label"?: string | null,"rerun_of"?: string | null,"research_type"?: Database["public"]['Enums']["research_type"],"started_at"?: string | null,"status"?: Database["public"]['Enums']["research_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "research_sessions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "research_sessions_rerun_of_fkey"
      columns: ["rerun_of"]
isOneToOne: false
      referencedRelation: "research_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"research_source_runs": {
                  Row: {
                    "created_at": string,"error_message": string | null,"finished_at": string | null,"id": string,"request_metadata": NonNullable<Json>,"research_session_id": string,"results_count": number | null,"source_name": string,"started_at": string | null,"status": Database["public"]['Enums']["source_run_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"error_message"?: string | null,"finished_at"?: string | null,"id"?: string,"request_metadata"?: NonNullable<Json>,"research_session_id": string,"results_count"?: number | null,"source_name": string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["source_run_status"]
                  }
                  Update: {
                    "created_at"?: string,"error_message"?: string | null,"finished_at"?: string | null,"id"?: string,"request_metadata"?: NonNullable<Json>,"research_session_id"?: string,"results_count"?: number | null,"source_name"?: string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["source_run_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "research_source_runs_research_session_id_fkey"
      columns: ["research_session_id"]
isOneToOne: false
      referencedRelation: "research_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"score_breakdowns": {
                  Row: {
                    "criterion": string,"evidence": NonNullable<Json>,"id": string,"information_status": Database["public"]['Enums']["information_status"],"missing_data": NonNullable<Json>,"opportunity_score_id": string,"raw_score": number | null,"weight": number,"weighted_score": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "criterion": string,"evidence"?: NonNullable<Json>,"id"?: string,"information_status": Database["public"]['Enums']["information_status"],"missing_data"?: NonNullable<Json>,"opportunity_score_id": string,"raw_score"?: number | null,"weight": number,"weighted_score"?: number | null
                  }
                  Update: {
                    "criterion"?: string,"evidence"?: NonNullable<Json>,"id"?: string,"information_status"?: Database["public"]['Enums']["information_status"],"missing_data"?: NonNullable<Json>,"opportunity_score_id"?: string,"raw_score"?: number | null,"weight"?: number,"weighted_score"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "score_breakdowns_opportunity_score_id_fkey"
      columns: ["opportunity_score_id"]
isOneToOne: false
      referencedRelation: "opportunity_scores"
      referencedColumns: ["id"]
    }
                  ]
                },"scoring_configs": {
                  Row: {
                    "approval_state": string,"config": NonNullable<Json>,"created_at": string,"created_by": string | null,"is_active": boolean,"notes": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_state"?: string,"config": NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"is_active"?: boolean,"notes"?: string | null,"version": number
                  }
                  Update: {
                    "approval_state"?: string,"config"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"is_active"?: boolean,"notes"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "scoring_configs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"system_settings": {
                  Row: {
                    "key": string,"updated_at": string,"updated_by": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"updated_by"?: string,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"updated_by"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "system_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"system_settings_history": {
                  Row: {
                    "changed_at": string,"changed_by": string | null,"id": number,"key": string,"new_value": Json | null,"previous_value": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string | null,"id"?: never,"key": string,"new_value"?: Json | null,"previous_value"?: Json | null
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string | null,"id"?: never,"key"?: string,"new_value"?: Json | null,"previous_value"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "system_settings_history_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "company_overview": {
                  Row: {
                    "best_opportunity_id": string | null,"city": string | null,"cnpj": string | null,"commercial_status": string | null,"confidence": number | null,"created_at": string | null,"distance_km": number | null,"id": string | null,"last_verified_at": string | null,"latitude": number | null,"location_status": Database["public"]['Enums']["information_status"] | null,"longitude": number | null,"name": string | null,"neighborhood": string | null,"normalized_name": string | null,"opportunity_count": number | null,"phone": string | null,"product_name": string | null,"score": number | null,"segment": string | null,"source_count": number | null,"state": string | null,"updated_at": string | null,"website": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "opportunities_commercial_status_fkey"
      columns: ["commercial_status"]
isOneToOne: false
      referencedRelation: "commercial_statuses"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "opportunities_commercial_status_fkey"
      columns: ["commercial_status"]
isOneToOne: false
      referencedRelation: "opportunity_status_counts"
      referencedColumns: ["commercial_status"]
    }
                  ]
                },"opportunity_status_counts": {
                  Row: {
                    "category": string | null,"commercial_status": string | null,"label": string | null,"position": number | null,"total": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "activate_scoring_config":
{ Args: { "p_version": number }; Returns: undefined
                           },
"admin_list_members":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"display_name": string,"email": string,"id": string,"is_active": boolean,"role": Database["public"]['Enums']["app_role"]
            }[]
                           },
"admin_set_member_access":
{ Args: { "p_is_active": boolean,"p_role": Database["public"]['Enums']["app_role"],"p_user_id": string }; Returns: undefined
                           },
"change_opportunity_status":
{ Args: { "p_new_status": string,"p_note"?: string,"p_opportunity_id": string }; Returns: {
              "commercial_status": string,
"company_id": string,
"confidence": number | null,
"created_at": string,
"created_by": string,
"current_score_id": string | null,
"id": string,
"is_saved": boolean,
"product_idea_id": string | null,
"research_session_id": string | null,
"saved_at": string | null,
"score": number | null,
"score_is_complete": boolean | null,
"score_version": number | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "opportunities"
        isOneToOne: true
        isSetofReturn: false
      } },
"decide_product_idea":
{ Args: { "p_decision": Database["public"]['Enums']["approval_status"],"p_idea_id": string,"p_note"?: string }; Returns: {
              "ai_model": string | null,
"ai_provider": string | null,
"approval_status": Database["public"]['Enums']["approval_status"],
"created_at": string,
"created_by": string,
"decided_at": string | null,
"decided_by": string | null,
"decision_note": string | null,
"description": string | null,
"evidence": NonNullable<Json>,
"expected_benefit": string | null,
"id": string,
"missing_information": string | null,
"name": string,
"normalized_name": string,
"origin": Database["public"]['Enums']["idea_origin"],
"problem_statement": string | null,
"proposed_application": string | null,
"research_session_id": string | null,
"target_segment": string | null,
"technical_constraints": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "product_ideas"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_opportunity_saved":
{ Args: { "p_opportunity_id": string,"p_saved": boolean }; Returns: {
              "commercial_status": string,
"company_id": string,
"confidence": number | null,
"created_at": string,
"created_by": string,
"current_score_id": string | null,
"id": string,
"is_saved": boolean,
"product_idea_id": string | null,
"research_session_id": string | null,
"saved_at": string | null,
"score": number | null,
"score_is_complete": boolean | null,
"score_version": number | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "opportunities"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "activity_type": "status_change"|"note"|"contact"|"saved"|"unsaved"|"score_recalculated","app_role": "admin"|"member","approval_status": "pending"|"approved"|"rejected","idea_origin": "ai"|"manual","information_status": "confirmed"|"source_declared"|"ai_inference"|"unknown"|"outdated","research_status": "draft"|"awaiting_approval"|"ready"|"running"|"completed"|"partial"|"failed"|"cancelled","research_type": "segment"|"product","source_run_status": "pending"|"running"|"succeeded"|"failed"|"skipped"|"rate_limited"
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
  "public": {
          Enums: {
            "activity_type": ["status_change", "note", "contact", "saved", "unsaved", "score_recalculated"],"app_role": ["admin", "member"],"approval_status": ["pending", "approved", "rejected"],"idea_origin": ["ai", "manual"],"information_status": ["confirmed", "source_declared", "ai_inference", "unknown", "outdated"],"research_status": ["draft", "awaiting_approval", "ready", "running", "completed", "partial", "failed", "cancelled"],"research_type": ["segment", "product"],"source_run_status": ["pending", "running", "succeeded", "failed", "skipped", "rate_limited"]
          }
        }
} as const
