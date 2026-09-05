<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\UserRoute;
use App\Services\UserRoutes\UserRouteService;
use App\Services\ResourceService;

return new class extends Migration
{
    private array $routes = [
        [
            'name'       => 'smpl_get_all_workflows',
            'type'       => 'GET',
            'is_enabled' => true,
            'is_public'  => false,
            'sub_path'   => 'smpl_get_all_workflows',
            'code'       => <<<'PHP'
$project_id = $this->request->projectId;
$workflows = eqb()->project($project_id)->entityType('SMPL_WORKFLOW')->get();
foreach ($workflows as &$workflow) {
    $study = eqb()->project($project_id)->entityType('SMPL_STUDY')->where('id', '=', $workflow['smpl_study_fk'])->get();
    $workflow['study'] = $study[0]['smpl_label'] ?? null;
}
unset($workflow);
$this->response->setResponseHeaders(['content-type' => 'application/json']);
$this->response->setResponseContent(json_encode($workflows));
PHP,
        ],
        [
            'name'       => 'smpl_load_workflow',
            'type'       => 'GET',
            'is_enabled' => true,
            'is_public'  => false,
            'sub_path'   => 'smpl_load_workflow',
            'code'       => <<<'PHP'
function smplSortByOrder($a, $b) {
    return $a['smpl_order'] <=> $b['smpl_order'];
}
function smplGetChildLines($parentId, $project_id) {
    $children = eqb()->project($project_id)->entityType('SMPL_WORKFLOW_LINE')->where('smpl_workflow_line_fk', '=', $parentId)->get();
    foreach ($children as $child) {
        $children = array_merge($children, smplGetChildLines($child['id'], $project_id));
    }
    return $children;
}
$project_id = $this->request->projectId;
$wfid = $this->request->workflowId;
$ctid = $this->request->caseTypeId;
$workflow = eqb()->project($project_id)->entityType('SMPL_WORKFLOW')->where('id', '=', $wfid)->get()[0];
$study = eqb()->project($project_id)->entityType('SMPL_STUDY')->where('id', '=', $workflow['smpl_study_fk'])->get();
$lines = [];
if ($ctid) {
    $lineIds = eqb()->project($project_id)->entityType('SMPL_CASE_TYPE')->where('id', '=', $ctid)->get()[0]['smpl_workflow_lines_fk'];
    foreach ($lineIds as $lineId) {
        $lines[] = eqb()->project($project_id)->entityType('SMPL_WORKFLOW_LINE')->where('id', '=', $lineId)->get()[0];
        $lines = array_merge($lines, smplGetChildLines($lineId, $project_id));
    }
} else {
    $lines = eqb()->project($project_id)->entityType('SMPL_WORKFLOW_LINE')->where('smpl_workflow_fk', '=', $wfid)->get();
}
usort($lines, 'smplSortByOrder');
$workflow['lines']      = $lines;
$workflow['study']      = $study[0]['smpl_label'] ?? null;
$workflow['idgen']      = eqb()->project($project_id)->entityType('SMPL_ID_GENERATOR')->get();
$workflow['caseTypes']  = eqb()->project($project_id)->entityType('SMPL_CASE_TYPE')->where('smpl_workflow_fk', '=', $wfid)->get();
$workflow['eventTypes'] = eqb()->project($project_id)->entityType('SMPL_EVENT_TYPE')->get();
foreach ($workflow['lines'] as &$line) {
    $steps = eqb()->project($project_id)->entityType('SMPL_WORKFLOW_STEP')->where('smpl_workflow_line_fk', '=', $line['id'])->get();
    usort($steps, 'smplSortByOrder');
    foreach ($steps as &$step) {
        $eventType = eqb()->entityType('SMPL_EVENT_TYPE')->where('id', '=', $step['smpl_event_type_fk'])->get()[0];
        $step['type'] = $eventType['smpl_label'];
    }
    unset($step);
    $line['steps'] = $steps;
}
unset($line);
$allSteps = eqb()->project($project_id)->entityType('SMPL_WORKFLOW_STEP')->where('smpl_workflow_fk', '=', $wfid)->get();
$batches = array_values(array_filter($allSteps, function ($s) { return !empty($s['smpl_workflow_step_is_batch']); }));
foreach ($batches as &$batch) {
    $eventType = eqb()->entityType('SMPL_EVENT_TYPE')->where('id', '=', $batch['smpl_event_type_fk'])->get()[0];
    $batch['type'] = $eventType['smpl_label'];
    $steps = eqb()->project($project_id)->entityType('SMPL_WORKFLOW_STEP')->where('smpl_workflow_step_batch_fk', '=', $batch['id'])->get();
    $steps = array_values(array_filter($steps, function ($step) use ($workflow) {
        return is_numeric(array_search($step['smpl_workflow_line_fk'], array_column($workflow['lines'], 'id')));
    }));
    foreach ($steps as &$step) {
        $eventType = eqb()->entityType('SMPL_EVENT_TYPE')->where('id', '=', $step['smpl_event_type_fk'])->get()[0];
        $step['type'] = $eventType['smpl_label'];
    }
    unset($step);
    $batch['steps'] = $steps;
}
unset($batch);
$workflow['batches']  = $batches;
$workflow['statuses'] = eqb()->project($project_id)->entityType('SMPL_STATUS')->get();
$this->response->setResponseHeaders(['content-type' => 'application/json']);
$this->response->setResponseContent(json_encode($workflow));
PHP,
        ],
        [
            'name'       => 'smpl_get_entity_by_barcode',
            'type'       => 'GET',
            'is_enabled' => true,
            'is_public'  => false,
            'sub_path'   => 'smpl_get_entity_by_barcode',
            'code'       => <<<'PHP'
$project_id = $this->request->projectId;
$barcode = $this->request->barcode;
$this->response->setResponseHeaders(['content-type' => 'application/json']);
$samples = eqb()->project($project_id)->entityType('SMPL_SAMPLE')->where('BARCODE', '=', $barcode)->get();
if ($samples) { $this->response->setResponseContent(json_encode($samples)); return; }
$kit = eqb()->project($project_id)->entityType('SMPL_KIT')->where('BARCODE', '=', $barcode)->get();
if ($kit) { $this->response->setResponseContent(json_encode($kit)); return; }
$case = eqb()->project($project_id)->entityType('SMPL_CASE')->where('BARCODE', '=', $barcode)->get();
if ($case) { $this->response->setResponseContent(json_encode($case)); return; }
$subject = eqb()->project($project_id)->entityType('SMPL_SUBJECT')->where('BARCODE', '=', $barcode)->get();
$this->response->setResponseContent(json_encode($subject ?: []));
PHP,
        ],
        [
            'name'       => 'smpl_get_samples_by_steps',
            'type'       => 'GET',
            'is_enabled' => true,
            'is_public'  => false,
            'sub_path'   => 'smpl_get_samples_by_steps',
            'code'       => <<<'PHP'
$project_id = $this->request->projectId;
$choiceId = $this->request->choice;
$steps = $this->request->steps;
$allsamples = [];
foreach ($steps as $id) {
    if ($choiceId) {
        $samples = eqb()->project($project_id)->entityType('SMPL_SAMPLE')->where('smpl_sample_status_fk', '=', $choiceId)->where('smpl_workflow_step_fk', '=', $id)->get();
    } else {
        $samples = eqb()->project($project_id)->entityType('SMPL_SAMPLE')->where('smpl_workflow_step_fk', '=', $id)->get();
    }
    foreach ($samples as $sample) {
        $allsamples[] = $sample;
    }
}
$this->response->setResponseHeaders(['content-type' => 'application/json']);
$this->response->setResponseContent(json_encode($allsamples));
PHP,
        ],
        [
            'name'       => 'smpl_get_samples_by_kit',
            'type'       => 'GET',
            'is_enabled' => true,
            'is_public'  => false,
            'sub_path'   => 'smpl_get_samples_by_kit',
            'code'       => <<<'PHP'
$kit = $this->request->kit;
$samples = eqb()->entityType('SMPL_SAMPLE')->where('smpl_kit_fk', '=', $kit)->get();
$this->response->setResponseHeaders(['content-type' => 'application/json']);
$this->response->setResponseContent(json_encode($samples));
PHP,
        ],
        [
            'name'       => 'smpl_get_sample_counts',
            'type'       => 'GET',
            'is_enabled' => true,
            'is_public'  => false,
            'sub_path'   => 'smpl_get_sample_counts',
            'code'       => <<<'PHP'
$project_id = $this->request->projectId;
$stepid = $this->request->stepId;
$subject = $this->request->subject;
$casus = $this->request->casus;
$kit = $this->request->kit;
$counts = [];
if ($stepid) {
    foreach ($stepid as $id) { $counts[$id] = []; }
    $statuses = eqb()->project($project_id)->entityType('SMPL_STATUS')->get();
    $activeStatuses = array_values(array_filter($statuses, function ($s) { return $s['smpl_status_is_active']; }));
    if (!empty($activeStatuses)) {
        $activeStatusIds = array_column($activeStatuses, 'id');
        $statusById = [];
        foreach ($activeStatuses as $s) { $statusById[$s['id']] = $s; }
        $query = eqb()->project($project_id)->entityType('SMPL_SAMPLE')
            ->select(['smpl_workflow_step_fk', 'smpl_sample_status_fk'])
            ->where('smpl_workflow_step_fk', 'in', $stepid)
            ->where('smpl_sample_status_fk', 'in', $activeStatusIds);
        if ($kit)     { $query->whereBracket(function ($q) use ($kit)     { $q->where('smpl_kit_fk',     'in', $kit)->orWhere('smpl_kit_fk',     'has not', null); }); }
        if ($casus)   { $query->whereBracket(function ($q) use ($casus)   { $q->where('smpl_case_fk',    'in', $casus)->orWhere('smpl_case_fk',  'has not', null); }); }
        if ($subject) { $query->whereBracket(function ($q) use ($subject) { $q->where('smpl_subject_fk', 'in', $subject)->orWhere('smpl_subject_fk', 'has not', null); }); }
        foreach ($query->get() as $sample) {
            $sk = $sample['smpl_workflow_step_fk'];
            $tk = $sample['smpl_sample_status_fk'];
            if (!isset($counts[$sk]) || !isset($statusById[$tk])) continue;
            $found = false;
            foreach ($counts[$sk] as &$entry) {
                if ($entry['status']['id'] == $tk) { $entry['count']++; $found = true; break; }
            }
            unset($entry);
            if (!$found) { $counts[$sk][] = ['status' => $statusById[$tk], 'count' => 1]; }
        }
    }
}
$this->response->setResponseHeaders(['content-type' => 'application/json']);
$this->response->setResponseContent(json_encode($counts));
PHP,
        ],
        [
            'name'       => 'smpl_generate_id',
            'type'       => 'POST',
            'is_enabled' => true,
            'is_public'  => false,
            'sub_path'   => 'smpl_generate_id',
            'code'       => <<<'PHP'
$entity     = $this->request['entity'];
$template   = $this->request['template'];
$entityId   = $this->request['entityId'];
$templateId = $this->request['templateId'];
if (isset($entityId))   $entity   = eqb()->where('id', '=', $entityId)->get()[0];
if (isset($templateId)) $template = eqb()->where('id', '=', $templateId)->get()[0];
$vars = [
    'entity'       => $entity,
    'study'        => isset($entity['smpl_study_fk'])         ? eqb()->where('id', '=', $entity['smpl_study_fk'])->get()[0]         : null,
    'subject'      => isset($entity['smpl_subject_fk'])       ? eqb()->where('id', '=', $entity['smpl_subject_fk'])->get()[0]       : null,
    'breed'        => isset($entity['smpl_subject_breed_fk']) ? eqb()->where('id', '=', $entity['smpl_subject_breed_fk'])->get()[0] : null,
    'case'         => isset($entity['smpl_case_fk'])          ? eqb()->where('id', '=', $entity['smpl_case_fk'])->get()[0]          : null,
    'caseType'     => isset($entity['smpl_case_type_fk'])     ? eqb()->where('id', '=', $entity['smpl_case_type_fk'])->get()[0]     : null,
    'kit'          => isset($entity['smpl_kit_fk'])           ? eqb()->where('id', '=', $entity['smpl_kit_fk'])->get()[0]           : null,
    'line'         => isset($entity['smpl_workflow_line_fk']) ? eqb()->where('id', '=', $entity['smpl_workflow_line_fk'])->get()[0] : null,
    'parentSample' => isset($entity['smpl_sample_fk'])        ? eqb()->where('id', '=', $entity['smpl_sample_fk'])->get()[0]        : null,
];
$line = $vars['line'];
if (isset($line['smpl_id_gen_fk']) && !isset($template)) $template = eqb()->where('id', '=', $line['smpl_id_gen_fk'])->get()[0];
$replaceVariables = function (string $str, array $vars): string {
    return preg_replace_callback('/\$(\w+)(?:\[\s*[\'"]([^\'"]+)[\'"]\s*\])?/', function ($m) use ($vars) {
        if (isset($m[2])) return (isset($vars[$m[1]]) && is_array($vars[$m[1]]) && array_key_exists($m[2], $vars[$m[1]])) ? $vars[$m[1]][$m[2]] : '';
        return isset($vars[$m[1]]) ? (string) $vars[$m[1]] : '';
    }, $str);
};
$replaceWithTernary = function (string $str, array $vars) use (&$replaceWithTernary, $replaceVariables): string {
    $str = $replaceVariables($str, $vars);
    while (preg_match('/\{([^{}]*?)\s*\?\s*(.*?)\s*:\s*(.*?)\}/', $str, $m)) {
        $str = str_replace($m[0], !empty($replaceVariables($m[1], $vars)) ? $replaceWithTernary($m[2], $vars) : $replaceWithTernary($m[3], $vars), $str);
    }
    return $str;
};
$stem      = $replaceWithTernary($template['smpl_id_generator_mask'], $vars);
$length    = $template['smpl_id_generator_nb_length'] ?? 0;
$separator = $template['smpl_id_generator_separator'] ?? null;
$entities  = array_values(array_filter(
    eqb()->where('smpl_id_stem', '=', $stem)->where('smpl_id_nb', 'has', null)->get(),
    fn ($item) => ($item['smpl_id_stem'] ?? null) === $stem
));
usort($entities, fn ($a, $b) => $b['smpl_id_nb'] <=> $a['smpl_id_nb']);
$count = ($length == 0) ? 0 : 1;
foreach ($entities as $item) { if ($item['smpl_id_nb'] >= $count) $count = $item['smpl_id_nb'] + 1; }
if (isset($entity['smpl_order'])) $count += $entity['smpl_order'];
$nb = ($length == 0) ? '' : str_pad((string) $count, $length, '0', STR_PAD_LEFT);
$this->response->setResponseHeaders(['content-type' => 'application/json']);
$this->response->setResponseContent(json_encode([
    'stem' => $stem, 'count' => $nb, 'separator' => $separator, 'nb' => $count,
    'id' => $stem.$separator.$nb, 'entity' => $entity, 'template' => $template,
    'vars' => $vars, 'entities' => $entities,
]));
PHP,
        ],
    ];

    public function up(): void
    {
        foreach ($this->routes as $routeData) {
            $existing = UserRoute::where('name', $routeData['name'])->first();
            if ($existing) {
                $service = app()->make(UserRouteService::class, [
                    'data'             => $routeData,
                    'operation'        => ResourceService::UPDATE_OPERATION,
                    'resourceToUpdate' => $existing,
                ]);
            } else {
                $service = app()->make(UserRouteService::class, [
                    'data' => $routeData,
                ]);
            }
            $service->consume();
        }
    }

    public function down(): void
    {
        $names = array_column($this->routes, 'name');
        UserRoute::whereIn('name', $names)->delete();
    }
};
