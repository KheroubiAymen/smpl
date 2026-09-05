<?php

namespace SwissDidata\Smpl;

use App\Services\ResourceService;
use Didata\Entities\Repositories\Models\EntityType;
use Didata\Entities\Repositories\Models\Fields\Field;
use Didata\Entitytypes\Services\EntityTypeService;
use Didata\Fields\Services\FieldService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SmplSchemaSeeder
{
    public function seed(): void
    {
        $idField = Field::where('name', 'id')->first();
        if (!$idField) {
            Log::warning('[SMPL] System id field not found — cannot seed entity schema');
            return;
        }

        $ets = [];
        foreach ($this->entityTypeDefinitions() as $def) {
            $et = $this->ensureEntityType($def['name'], $def['label'], $def['context'], $idField->id);
            if ($et) $ets[$def['name']] = $et;
        }

        $fields = [];
        foreach ($this->basicFieldDefinitions() as $def) {
            $f = $this->ensureBasicField($def['name'], $def['label'], $def['datatype']);
            if ($f) $fields[$def['name']] = $f;
        }

        foreach ($this->foreignFieldDefinitions() as $def) {
            if (!isset($ets[$def['target']])) continue;
            $f = $this->ensureForeignField($def['name'], $def['label'], $ets[$def['target']]->id, $def['multiple'] ?? false);
            if ($f) $fields[$def['name']] = $f;
        }

        foreach ($this->fieldAttachments() as [$etName, $fieldName]) {
            if (isset($ets[$etName]) && isset($fields[$fieldName])) {
                $this->attachField($ets[$etName], $fields[$fieldName]);
            }
        }

        Log::info('[SMPL] Entity schema seeding completed');
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function ensureEntityType(string $name, string $label, int $ctx, int $idFieldId): ?object
    {
        $existing = EntityType::where('name', $name)->first();
        if ($existing) return $existing;

        try {
            (new EntityTypeService([
                'context_id'     => $ctx,
                'name'           => $name,
                'label'          => $label,
                'is_system'      => 0,
                'fields'         => [['field_id' => $idFieldId]],
                'shown_field_id' => $idFieldId,
            ], ResourceService::CREATE_OPERATION))->consume();
            Log::info("[SMPL] Created entity type: $name");
        } catch (\Throwable $e) {
            Log::warning("[SMPL] Could not create entity type $name: " . $e->getMessage());
        }
        return EntityType::where('name', $name)->first();
    }

    private function ensureBasicField(string $name, string $label, string $datatype): ?object
    {
        $existing = Field::where('name', $name)->first();
        if ($existing) return $existing;

        try {
            (new FieldService([
                'name'         => $name,
                'label'        => $label,
                'fieldtype'    => 'BASIC',
                'datatype'     => $datatype,
                'is_system'    => 0,
                'tooltip_type' => 'static',
            ], ResourceService::CREATE_OPERATION))->consume();
            Log::info("[SMPL] Created basic field: $name");
        } catch (\Throwable $e) {
            Log::warning("[SMPL] Could not create basic field $name: " . $e->getMessage());
        }
        return Field::where('name', $name)->first();
    }

    private function ensureForeignField(string $name, string $label, int $targetId, bool $multiple): ?object
    {
        $existing = Field::where('name', $name)->first();
        if ($existing) return $existing;

        try {
            (new FieldService([
                'name'                 => $name,
                'label'                => $label,
                'fieldtype'            => 'FOREIGN',
                'target_entitytype_id' => $targetId,
                'multiple'             => $multiple,
                'is_system'            => 0,
                'tooltip_type'         => 'static',
            ], ResourceService::CREATE_OPERATION))->consume();
            Log::info("[SMPL] Created foreign field: $name");
        } catch (\Throwable $e) {
            Log::warning("[SMPL] Could not create foreign field $name: " . $e->getMessage());
        }
        return Field::where('name', $name)->first();
    }

    private function attachField(object $et, object $field): void
    {
        $etModel = EntityType::find($et->id);
        if (!$etModel) return;

        $current = DB::table('fieldentitytype')
            ->where('entitytype_id', $et->id)
            ->pluck('field_id')
            ->toArray();

        if (in_array($field->id, $current)) return;

        try {
            $all   = array_map(fn($id) => ['field_id' => $id], $current);
            $all[] = ['field_id' => $field->id];
            (new EntityTypeService(['fields' => $all], ResourceService::UPDATE_OPERATION, $etModel))->consume();
        } catch (\Throwable $e) {
            Log::warning("[SMPL] Could not attach {$field->name} to {$et->name}: " . $e->getMessage());
        }
    }

    // ─── Definitions ─────────────────────────────────────────────────────────

    private function entityTypeDefinitions(): array
    {
        return [
            ['name' => 'SMPL_STUDY',         'label' => 'Study',         'context' => 1],
            ['name' => 'SMPL_STATUS',         'label' => 'Sample Status', 'context' => 1],
            ['name' => 'SMPL_KIT_STATUS',     'label' => 'Kit Status',    'context' => 1],
            ['name' => 'SMPL_EVENT_TYPE',     'label' => 'Event Type',    'context' => 1],
            ['name' => 'SMPL_ID_GENERATOR',   'label' => 'ID Generator',  'context' => 1],
            ['name' => 'SMPL_WORKFLOW',       'label' => 'Workflow',      'context' => 1],
            ['name' => 'SMPL_WORKFLOW_LINE',  'label' => 'Workflow Line', 'context' => 1],
            ['name' => 'SMPL_WORKFLOW_STEP',  'label' => 'Workflow Step', 'context' => 1],
            ['name' => 'SMPL_CASE_TYPE',      'label' => 'Case Type',     'context' => 1],
            ['name' => 'SMPL_SUBJECT',        'label' => 'Subject',       'context' => 1],
            ['name' => 'SMPL_CASE',           'label' => 'Case',          'context' => 1],
            ['name' => 'SMPL_KIT',            'label' => 'Kit',           'context' => 1],
            ['name' => 'SMPL_SAMPLE',         'label' => 'Sample',        'context' => 1],
            ['name' => 'SMPL_EVENT',          'label' => 'Event',         'context' => 1],
            ['name' => 'SMPL_CREATION',       'label' => 'Creation',      'context' => 1],
        ];
    }

    private function basicFieldDefinitions(): array
    {
        return [
            // Shared
            ['name' => 'smpl_label',                      'label' => 'Label',               'datatype' => 'SHORT_TEXT'],
            ['name' => 'smpl_order',                      'label' => 'Order',               'datatype' => 'WHOLE_NUMBER'],
            ['name' => 'smpl_id',                         'label' => 'SMPL ID',             'datatype' => 'SHORT_TEXT'],
            // Status
            ['name' => 'smpl_status_is_active',           'label' => 'Is Active',           'datatype' => 'BOOL'],
            ['name' => 'smpl_status_seq_number',          'label' => 'Seq Number',          'datatype' => 'WHOLE_NUMBER'],
            // Kit status
            ['name' => 'smpl_seq_num',                    'label' => 'Seq Num',             'datatype' => 'WHOLE_NUMBER'],
            // Event type
            ['name' => 'smpl_template_form_id',           'label' => 'Template Form',       'datatype' => 'WHOLE_NUMBER'],
            ['name' => 'smpl_yields_derivative',          'label' => 'Yields Derivative',   'datatype' => 'BOOL'],
            ['name' => 'smpl_is_alias',                   'label' => 'Is Alias',            'datatype' => 'BOOL'],
            // ID generator
            ['name' => 'smpl_id_generator_mask',          'label' => 'ID Mask',             'datatype' => 'SHORT_TEXT'],
            ['name' => 'smpl_id_generator_nb_length',     'label' => 'Number Length',       'datatype' => 'WHOLE_NUMBER'],
            ['name' => 'smpl_id_generator_separator',     'label' => 'Separator',           'datatype' => 'SHORT_TEXT'],
            // Workflow
            ['name' => 'smpl_workflow_uses_cases',        'label' => 'Uses Cases',          'datatype' => 'BOOL'],
            ['name' => 'smpl_workflow_uses_kits',         'label' => 'Uses Kits',           'datatype' => 'BOOL'],
            ['name' => 'smpl_workflow_is_collection',     'label' => 'Is Collection',       'datatype' => 'BOOL'],
            ['name' => 'smpl_workflow_show_hierarchy',    'label' => 'Show Hierarchy',      'datatype' => 'BOOL'],
            ['name' => 'smpl_workflow_subject_form_id',   'label' => 'Subject Form',        'datatype' => 'WHOLE_NUMBER'],
            ['name' => 'smpl_workflow_case_form_id',      'label' => 'Case Form',           'datatype' => 'WHOLE_NUMBER'],
            ['name' => 'smpl_workflow_kit_form_id',       'label' => 'Kit Form',            'datatype' => 'WHOLE_NUMBER'],
            ['name' => 'smpl_workflow_collection_form_id','label' => 'Collection Form',     'datatype' => 'WHOLE_NUMBER'],
            ['name' => 'smpl_sample_creation_form_id',   'label' => 'Sample Creation Form','datatype' => 'WHOLE_NUMBER'],
            // Workflow line
            ['name' => 'smpl_workflow_line_is_kit',       'label' => 'Is Kit Line',         'datatype' => 'BOOL'],
            ['name' => 'smpl_workflow_line_color',        'label' => 'Color',               'datatype' => 'SHORT_TEXT'],
            ['name' => 'smpl_workflow_line_quantity',     'label' => 'Quantity',            'datatype' => 'WHOLE_NUMBER'],
            // Workflow step
            ['name' => 'smpl_workflow_step_is_batch',     'label' => 'Is Batch',            'datatype' => 'BOOL'],
            ['name' => 'smpl_workflow_step_form_id',      'label' => 'Step Form',           'datatype' => 'WHOLE_NUMBER'],
            ['name' => 'smpl_workflow_step_is_optional',  'label' => 'Is Optional',         'datatype' => 'BOOL'],
            ['name' => 'smpl_workflow_step_then',         'label' => 'Then',                'datatype' => 'SHORT_TEXT'],
            ['name' => 'smpl_workflow_step_is_repeatable','label' => 'Is Repeatable',       'datatype' => 'BOOL'],
            ['name' => 'Custom_View_ID_Step',             'label' => 'Custom View ID',      'datatype' => 'WHOLE_NUMBER'],
            // Case type
            ['name' => 'smpl_case_type_label',            'label' => 'Case Type Label',     'datatype' => 'SHORT_TEXT'],
            // Sample IDs
            ['name' => 'smpl_id_stem',                    'label' => 'ID Stem',             'datatype' => 'SHORT_TEXT'],
            ['name' => 'smpl_id_nb',                      'label' => 'ID Number',           'datatype' => 'WHOLE_NUMBER'],
            ['name' => 'smpl_sample_id',                  'label' => 'Sample ID',           'datatype' => 'SHORT_TEXT'],
            ['name' => 'smpl_kit_id',                     'label' => 'Kit ID',              'datatype' => 'SHORT_TEXT'],
            ['name' => 'smpl_case_id',                    'label' => 'Case ID',             'datatype' => 'SHORT_TEXT'],
            ['name' => 'smpl_subject_id',                 'label' => 'Subject ID',          'datatype' => 'SHORT_TEXT'],
            // Kit
            ['name' => 'smpl_kit_is_real',                'label' => 'Is Real Kit',         'datatype' => 'BOOL'],
            // Event
            ['name' => 'smpl_event_start_time',           'label' => 'Event Start Time',    'datatype' => 'DATETIME'],
            // Creation
            ['name' => 'smpl_barcodes',                   'label' => 'Barcodes',            'datatype' => 'LONG_TEXT'],
        ];
    }

    private function foreignFieldDefinitions(): array
    {
        return [
            // → SMPL_STUDY
            ['name' => 'smpl_study_fk',                    'label' => 'Study',            'target' => 'SMPL_STUDY',         'multiple' => false],
            // → SMPL_WORKFLOW
            ['name' => 'smpl_workflow_fk',                 'label' => 'Workflow',         'target' => 'SMPL_WORKFLOW',      'multiple' => true],
            // → SMPL_WORKFLOW_LINE
            ['name' => 'smpl_workflow_line_fk',            'label' => 'Workflow Line',    'target' => 'SMPL_WORKFLOW_LINE', 'multiple' => false],
            ['name' => 'smpl_workflow_lines_fk',           'label' => 'Workflow Lines',   'target' => 'SMPL_WORKFLOW_LINE', 'multiple' => true],
            // → SMPL_WORKFLOW_STEP (including self-refs)
            ['name' => 'smpl_workflow_step_fk',            'label' => 'Workflow Step',    'target' => 'SMPL_WORKFLOW_STEP', 'multiple' => false],
            ['name' => 'smpl_workflow_step_batch_fk',      'label' => 'Batch Step',       'target' => 'SMPL_WORKFLOW_STEP', 'multiple' => false],
            ['name' => 'smpl_workflow_step_goto_fk',       'label' => 'Go To Step',       'target' => 'SMPL_WORKFLOW_STEP', 'multiple' => false],
            // → SMPL_EVENT_TYPE
            ['name' => 'smpl_event_type_fk',               'label' => 'Event Type',       'target' => 'SMPL_EVENT_TYPE',    'multiple' => false],
            // → SMPL_STATUS
            ['name' => 'smpl_sample_status_fk',            'label' => 'Sample Status',    'target' => 'SMPL_STATUS',        'multiple' => false],
            ['name' => 'smpl_workflow_step_status_change_fk','label' => 'Status Change',  'target' => 'SMPL_STATUS',        'multiple' => false],
            // → SMPL_KIT_STATUS
            ['name' => 'smpl_kit_status_fk',               'label' => 'Kit Status',       'target' => 'SMPL_KIT_STATUS',    'multiple' => false],
            // → SMPL_ID_GENERATOR
            ['name' => 'smpl_id_gen_fk',                   'label' => 'ID Generator',     'target' => 'SMPL_ID_GENERATOR',  'multiple' => false],
            ['name' => 'smpl_subject_id_gen_fk',           'label' => 'Subject ID Gen',   'target' => 'SMPL_ID_GENERATOR',  'multiple' => false],
            ['name' => 'smpl_case_id_gen_fk',              'label' => 'Case ID Gen',      'target' => 'SMPL_ID_GENERATOR',  'multiple' => false],
            ['name' => 'smpl_kit_id_gen_fk',               'label' => 'Kit ID Gen',       'target' => 'SMPL_ID_GENERATOR',  'multiple' => false],
            // → SMPL_CASE_TYPE
            ['name' => 'smpl_case_type_fk',                'label' => 'Case Type',        'target' => 'SMPL_CASE_TYPE',     'multiple' => false],
            ['name' => 'smpl_case_type_workflow_fk',       'label' => 'Case Types',       'target' => 'SMPL_CASE_TYPE',     'multiple' => true],
            // → SMPL_SUBJECT
            ['name' => 'smpl_subject_fk',                  'label' => 'Subject',          'target' => 'SMPL_SUBJECT',       'multiple' => false],
            // → SMPL_CASE
            ['name' => 'smpl_case_fk',                     'label' => 'Case',             'target' => 'SMPL_CASE',          'multiple' => false],
            // → SMPL_KIT
            ['name' => 'smpl_kit_fk',                      'label' => 'Kit',              'target' => 'SMPL_KIT',           'multiple' => false],
            // → SMPL_SAMPLE (self-refs)
            ['name' => 'smpl_sample_fk',                   'label' => 'Parent Sample',    'target' => 'SMPL_SAMPLE',        'multiple' => false],
            ['name' => 'smpl_samples_fk',                  'label' => 'Samples',          'target' => 'SMPL_SAMPLE',        'multiple' => true],
            // → SMPL_EVENT
            ['name' => 'smpl_events_fk',                   'label' => 'Events',           'target' => 'SMPL_EVENT',         'multiple' => true],
            ['name' => 'smpl_first_reception',             'label' => 'First Reception',  'target' => 'SMPL_EVENT',         'multiple' => false],
            ['name' => 'smpl_last_reception',              'label' => 'Last Reception',   'target' => 'SMPL_EVENT',         'multiple' => false],
            ['name' => 'smpl_first_transportation',        'label' => 'First Transport',  'target' => 'SMPL_EVENT',         'multiple' => false],
            ['name' => 'smpl_last_transportation',         'label' => 'Last Transport',   'target' => 'SMPL_EVENT',         'multiple' => false],
            ['name' => 'smpl_first_storage',               'label' => 'First Storage',    'target' => 'SMPL_EVENT',         'multiple' => false],
            ['name' => 'smpl_last_storage',                'label' => 'Last Storage',     'target' => 'SMPL_EVENT',         'multiple' => false],
            ['name' => 'smpl_first_centrifugation',        'label' => 'First Centrifug.', 'target' => 'SMPL_EVENT',         'multiple' => false],
            ['name' => 'smpl_last_centrifugation',         'label' => 'Last Centrifug.',  'target' => 'SMPL_EVENT',         'multiple' => false],
            ['name' => 'smpl_first_analysis',              'label' => 'First Analysis',   'target' => 'SMPL_EVENT',         'multiple' => false],
            ['name' => 'smpl_last_analysis',               'label' => 'Last Analysis',    'target' => 'SMPL_EVENT',         'multiple' => false],
            ['name' => 'smpl_first_processing',            'label' => 'First Processing', 'target' => 'SMPL_EVENT',         'multiple' => false],
            ['name' => 'smpl_last_processing',             'label' => 'Last Processing',  'target' => 'SMPL_EVENT',         'multiple' => false],
        ];
    }

    private function fieldAttachments(): array
    {
        return [
            // SMPL_STUDY
            ['SMPL_STUDY', 'smpl_label'],

            // SMPL_STATUS
            ['SMPL_STATUS', 'smpl_label'],
            ['SMPL_STATUS', 'smpl_status_is_active'],
            ['SMPL_STATUS', 'smpl_status_seq_number'],

            // SMPL_KIT_STATUS
            ['SMPL_KIT_STATUS', 'smpl_label'],
            ['SMPL_KIT_STATUS', 'smpl_seq_num'],

            // SMPL_EVENT_TYPE
            ['SMPL_EVENT_TYPE', 'smpl_label'],
            ['SMPL_EVENT_TYPE', 'smpl_template_form_id'],
            ['SMPL_EVENT_TYPE', 'smpl_yields_derivative'],
            ['SMPL_EVENT_TYPE', 'smpl_is_alias'],

            // SMPL_ID_GENERATOR
            ['SMPL_ID_GENERATOR', 'smpl_id_generator_mask'],
            ['SMPL_ID_GENERATOR', 'smpl_id_generator_nb_length'],
            ['SMPL_ID_GENERATOR', 'smpl_id_generator_separator'],

            // SMPL_WORKFLOW
            ['SMPL_WORKFLOW', 'smpl_label'],
            ['SMPL_WORKFLOW', 'smpl_study_fk'],
            ['SMPL_WORKFLOW', 'smpl_workflow_uses_cases'],
            ['SMPL_WORKFLOW', 'smpl_workflow_uses_kits'],
            ['SMPL_WORKFLOW', 'smpl_workflow_is_collection'],
            ['SMPL_WORKFLOW', 'smpl_workflow_show_hierarchy'],
            ['SMPL_WORKFLOW', 'smpl_workflow_subject_form_id'],
            ['SMPL_WORKFLOW', 'smpl_workflow_case_form_id'],
            ['SMPL_WORKFLOW', 'smpl_workflow_kit_form_id'],
            ['SMPL_WORKFLOW', 'smpl_workflow_collection_form_id'],
            ['SMPL_WORKFLOW', 'smpl_sample_creation_form_id'],
            ['SMPL_WORKFLOW', 'smpl_subject_id_gen_fk'],
            ['SMPL_WORKFLOW', 'smpl_case_id_gen_fk'],
            ['SMPL_WORKFLOW', 'smpl_kit_id_gen_fk'],
            ['SMPL_WORKFLOW', 'smpl_case_type_workflow_fk'],

            // SMPL_WORKFLOW_LINE
            ['SMPL_WORKFLOW_LINE', 'smpl_label'],
            ['SMPL_WORKFLOW_LINE', 'smpl_order'],
            ['SMPL_WORKFLOW_LINE', 'smpl_workflow_fk'],
            ['SMPL_WORKFLOW_LINE', 'smpl_workflow_line_fk'],
            ['SMPL_WORKFLOW_LINE', 'smpl_id_gen_fk'],
            ['SMPL_WORKFLOW_LINE', 'smpl_workflow_line_is_kit'],
            ['SMPL_WORKFLOW_LINE', 'smpl_workflow_line_color'],
            ['SMPL_WORKFLOW_LINE', 'smpl_workflow_line_quantity'],

            // SMPL_WORKFLOW_STEP
            ['SMPL_WORKFLOW_STEP', 'smpl_label'],
            ['SMPL_WORKFLOW_STEP', 'smpl_order'],
            ['SMPL_WORKFLOW_STEP', 'smpl_workflow_fk'],
            ['SMPL_WORKFLOW_STEP', 'smpl_workflow_line_fk'],
            ['SMPL_WORKFLOW_STEP', 'smpl_event_type_fk'],
            ['SMPL_WORKFLOW_STEP', 'smpl_workflow_step_is_batch'],
            ['SMPL_WORKFLOW_STEP', 'smpl_workflow_step_batch_fk'],
            ['SMPL_WORKFLOW_STEP', 'smpl_workflow_step_form_id'],
            ['SMPL_WORKFLOW_STEP', 'smpl_workflow_step_is_optional'],
            ['SMPL_WORKFLOW_STEP', 'smpl_workflow_step_then'],
            ['SMPL_WORKFLOW_STEP', 'smpl_workflow_step_goto_fk'],
            ['SMPL_WORKFLOW_STEP', 'smpl_workflow_step_is_repeatable'],
            ['SMPL_WORKFLOW_STEP', 'smpl_sample_status_fk'],
            ['SMPL_WORKFLOW_STEP', 'smpl_workflow_step_status_change_fk'],
            ['SMPL_WORKFLOW_STEP', 'Custom_View_ID_Step'],

            // SMPL_CASE_TYPE
            ['SMPL_CASE_TYPE', 'smpl_label'],
            ['SMPL_CASE_TYPE', 'smpl_case_type_label'],
            ['SMPL_CASE_TYPE', 'smpl_workflow_fk'],
            ['SMPL_CASE_TYPE', 'smpl_workflow_lines_fk'],

            // SMPL_SUBJECT
            ['SMPL_SUBJECT', 'smpl_id'],
            ['SMPL_SUBJECT', 'smpl_subject_id'],

            // SMPL_CASE
            ['SMPL_CASE', 'smpl_id'],
            ['SMPL_CASE', 'smpl_case_id'],
            ['SMPL_CASE', 'smpl_case_type_fk'],
            ['SMPL_CASE', 'smpl_subject_fk'],

            // SMPL_KIT
            ['SMPL_KIT', 'smpl_id'],
            ['SMPL_KIT', 'smpl_kit_id'],
            ['SMPL_KIT', 'smpl_kit_is_real'],
            ['SMPL_KIT', 'smpl_study_fk'],
            ['SMPL_KIT', 'smpl_kit_status_fk'],
            ['SMPL_KIT', 'smpl_subject_fk'],
            ['SMPL_KIT', 'smpl_case_fk'],

            // SMPL_SAMPLE
            ['SMPL_SAMPLE', 'smpl_id'],
            ['SMPL_SAMPLE', 'smpl_id_stem'],
            ['SMPL_SAMPLE', 'smpl_id_nb'],
            ['SMPL_SAMPLE', 'smpl_sample_id'],
            ['SMPL_SAMPLE', 'smpl_kit_id'],
            ['SMPL_SAMPLE', 'smpl_case_id'],
            ['SMPL_SAMPLE', 'smpl_subject_id'],
            ['SMPL_SAMPLE', 'smpl_order'],
            ['SMPL_SAMPLE', 'smpl_study_fk'],
            ['SMPL_SAMPLE', 'smpl_workflow_fk'],
            ['SMPL_SAMPLE', 'smpl_workflow_line_fk'],
            ['SMPL_SAMPLE', 'smpl_workflow_step_fk'],
            ['SMPL_SAMPLE', 'smpl_sample_status_fk'],
            ['SMPL_SAMPLE', 'smpl_kit_fk'],
            ['SMPL_SAMPLE', 'smpl_case_fk'],
            ['SMPL_SAMPLE', 'smpl_subject_fk'],
            ['SMPL_SAMPLE', 'smpl_sample_fk'],
            ['SMPL_SAMPLE', 'smpl_events_fk'],
            ['SMPL_SAMPLE', 'smpl_first_reception'],
            ['SMPL_SAMPLE', 'smpl_last_reception'],
            ['SMPL_SAMPLE', 'smpl_first_transportation'],
            ['SMPL_SAMPLE', 'smpl_last_transportation'],
            ['SMPL_SAMPLE', 'smpl_first_storage'],
            ['SMPL_SAMPLE', 'smpl_last_storage'],
            ['SMPL_SAMPLE', 'smpl_first_centrifugation'],
            ['SMPL_SAMPLE', 'smpl_last_centrifugation'],
            ['SMPL_SAMPLE', 'smpl_first_analysis'],
            ['SMPL_SAMPLE', 'smpl_last_analysis'],
            ['SMPL_SAMPLE', 'smpl_first_processing'],
            ['SMPL_SAMPLE', 'smpl_last_processing'],

            // SMPL_EVENT
            ['SMPL_EVENT', 'smpl_event_start_time'],
            ['SMPL_EVENT', 'smpl_event_type_fk'],
            ['SMPL_EVENT', 'smpl_workflow_step_fk'],
            ['SMPL_EVENT', 'smpl_samples_fk'],
            ['SMPL_EVENT', 'smpl_kit_fk'],
            ['SMPL_EVENT', 'smpl_subject_fk'],
            ['SMPL_EVENT', 'smpl_case_fk'],

            // SMPL_CREATION
            ['SMPL_CREATION', 'smpl_workflow_line_fk'],
            ['SMPL_CREATION', 'smpl_workflow_line_quantity'],
            ['SMPL_CREATION', 'smpl_barcodes'],
        ];
    }
}
