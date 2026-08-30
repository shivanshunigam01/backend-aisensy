/** ZentroFlow 2.0 — shared enums & defaults (SRS §5–13) */

const ROLES = [
  'super_admin',
  'ops_verifier',
  'client_admin',
  'client_manager',
  'client_executive',
  'auditor'
];

const TENANT_STATUSES = ['active', 'paused', 'churned', 'onboarding'];

const LEAD_STAGES = [
  'new',
  'valid',
  'invalid',
  'duplicate',
  'verification',
  'qualified',
  'nurture',
  'not_interested',
  'follow_up',
  'appointment',
  'test_drive',
  'quotation',
  'booking',
  'sale',
  'lost'
];

const VERIFICATION_STATUSES = ['pending', 'in_progress', 'verified', 'rejected', 'skipped'];
const QUALIFICATION_STATUSES = [
  'pending',
  'qualified',
  'warm_nurture',
  'not_interested',
  'invalid',
  'duplicate',
  'out_of_territory',
  'client_review'
];

const TEMPERATURES = ['hot', 'warm', 'cold'];

const SOURCE_CHANNELS = [
  'meta_instant_form',
  'landing_page',
  'website',
  'whatsapp_bot',
  'api',
  'csv_import',
  'manual',
  'ivr',
  'other'
];

const ACTIVITY_TYPES = [
  'lead_created',
  'stage_changed',
  'assigned',
  'remark',
  'followup_created',
  'followup_completed',
  'followup_overdue',
  'verification',
  'qualification',
  'communication',
  'call',
  'export',
  'system',
  'capi_enqueued',
  'integration'
];

const FOLLOWUP_STATUSES = ['open', 'done', 'cancelled', 'overdue'];
const FOLLOWUP_TYPES = ['call', 'whatsapp', 'email', 'visit', 'other'];

const JOB_STATUSES = ['pending', 'processing', 'succeeded', 'failed', 'dead'];
const JOB_TYPES = [
  'meta_lead_retrieve',
  'meta_reconcile',
  'capi_send',
  'whatsapp_send',
  'email_send',
  'dialer_enqueue',
  'automation_run',
  'notification'
];

const INTEGRATION_PROVIDERS = ['meta', 'whatsapp', 'email', 'voice', 'capi'];
const INTEGRATION_HEALTH = ['healthy', 'expiring', 'broken', 'unknown', 'not_configured'];

const CAPI_EVENT_STATUSES = ['queued', 'sending', 'succeeded', 'failed', 'dead'];

const DEFAULT_STAGES = LEAD_STAGES.map((key, i) => ({
  key,
  label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  order: i,
  active: true
}));

const DEFAULT_SCORE_RULES = [
  { id: 'purchase_7d', label: 'Purchase <= 7 days', points: 25, condition: { purchase_timeline: '7_days' } },
  { id: 'purchase_15d', label: 'Purchase <= 15 days', points: 20, condition: { purchase_timeline: '15_days' } },
  { id: 'test_drive', label: 'Requested test drive', points: 25, condition: { stage: 'test_drive' } },
  { id: 'quotation', label: 'Asked quotation', points: 20, condition: { stage: 'quotation' } },
  { id: 'bot_done', label: 'BOT qualification completed', points: 10, condition: { bot_qualified: true } },
  { id: 'verified_call', label: 'Answered verification call', points: 15, condition: { verification_status: 'verified' } },
  { id: 'invalid_phone', label: 'Invalid phone', points: -50, condition: { qualification_status: 'invalid' } }
];

module.exports = {
  ROLES,
  TENANT_STATUSES,
  LEAD_STAGES,
  VERIFICATION_STATUSES,
  QUALIFICATION_STATUSES,
  TEMPERATURES,
  SOURCE_CHANNELS,
  ACTIVITY_TYPES,
  FOLLOWUP_STATUSES,
  FOLLOWUP_TYPES,
  JOB_STATUSES,
  JOB_TYPES,
  INTEGRATION_PROVIDERS,
  INTEGRATION_HEALTH,
  CAPI_EVENT_STATUSES,
  DEFAULT_STAGES,
  DEFAULT_SCORE_RULES
};
