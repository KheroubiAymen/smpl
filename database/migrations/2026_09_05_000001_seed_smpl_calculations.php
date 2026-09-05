<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    private array $calculations = [
        [
            'name'            => 'smplPropagateIds',
            'execution_stage' => 'before',
            'script'          => <<<'PHP'
$this->error = false;
if (isset($this->data['smpl_id'])) {
    $this->data['smpl_sample_id']  = $this->data['smpl_id'];
    $this->data['smpl_kit_id']     = $this->data['smpl_id'];
    $this->data['smpl_case_id']    = $this->data['smpl_id'];
    $this->data['smpl_subject_id'] = $this->data['smpl_id'];
}
PHP,
        ],
        [
            'name'            => 'smplKitStatusInference',
            'execution_stage' => 'before',
            'script'          => <<<'PHP'
$sample = $this->getCurrentMode() === 'create' ? $this->data : $this->data + $this->getOldData();

if (isset($this->data['smpl_sample_status_fk']) && isset($sample['smpl_kit_fk'])) {
    $kit            = eqb()->entityType('SMPL_KIT')->where('id', '=', $sample['smpl_kit_fk'])->get()[0];
    $samples        = eqb()->entityType('SMPL_SAMPLE')->where('smpl_kit_fk', '=', $sample['smpl_kit_fk'])->get();
    $statuses       = eqb()->entityType('SMPL_STATUS')->get();
    $formattedStatuses        = array_column($statuses, 'smpl_label', 'smpl_status_seq_number');
    $statusIdToSeqNumber      = array_column($statuses, 'smpl_status_seq_number', 'id');
    $kitStatuses              = eqb()->entityType('SMPL_KIT_STATUS')->get();
    $kitStatusSeqNumberToId   = array_column($kitStatuses, 'id', 'smpl_seq_num');
    $mappedSamplesIndexed = [];
    foreach ($samples as $sample) {
        $statusId = $sample['smpl_sample_status_fk'] ?? null;
        $mappedSamplesIndexed[] = isset($statusIdToSeqNumber[$statusId]) ? $statusIdToSeqNumber[$statusId] : null;
    }
    if (empty($mappedSamplesIndexed)) return null;
    $uniqueValues = array_unique($mappedSamplesIndexed);
    sort($uniqueValues);
    $min = min($mappedSamplesIndexed);
    $max = max($mappedSamplesIndexed);
    if (count($uniqueValues) === 1 && $uniqueValues[0] === 3) {
        $this->data['smpl_id_nb'] = 5; $kit['smpl_kit_status'] = $kitStatusSeqNumberToId[5];
    } elseif ($max <= 3 && in_array(3, $mappedSamplesIndexed, true)) {
        $this->data['smpl_id_nb'] = 4; $kit['smpl_kit_status'] = $kitStatusSeqNumberToId[4];
    } elseif (count($uniqueValues) === 1 && $uniqueValues[0] === 2) {
        $this->data['smpl_id_nb'] = 3; $kit['smpl_kit_status'] = $kitStatusSeqNumberToId[3];
    } elseif ($max <= 2 && in_array(2, $mappedSamplesIndexed, true)) {
        $this->data['smpl_id_nb'] = 2; $kit['smpl_kit_status'] = $kitStatusSeqNumberToId[2];
    } elseif ($max <= 1 && in_array(1, $mappedSamplesIndexed, true)) {
        $this->data['smpl_id_nb'] = 1; $kit['smpl_kit_status'] = $kitStatusSeqNumberToId[1];
    } elseif ($max <= 0 && in_array(0, $mappedSamplesIndexed, true)) {
        $this->data['smpl_id_nb'] = 0; $kit['smpl_kit_status'] = $kitStatusSeqNumberToId[0];
    } elseif (count($uniqueValues) === 1 && $uniqueValues[0] === -1) {
        $this->data['smpl_id_nb'] = -1; $kit['smpl_kit_status'] = $kitStatusSeqNumberToId[-1];
    } elseif ($max < 0) {
        $this->data['smpl_id_nb'] = -2; $kit['smpl_kit_status'] = $kitStatusSeqNumberToId[-2];
    }
}
PHP,
        ],
        [
            'name'            => 'smplEventPropagation',
            'execution_stage' => 'after',
            'script'          => <<<'PHP'
use Didata\Entities\Repositories\Models\EntityType;
use Didata\Entities\Repositories\Models\Entity;

$event = $this->getCurrentMode() == 'create' ? $this->data : array_merge($this->getOldData(), $this->data);
$type  = EntityType::find($event['entitytype_id'])?->name;

$firstField = null;
$lastField  = null;
if ($type == 'SMPL_RECEPTION')       { $firstField = 'smpl_first_reception';      $lastField = 'smpl_last_reception'; }
elseif ($type == 'SMPL_TRANSPORTATION') { $firstField = 'smpl_first_transportation'; $lastField = 'smpl_last_transportation'; }
elseif ($type == 'SMPL_STORAGE')     { $firstField = 'smpl_first_storage';        $lastField = 'smpl_last_storage'; }
elseif ($type == 'SMPL_CENTRIFUGATION') { $firstField = 'smpl_first_centrifugation'; $lastField = 'smpl_last_centrifugation'; }
elseif ($type == 'SMPL_ANALYSIS')    { $firstField = 'smpl_first_analysis';       $lastField = 'smpl_last_analysis'; }
elseif ($type == 'SMPL_PROCESSING')  { $firstField = 'smpl_first_processing';     $lastField = 'smpl_last_processing'; }

if ($firstField !== null) {
    $samples = $event['smpl_samples_fk'];
    foreach ($samples as $sample) {
        $events     = eqb()->entityType($type)->where('smpl_samples_fk', 'contain', $sample)->orderby('smpl_event_start_time', 'asc')->get();
        $firstEvent = $events[0] ?? null;
        $lastEvent  = $events[count($events) - 1] ?? null;
        dac()->update('entity', Entity::find($sample), [
            $firstField => $firstEvent ? $firstEvent['id'] : null,
            $lastField  => $lastEvent  ? $lastEvent['id']  : null,
        ]);
    }
}
PHP,
        ],
    ];

    public function up(): void
    {
        foreach ($this->calculations as $calc) {
            $exists = \App\Models\Task::where('name', $calc['name'])->first();
            if ($exists) {
                continue;
            }
            \App\Models\Task::create([
                'name'            => $calc['name'],
                'resource_type'   => 'entity',
                'php_script'      => $calc['script'],
                'active'          => false,
                'execution_stage' => $calc['execution_stage'],
            ]);
        }
    }

    public function down(): void
    {
        $names = array_column($this->calculations, 'name');
        \App\Models\Task::whereIn('name', $names)->delete();
    }
};
